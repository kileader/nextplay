package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.metadata.MetadataItemDto;
import com.kevinleader.bgr.dto.ranking.SortDirection;
import com.kevinleader.bgr.dto.usergame.UserGamePageDto;
import com.kevinleader.bgr.dto.usergame.UserGameQueryDto;
import com.kevinleader.bgr.dto.usergame.UserGameResultDto;
import com.kevinleader.bgr.dto.usergame.UserGameSort;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.entity.GenreHltbFallback;
import com.kevinleader.bgr.repository.GenreHltbFallbackRepository;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class UserGameService {

    private final UserGameRepository userGameRepository;
    private final GenreHltbFallbackRepository genreRepository;

    public UserGameService(UserGameRepository userGameRepository,
                           GenreHltbFallbackRepository genreRepository) {
        this.userGameRepository = userGameRepository;
        this.genreRepository = genreRepository;
    }

    public UserGamePageDto getGamesPage(AppUser user, UserGameQueryDto query) {
        validateQuery(query);
        List<UserGame> userGames = userGameRepository.findLibraryByUser(user);
        List<MetadataItemDto> availableGenres = availableGenres(userGames, query.playable());

        List<UserGame> filtered = userGames.stream()
                .filter(game -> game.isPlayable() == query.playable())
                .filter(game -> matchesPlayed(game, query.played()))
                .filter(game -> matchesSource(game, query.source()))
                .filter(game -> matchesTitle(game, query.title()))
                .filter(game -> matchesGenres(game, query.genreIds()))
                .sorted(buildComparator(query))
                .toList();

        List<UserGameResultDto> results = filtered.stream()
                .skip(query.offset())
                .limit(query.limit())
                .map(this::toResult)
                .toList();

        return new UserGamePageDto(query.offset(), query.limit(), filtered.size(), results, availableGenres);
    }

    private void validateQuery(UserGameQueryDto query) {
        if (query.offset() < 0) {
            throw new IllegalArgumentException("offset must be at least 0");
        }
        if (query.limit() < 1 || query.limit() > 500) {
            throw new IllegalArgumentException("limit must be between 1 and 500");
        }
    }

    private List<MetadataItemDto> availableGenres(List<UserGame> games, boolean playable) {
        Set<Integer> genreIds = games.stream()
                .filter(game -> game.isPlayable() == playable)
                .flatMap(game -> Arrays.stream(genreIds(game.getGameCache())).boxed())
                .collect(Collectors.toSet());
        if (genreIds.isEmpty()) {
            return List.of();
        }
        Map<Integer, GenreHltbFallback> genresById = genreRepository.findAllById(genreIds).stream()
                .collect(Collectors.toMap(GenreHltbFallback::getIgdbGenreId, Function.identity()));
        return genreIds.stream()
                .map(genresById::get)
                .filter(Objects::nonNull)
                .map(genre -> new MetadataItemDto(genre.getIgdbGenreId(), genre.getGenreName()))
                .sorted(Comparator.comparing(MetadataItemDto::name))
                .toList();
    }

    private boolean matchesPlayed(UserGame game, Boolean played) {
        return played == null || (game.getPlaytimeMinutes() > 0) == played;
    }

    private boolean matchesSource(UserGame game, String source) {
        return source == null || source.isBlank() || game.getSteamSource().equalsIgnoreCase(source.trim());
    }

    private boolean matchesTitle(UserGame game, String title) {
        return title == null || title.isBlank()
                || game.getSteamTitle().toLowerCase(Locale.ROOT).contains(title.trim().toLowerCase(Locale.ROOT));
    }

    private boolean matchesGenres(UserGame game, List<Integer> requestedGenreIds) {
        if (requestedGenreIds == null || requestedGenreIds.isEmpty()) {
            return true;
        }
        int[] gameGenreIds = genreIds(game.getGameCache());
        return requestedGenreIds.stream().anyMatch(requested -> Arrays.stream(gameGenreIds).anyMatch(id -> id == requested));
    }

    private Comparator<UserGame> buildComparator(UserGameQueryDto query) {
        UserGameSort sort = query.sort() == null ? UserGameSort.TITLE : query.sort();
        Comparator<UserGame> comparator = switch (sort) {
            case PLAYTIME -> Comparator.comparingInt(UserGame::getPlaytimeMinutes);
            case LAST_PLAYED -> Comparator.comparing(UserGame::getLastPlayedAt,
                    Comparator.nullsLast(Comparator.naturalOrder()));
            case TITLE -> Comparator.comparing(UserGame::getSteamTitle, String.CASE_INSENSITIVE_ORDER);
        };
        if (query.sortDirection() == SortDirection.DESC) {
            comparator = comparator.reversed();
        }
        return comparator.thenComparing(UserGame::getSteamTitle, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(UserGame::getSteamAppId);
    }

    private UserGameResultDto toResult(UserGame game) {
        GameCache cache = game.getGameCache();
        return new UserGameResultDto(
                game.getId(), game.getSteamAppId(), game.getSteamTitle(), game.getSteamSource(), game.isPlayable(),
                game.getExcludeReason(), game.getPlaytimeMinutes(), game.getAcquiredAt(), game.getLastPlayedAt(),
                cache == null ? null : cache.getIgdbGameId(),
                cache == null ? null : cache.getCoverImageUrl(),
                cache == null ? null : cache.getIgdbRating(),
                genreIds(cache)
        );
    }

    private int[] genreIds(GameCache cache) {
        return cache == null || cache.getGenreIds() == null ? new int[0] : cache.getGenreIds();
    }
}
