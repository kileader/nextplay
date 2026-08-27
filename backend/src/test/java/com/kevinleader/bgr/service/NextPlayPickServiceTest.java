package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.nextplay.NextPlayEnergy;
import com.kevinleader.bgr.dto.nextplay.NextPlayRequestDto;
import com.kevinleader.bgr.dto.nextplay.NextPlaySessionLength;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.entity.UserGameStatus;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NextPlayPickServiceTest {

    private final UserGameRepository userGameRepository = mock(UserGameRepository.class);
    private final NextPlayPickService service = new NextPlayPickService(userGameRepository);

    @Test
    void favorsCompactUnplayedGamesAndExcludesCompletedOrDroppedGames() {
        AppUser user = new AppUser();
        UserGame compact = game(1, "Compact", 0, null, 4, 78);
        UserGame longGame = game(2, "Long", 0, null, 40, 95);
        UserGame completed = game(3, "Completed", 0, UserGameStatus.COMPLETED, 3, 99);
        UserGame dropped = game(4, "Dropped", 0, UserGameStatus.DROPPED, 3, 99);
        when(userGameRepository.findLibraryByUser(user)).thenReturn(List.of(longGame, completed, compact, dropped));

        var picks = service.getPicks(user, new NextPlayRequestDto(
                NextPlaySessionLength.SHORT, NextPlayEnergy.LOW, null, null
        ));

        assertThat(picks).extracting(pick -> pick.title()).containsExactly("Compact", "Long");
        assertThat(picks.getFirst().reasons()).anyMatch(reason -> reason.contains("compact"));
        assertThat(picks).extracting(pick -> pick.title()).doesNotContain("Completed", "Dropped");
    }

    @Test
    void usesLongerCachedGameWhenTimeAndEnergyAllowIt() {
        AppUser user = new AppUser();
        UserGame compact = game(1, "Compact", 0, null, 4, 78);
        UserGame longGame = game(2, "Long", 0, null, 40, 95);
        when(userGameRepository.findLibraryByUser(user)).thenReturn(List.of(compact, longGame));

        var picks = service.getPicks(user, new NextPlayRequestDto(
                NextPlaySessionLength.OPEN_ENDED, NextPlayEnergy.HIGH, null, null
        ));

        assertThat(picks).first().satisfies(pick -> {
            assertThat(pick.title()).isEqualTo("Long");
            assertThat(pick.reasons()).anyMatch(reason -> reason.contains("longer"));
        });
    }

    @Test
    void filtersByRequestedGenreAndRotatesRefreshPool() {
        AppUser user = new AppUser();
        UserGame actionOne = game(1, "Action One", 0, null, 8, 90, 4);
        UserGame actionTwo = game(2, "Action Two", 0, null, 8, 80, 4);
        UserGame actionThree = game(3, "Action Three", 0, null, 8, 70, 4);
        UserGame actionFour = game(4, "Action Four", 0, null, 8, 60, 4);
        UserGame puzzle = game(5, "Puzzle", 0, null, 8, 99, 9);
        when(userGameRepository.findLibraryByUser(user)).thenReturn(List.of(actionOne, actionTwo, actionThree, actionFour, puzzle));

        var picks = service.getPicks(user, new NextPlayRequestDto(
                NextPlaySessionLength.STANDARD, NextPlayEnergy.MEDIUM, List.of(4), 1
        ));

        assertThat(picks).extracting(pick -> pick.title())
                .containsExactly("Action Two", "Action Three", "Action Four");
        assertThat(picks).extracting(pick -> pick.title()).doesNotContain("Puzzle");
    }

    private UserGame game(int appId, String title, int playtimeMinutes, UserGameStatus status,
                          int hltbHours, int rating) {
        return game(appId, title, playtimeMinutes, status, hltbHours, rating, new int[0]);
    }

    private UserGame game(int appId, String title, int playtimeMinutes, UserGameStatus status,
                          int hltbHours, int rating, int... genreIds) {
        GameCache cache = new GameCache();
        cache.setHltbHours(BigDecimal.valueOf(hltbHours));
        cache.setIgdbRating(BigDecimal.valueOf(rating));
        cache.setIgdbSummary(title + " summary");
        cache.setGenreIds(genreIds);
        UserGame game = new UserGame();
        game.setSteamAppId(appId);
        game.setSteamTitle(title);
        game.setPlayable(true);
        game.setPlaytimeMinutes(playtimeMinutes);
        game.setStatus(status);
        game.setGameCache(cache);
        return game;
    }
}
