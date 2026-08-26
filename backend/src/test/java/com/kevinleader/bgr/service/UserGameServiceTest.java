package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.ranking.SortDirection;
import com.kevinleader.bgr.dto.usergame.UserGamePageDto;
import com.kevinleader.bgr.dto.usergame.UserGameQueryDto;
import com.kevinleader.bgr.dto.usergame.UserGameSort;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.GenreHltbFallback;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.entity.UserGameStatus;
import com.kevinleader.bgr.repository.GenreHltbFallbackRepository;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserGameServiceTest {

    private final UserGameRepository userGameRepository = mock(UserGameRepository.class);
    private final GenreHltbFallbackRepository genreRepository = mock(GenreHltbFallbackRepository.class);
    private final UserGameService service = new UserGameService(userGameRepository, genreRepository);

    @Test
    void filtersPlayableLibraryAndReturnsSteamRowsWithOptionalMetadata() {
        AppUser user = new AppUser();
        GameCache cache = cache(10L, "Cached title", new int[]{12});
        UserGame unplayed = game(1, "Alpha", "own", true, 0, null, cache);
        UserGame played = game(2, "Beta", "family", true, 125, LocalDate.of(2026, 1, 2), null);
        UserGame unavailable = game(3, "Gamma", "family", false, 30, null, null);
        GenreHltbFallback genre = new GenreHltbFallback();
        genre.setIgdbGenreId(12);
        genre.setGenreName("Role-playing (RPG)");

        when(userGameRepository.findLibraryByUser(user)).thenReturn(List.of(played, unavailable, unplayed));
        when(genreRepository.findAllById(any())).thenReturn(List.of(genre));

        UserGamePageDto page = service.getGamesPage(user, new UserGameQueryDto(
                true, false, null, null, null, List.of(12), "alp", UserGameSort.TITLE, SortDirection.ASC, 0, 50
        ));

        assertThat(page.total()).isEqualTo(1);
        assertThat(page.results()).singleElement().satisfies(result -> {
            assertThat(result.title()).isEqualTo("Alpha");
            assertThat(result.source()).isEqualTo("own");
            assertThat(result.igdbGameId()).isEqualTo(10L);
            assertThat(result.genreIds()).containsExactly(12);
        });
        assertThat(page.availableGenres()).extracting(genreItem -> genreItem.name())
                .containsExactly("Role-playing (RPG)");
    }

    @Test
    void sortsByPlaytimeAndPaginates() {
        AppUser user = new AppUser();
        UserGame shortPlay = game(1, "Alpha", "own", true, 10, null, null);
        UserGame longPlay = game(2, "Beta", "family", true, 200, null, null);
        when(userGameRepository.findLibraryByUser(user)).thenReturn(List.of(shortPlay, longPlay));

        UserGamePageDto page = service.getGamesPage(user, new UserGameQueryDto(
                true, true, null, null, null, null, null, UserGameSort.PLAYTIME, SortDirection.DESC, 1, 1
        ));

        assertThat(page.total()).isEqualTo(2);
        assertThat(page.results()).extracting(result -> result.title()).containsExactly("Alpha");
    }

    @Test
    void filtersByExplicitStatusWithoutInferringItFromPlaytime() {
        AppUser user = new AppUser();
        UserGame backlog = game(1, "Alpha", "own", true, 100, null, null);
        backlog.setStatus(UserGameStatus.BACKLOG);
        UserGame uncategorized = game(2, "Beta", "own", true, 0, null, null);
        when(userGameRepository.findLibraryByUser(user)).thenReturn(List.of(backlog, uncategorized));

        UserGamePageDto page = service.getGamesPage(user, new UserGameQueryDto(
                true, null, UserGameStatus.BACKLOG, null, null, null, null, UserGameSort.TITLE, SortDirection.ASC, 0, 50
        ));

        assertThat(page.results()).extracting(result -> result.title()).containsExactly("Alpha");
    }

    private UserGame game(int appId, String title, String source, boolean playable, int minutes,
                          LocalDate lastPlayedAt, GameCache cache) {
        UserGame game = new UserGame();
        game.setSteamAppId(appId);
        game.setSteamTitle(title);
        game.setSteamSource(source);
        game.setPlayable(playable);
        game.setPlaytimeMinutes(minutes);
        game.setLastPlayedAt(lastPlayedAt);
        game.setGameCache(cache);
        return game;
    }

    private GameCache cache(long id, String title, int[] genreIds) {
        GameCache cache = new GameCache();
        cache.setIgdbGameId(id);
        cache.setTitle(title);
        cache.setGenreIds(genreIds);
        cache.setIgdbRating(new BigDecimal("90.00"));
        return cache;
    }
}
