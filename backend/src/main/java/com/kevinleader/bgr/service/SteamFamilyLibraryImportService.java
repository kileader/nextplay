package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.usergame.SteamFamilyImportResultDto;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.repository.GameCacheRepository;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.SequenceInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SteamFamilyLibraryImportService {

    private static final Set<String> REQUIRED_HEADERS = Set.of(
            "appid", "name", "source", "playable", "exclude_reason",
            "playtime_minutes", "acquired", "last_played"
    );

    private final UserGameRepository userGameRepository;
    private final GameCacheRepository gameCacheRepository;

    public SteamFamilyLibraryImportService(UserGameRepository userGameRepository,
                                           GameCacheRepository gameCacheRepository) {
        this.userGameRepository = userGameRepository;
        this.gameCacheRepository = gameCacheRepository;
    }

    @Transactional
    public SteamFamilyImportResultDto importCsv(AppUser user, MultipartFile file) {
        List<SteamFamilyRow> rows = parse(file);
        Map<Integer, UserGame> existingByAppId = userGameRepository.findByUser(user).stream()
                .collect(Collectors.toMap(UserGame::getSteamAppId, game -> game));
        Map<Integer, List<GameCache>> cacheByAppId = gameCacheRepository.findBySteamAppIdIn(
                        rows.stream().map(SteamFamilyRow::steamAppId).collect(Collectors.toSet())
                ).stream()
                .collect(Collectors.groupingBy(GameCache::getSteamAppId));

        int created = 0;
        int updated = 0;
        int cacheMatched = 0;
        int cacheUnmatched = 0;
        int cacheAmbiguous = 0;
        List<UserGame> games = new java.util.ArrayList<>(rows.size());

        for (SteamFamilyRow row : rows) {
            UserGame game = existingByAppId.get(row.steamAppId());
            if (game == null) {
                game = new UserGame();
                game.setUser(user);
                created++;
            } else {
                updated++;
            }

            CacheMatch cacheMatch = resolveCacheMatch(row, cacheByAppId.get(row.steamAppId()));
            if (cacheMatch.gameCache() != null) {
                game.setGameCache(cacheMatch.gameCache());
                cacheMatched++;
            } else {
                game.setGameCache(null);
                if (cacheMatch.ambiguous()) {
                    cacheAmbiguous++;
                } else {
                    cacheUnmatched++;
                }
            }

            game.setSteamAppId(row.steamAppId());
            game.setSteamTitle(row.title());
            game.setSteamSource(row.source());
            game.setPlayable(row.playable());
            game.setExcludeReason(row.excludeReason());
            game.setPlaytimeMinutes(row.playtimeMinutes());
            game.setAcquiredAt(row.acquiredAt());
            game.setLastPlayedAt(row.lastPlayedAt());
            game.setImportedAt(OffsetDateTime.now());
            games.add(game);
        }

        userGameRepository.saveAll(games);
        return new SteamFamilyImportResultDto(
                rows.size(), created, updated, cacheMatched, cacheUnmatched, cacheAmbiguous
        );
    }

    private List<SteamFamilyRow> parse(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A non-empty Steam Family CSV file is required");
        }

        try (InputStream input = utf8InputStream(file.getInputStream());
             Reader reader = new InputStreamReader(input, StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .build()
                     .parse(reader)) {
            validateHeaders(parser.getHeaderMap().keySet());

            List<SteamFamilyRow> rows = new java.util.ArrayList<>();
            Set<Integer> seenAppIds = new HashSet<>();
            for (CSVRecord record : parser) {
                SteamFamilyRow row = toRow(record);
                if (!seenAppIds.add(row.steamAppId())) {
                    throw rowError(record, "duplicate appid " + row.steamAppId());
                }
                rows.add(row);
            }
            if (rows.isEmpty()) {
                throw new IllegalArgumentException("Steam Family CSV contains no game rows");
            }
            return rows;
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to read Steam Family CSV", e);
        }
    }

    private void validateHeaders(Collection<String> headers) {
        Set<String> missing = new HashSet<>(REQUIRED_HEADERS);
        missing.removeAll(headers);
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Steam Family CSV is missing required columns: "
                    + String.join(", ", missing));
        }
    }

    private SteamFamilyRow toRow(CSVRecord record) {
        int steamAppId = positiveInt(record, "appid");
        String title = requiredText(record, "name", 255);
        String source = requiredText(record, "source", 50);
        boolean playable = booleanValue(record, "playable");
        String excludeReason = optionalText(record, "exclude_reason", 255);
        int playtimeMinutes = nonNegativeInt(record, "playtime_minutes");
        LocalDate acquiredAt = requiredDate(record, "acquired");
        LocalDate lastPlayedAt = optionalDate(record, "last_played");
        return new SteamFamilyRow(
                steamAppId, title, source, playable, excludeReason, playtimeMinutes, acquiredAt, lastPlayedAt
        );
    }

    private CacheMatch resolveCacheMatch(SteamFamilyRow row, List<GameCache> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return CacheMatch.unmatched();
        }
        if (candidates.size() == 1) {
            return CacheMatch.matched(candidates.getFirst());
        }

        List<GameCache> titleMatches = candidates.stream()
                .filter(candidate -> normalizeTitle(candidate.getTitle()).equals(normalizeTitle(row.title())))
                .toList();
        return titleMatches.size() == 1
                ? CacheMatch.matched(titleMatches.getFirst())
                : CacheMatch.ambiguousMatch();
    }

    private String normalizeTitle(String title) {
        return title.trim().toLowerCase(Locale.ROOT);
    }

    private int positiveInt(CSVRecord record, String column) {
        int value = nonNegativeInt(record, column);
        if (value == 0) {
            throw rowError(record, column + " must be greater than zero");
        }
        return value;
    }

    private int nonNegativeInt(CSVRecord record, String column) {
        String value = requiredText(record, column, Integer.MAX_VALUE);
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < 0) {
                throw rowError(record, column + " must not be negative");
            }
            return parsed;
        } catch (NumberFormatException e) {
            throw rowError(record, column + " must be a whole number");
        }
    }

    private boolean booleanValue(CSVRecord record, String column) {
        String value = requiredText(record, column, 5);
        if ("true".equalsIgnoreCase(value)) {
            return true;
        }
        if ("false".equalsIgnoreCase(value)) {
            return false;
        }
        throw rowError(record, column + " must be true or false");
    }

    private LocalDate requiredDate(CSVRecord record, String column) {
        String value = requiredText(record, column, 10);
        return parseDate(record, column, value);
    }

    private LocalDate optionalDate(CSVRecord record, String column) {
        String value = optionalText(record, column, 10);
        return value == null ? null : parseDate(record, column, value);
    }

    private LocalDate parseDate(CSVRecord record, String column, String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw rowError(record, column + " must use YYYY-MM-DD format");
        }
    }

    private String requiredText(CSVRecord record, String column, int maxLength) {
        String value = optionalText(record, column, maxLength);
        if (value == null) {
            throw rowError(record, column + " is required");
        }
        return value;
    }

    private String optionalText(CSVRecord record, String column, int maxLength) {
        String value = record.get(column).trim();
        if (value.isEmpty()) {
            return null;
        }
        if (value.length() > maxLength) {
            throw rowError(record, column + " exceeds " + maxLength + " characters");
        }
        return value;
    }

    private IllegalArgumentException rowError(CSVRecord record, String message) {
        return new IllegalArgumentException("Steam Family CSV row " + (record.getRecordNumber() + 1) + ": " + message);
    }

    private InputStream utf8InputStream(InputStream input) throws IOException {
        byte[] prefix = input.readNBytes(3);
        boolean hasUtf8Bom = prefix.length == 3
                && prefix[0] == (byte) 0xEF
                && prefix[1] == (byte) 0xBB
                && prefix[2] == (byte) 0xBF;
        return hasUtf8Bom ? input : new SequenceInputStream(new ByteArrayInputStream(prefix), input);
    }

    private record SteamFamilyRow(
            int steamAppId,
            String title,
            String source,
            boolean playable,
            String excludeReason,
            int playtimeMinutes,
            LocalDate acquiredAt,
            LocalDate lastPlayedAt
    ) {
    }

    private record CacheMatch(GameCache gameCache, boolean ambiguous) {
        private static CacheMatch matched(GameCache gameCache) {
            return new CacheMatch(gameCache, false);
        }

        private static CacheMatch unmatched() {
            return new CacheMatch(null, false);
        }

        private static CacheMatch ambiguousMatch() {
            return new CacheMatch(null, true);
        }
    }
}
