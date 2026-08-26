package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.usergame.SteamFamilyImportResultDto;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.repository.GameCacheRepository;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SteamFamilyLibraryImportServiceTest {

    private final UserGameRepository userGameRepository = mock(UserGameRepository.class);
    private final GameCacheRepository gameCacheRepository = mock(GameCacheRepository.class);
    private final SteamFamilyLibraryImportService service = new SteamFamilyLibraryImportService(
            userGameRepository, gameCacheRepository
    );

    @Test
    @SuppressWarnings("unchecked")
    void importsRowsAndOnlyLinksUnambiguousCacheMatches() {
        AppUser user = user();
        UserGame existing = new UserGame();
        existing.setUser(user);
        existing.setSteamAppId(10);

        GameCache singleMatch = cache(101L, 10, "Existing Game");
        GameCache ambiguousFirst = cache(201L, 20, "Different Game");
        GameCache ambiguousSecond = cache(202L, 20, "Another Game");
        when(userGameRepository.findByUser(user)).thenReturn(List.of(existing));
        when(gameCacheRepository.findBySteamAppIdIn(any())).thenReturn(
                List.of(singleMatch, ambiguousFirst, ambiguousSecond)
        );

        SteamFamilyImportResultDto result = service.importCsv(user, csv("""
                appid,name,source,playable,exclude_reason,playtime_minutes,acquired,last_played,store_url
                10,Existing Game,own,true,,120,2024-01-01,2024-02-03,https://store.steampowered.com/app/10
                20,"New, Game",family,false,excluded by owner,0,2023-05-06,,https://store.steampowered.com/app/20
                """));

        assertThat(result).isEqualTo(new SteamFamilyImportResultDto(2, 1, 1, 0, 1, 0, 1));
        assertThat(existing.getGameCache()).isSameAs(singleMatch);
        assertThat(existing.getPlaytimeMinutes()).isEqualTo(120);
        assertThat(existing.getLastPlayedAt()).isEqualTo(LocalDate.of(2024, 2, 3));

        ArgumentCaptor<Iterable<UserGame>> gamesCaptor = ArgumentCaptor.forClass(Iterable.class);
        verify(userGameRepository).saveAll(gamesCaptor.capture());
        List<UserGame> savedGames = new java.util.ArrayList<>();
        gamesCaptor.getValue().forEach(savedGames::add);
        UserGame created = savedGames.stream().filter(game -> game.getSteamAppId() == 20).findFirst().orElseThrow();
        assertThat(created.getSteamTitle()).isEqualTo("New, Game");
        assertThat(created.getGameCache()).isNull();
        assertThat(created.isPlayable()).isFalse();
        assertThat(created.getExcludeReason()).isEqualTo("excluded by owner");
    }

    @Test
    void removesGamesAbsentFromTheImportedLibrarySnapshot() {
        AppUser user = user();
        UserGame retained = new UserGame();
        retained.setUser(user);
        retained.setSteamAppId(10);
        UserGame removed = new UserGame();
        removed.setUser(user);
        removed.setSteamAppId(20);
        when(userGameRepository.findByUser(user)).thenReturn(List.of(retained, removed));
        when(gameCacheRepository.findBySteamAppIdIn(any())).thenReturn(List.of());

        SteamFamilyImportResultDto result = service.importCsv(user, csv("""
                appid,name,source,playable,exclude_reason,playtime_minutes,acquired,last_played
                10,Retained Game,own,true,,0,2024-01-01,
                """));

        assertThat(result.removed()).isEqualTo(1);
        verify(userGameRepository).deleteAll(List.of(removed));
    }

    @Test
    void rejectsMissingRequiredHeadersBeforeSaving() {
        AppUser user = user();

        assertThatThrownBy(() -> service.importCsv(user, csv("""
                appid,name,source
                10,Game,own
                """)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("missing required columns");
    }

    @Test
    void rejectsInvalidPlayableValuesBeforeSaving() {
        AppUser user = user();

        assertThatThrownBy(() -> service.importCsv(user, csv("""
                appid,name,source,playable,exclude_reason,playtime_minutes,acquired,last_played
                10,Game,own,maybe,,0,2024-01-01,
                """)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("playable must be true or false");
    }

    private AppUser user() {
        AppUser user = new AppUser();
        user.setUsername("kevin");
        user.setEmail("kevin@example.com");
        return user;
    }

    private GameCache cache(Long id, int steamAppId, String title) {
        GameCache game = new GameCache();
        game.setIgdbGameId(id);
        game.setSteamAppId(steamAppId);
        game.setTitle(title);
        return game;
    }

    private MockMultipartFile csv(String content) {
        return new MockMultipartFile(
                "file", "library.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8)
        );
    }
}
