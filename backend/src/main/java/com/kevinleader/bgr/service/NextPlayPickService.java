package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.nextplay.NextPlayEnergy;
import com.kevinleader.bgr.dto.nextplay.NextPlayPickDto;
import com.kevinleader.bgr.dto.nextplay.NextPlayRequestDto;
import com.kevinleader.bgr.dto.nextplay.NextPlaySessionLength;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.entity.UserGameStatus;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class NextPlayPickService {

    private static final int PICK_LIMIT = 3;
    private static final int REFRESH_POOL_LIMIT = 12;

    private final UserGameRepository userGameRepository;

    public NextPlayPickService(UserGameRepository userGameRepository) {
        this.userGameRepository = userGameRepository;
    }

    public List<NextPlayPickDto> getPicks(AppUser user, NextPlayRequestDto request) {
        NextPlaySessionLength sessionLength = request.sessionLength() == null
                ? NextPlaySessionLength.STANDARD : request.sessionLength();
        NextPlayEnergy energy = request.energy() == null ? NextPlayEnergy.MEDIUM : request.energy();
        Set<Integer> genreIds = request.genreIds() == null ? Set.of() : request.genreIds().stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());

        List<ScoredGame> candidates = userGameRepository.findLibraryByUser(user).stream()
                .filter(UserGame::isPlayable)
                .filter(game -> game.getStatus() != UserGameStatus.COMPLETED && game.getStatus() != UserGameStatus.DROPPED)
                .filter(game -> matchesGenres(game, genreIds))
                .map(game -> new ScoredGame(game, score(game, sessionLength, energy)))
                .sorted(Comparator.comparingInt(ScoredGame::score).reversed()
                        .thenComparing(scored -> scored.game().getSteamTitle(), String.CASE_INSENSITIVE_ORDER))
                .limit(REFRESH_POOL_LIMIT)
                .toList();

        return rotate(candidates, request.refreshKey()).stream()
                .limit(PICK_LIMIT)
                .map(scored -> toPick(scored.game(), sessionLength, energy))
                .toList();
    }

    private boolean matchesGenres(UserGame game, Set<Integer> requestedGenreIds) {
        if (requestedGenreIds.isEmpty()) {
            return true;
        }
        GameCache cache = game.getGameCache();
        int[] gameGenreIds = cache == null ? null : cache.getGenreIds();
        if (gameGenreIds == null || gameGenreIds.length == 0) {
            return false;
        }
        for (int gameGenreId : gameGenreIds) {
            if (requestedGenreIds.contains(gameGenreId)) {
                return true;
            }
        }
        return false;
    }

    private List<ScoredGame> rotate(List<ScoredGame> candidates, Integer refreshKey) {
        if (candidates.size() <= PICK_LIMIT || refreshKey == null || refreshKey == 0) {
            return candidates;
        }
        ArrayList<ScoredGame> rotated = new ArrayList<>(candidates);
        Collections.rotate(rotated, -Math.floorMod(refreshKey, candidates.size()));
        return rotated;
    }

    private int score(UserGame game, NextPlaySessionLength sessionLength, NextPlayEnergy energy) {
        int score = game.getPlaytimeMinutes() == 0 ? 20 : 4;
        if (game.getStatus() == UserGameStatus.PLAYING) {
            score += 12;
        }

        GameCache cache = game.getGameCache();
        if (cache == null) {
            return score;
        }
        if (cache.getIgdbRating() != null) {
            score += cache.getIgdbRating().intValue() / 10;
        }
        if (cache.getHltbHours() != null) {
            double hours = cache.getHltbHours().doubleValue();
            score += commitmentScore(hours, sessionLength);
            score += energyScore(hours, energy);
        }
        return score;
    }

    private int commitmentScore(double hours, NextPlaySessionLength sessionLength) {
        return switch (sessionLength) {
            case SHORT -> hours <= 6 ? 20 : hours <= 15 ? 8 : 0;
            case STANDARD -> hours >= 4 && hours <= 20 ? 20 : hours <= 40 ? 8 : 0;
            case OPEN_ENDED -> hours >= 15 ? 20 : hours >= 6 ? 10 : 0;
        };
    }

    private int energyScore(double hours, NextPlayEnergy energy) {
        return switch (energy) {
            case LOW -> hours <= 10 ? 10 : 0;
            case MEDIUM -> hours >= 4 && hours <= 25 ? 10 : 0;
            case HIGH -> hours >= 15 ? 10 : 0;
        };
    }

    private NextPlayPickDto toPick(UserGame game, NextPlaySessionLength sessionLength, NextPlayEnergy energy) {
        GameCache cache = game.getGameCache();
        return new NextPlayPickDto(
                game.getSteamAppId(),
                game.getSteamTitle(),
                cache == null ? null : cache.getIgdbSummary(),
                cache == null ? null : cache.getCoverImageUrl(),
                cache == null ? null : cache.getIgdbRating(),
                cache == null ? null : cache.getHltbHours(),
                game.getPlaytimeMinutes(),
                game.getStatus(),
                reasons(game, cache, sessionLength, energy)
        );
    }

    private List<String> reasons(UserGame game, GameCache cache, NextPlaySessionLength sessionLength, NextPlayEnergy energy) {
        java.util.ArrayList<String> reasons = new java.util.ArrayList<>();
        if (game.getStatus() == UserGameStatus.PLAYING) {
            reasons.add("You are already playing it.");
        } else if (game.getPlaytimeMinutes() == 0) {
            reasons.add("You have not played it yet.");
        }
        if (cache != null && cache.getHltbHours() != null) {
            reasons.add(commitmentReason(cache.getHltbHours(), sessionLength, energy));
        }
        if (cache != null && cache.getIgdbRating() != null) {
            reasons.add("Rated " + cache.getIgdbRating().setScale(0, java.math.RoundingMode.HALF_UP) + " on IGDB.");
        }
        if (reasons.isEmpty()) {
            reasons.add("Available in your library.");
        }
        return reasons;
    }

    private String commitmentReason(BigDecimal hours, NextPlaySessionLength sessionLength, NextPlayEnergy energy) {
        int roundedHours = hours.setScale(0, java.math.RoundingMode.HALF_UP).intValue();
        String length = switch (sessionLength) {
            case SHORT -> "a compact";
            case STANDARD -> "a balanced";
            case OPEN_ENDED -> "a longer";
        };
        String effort = switch (energy) {
            case LOW -> "lighter";
            case MEDIUM -> "steady";
            case HIGH -> "more involved";
        };
        return "About " + roundedHours + " hours overall; " + length + ", " + effort + " fit.";
    }

    private record ScoredGame(UserGame game, int score) {
    }
}
