package com.kevinleader.bgr.service;

import com.kevinleader.bgr.client.IgdbClient;
import com.kevinleader.bgr.dto.igdb.IgdbGameDto;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.repository.GameCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Collection;

@Service
public class IgdbSyncService {

    private static final Logger log = LoggerFactory.getLogger(IgdbSyncService.class);

    private static final int PAGE_SIZE = 500;

    private final IgdbClient igdbClient;
    private final GameCacheRepository gameCacheRepository;

    public IgdbSyncService(IgdbClient igdbClient, GameCacheRepository gameCacheRepository) {
        this.igdbClient = igdbClient;
        this.gameCacheRepository = gameCacheRepository;
    }

    public void syncAll() {
        log.info("Starting IGDB full sync");
        int offset = 0;
        int totalSaved = 0;

        while (true) {
            log.info("Fetching IGDB games: offset={}, limit={}", offset, PAGE_SIZE);
            List<IgdbGameDto> page = igdbClient.fetchGames(offset, PAGE_SIZE);

            if (page == null || page.isEmpty()) {
                log.info("Empty page at offset={}, sync complete", offset);
                break;
            }

            List<GameCache> toSave = new ArrayList<>(page.size());
            for (IgdbGameDto dto : page) {
                if (dto.id() == null) {
                    log.warn("Skipping IGDB game with null id: {}", dto.name());
                    continue;
                }
                GameCache entity = gameCacheRepository.findById(dto.id())
                        .orElseGet(GameCache::new);
                applyIgdbFields(entity, dto);
                toSave.add(entity);
            }

            gameCacheRepository.saveAll(toSave);
            totalSaved += toSave.size();
            log.info("Saved {} records (running total: {})", toSave.size(), totalSaved);

            if (page.size() < PAGE_SIZE) {
                log.info("Last page received ({} records), sync complete", page.size());
                break;
            }

            offset += PAGE_SIZE;
        }

        log.info("IGDB sync finished. Total records saved: {}", totalSaved);
    }

    /** Fetches and caches a bounded Steam-library subset, bypassing the catalog rating threshold. */
    public List<GameCache> syncSteamLibraryGames(Collection<Integer> steamAppIds) {
        List<IgdbGameDto> games = igdbClient.fetchGamesBySteamAppIds(steamAppIds);
        List<GameCache> toSave = new ArrayList<>(games.size());
        for (IgdbGameDto dto : games) {
            if (dto.id() == null) continue;
            GameCache entity = gameCacheRepository.findById(dto.id()).orElseGet(GameCache::new);
            applyIgdbFields(entity, dto);
            toSave.add(entity);
        }
        return gameCacheRepository.saveAll(toSave);
    }

    private void applyIgdbFields(GameCache entity, IgdbGameDto dto) {
        entity.setIgdbGameId(dto.id());
        entity.setTitle(dto.name());
        entity.setIgdbSummary(dto.summary());
        entity.setIgdbRating(dto.rating() != null ? BigDecimal.valueOf(dto.rating()) : null);
        entity.setIgdbRatingCount(dto.ratingCount() != null ? dto.ratingCount() : 0);
        entity.setPlatformIds(dto.platforms() != null
                ? dto.platforms().stream().mapToInt(i -> i).toArray()
                : new int[0]);
        entity.setGenreIds(dto.genres() != null
                ? dto.genres().stream().mapToInt(i -> i).toArray()
                : new int[0]);
        entity.setFirstReleaseDate(dto.firstReleaseDate() != null
                ? Instant.ofEpochSecond(dto.firstReleaseDate()).atOffset(ZoneOffset.UTC).toLocalDate()
                : null);
        entity.setCoverImageUrl(dto.cover() != null
                ? IgdbClient.buildCoverUrl(dto.cover().imageId())
                : null);
        entity.setIgdbUrl(dto.url());
        entity.setMultiplayerOnly(dto.gameModes() != null
                && !dto.gameModes().isEmpty()
                && !IgdbClient.isSinglePlayer(dto.gameModes()));
        entity.setSteamAppId(IgdbClient.resolveSteamAppId(dto));
        entity.setAgeRatingDisplay(AgeRatingDisplayFormatter.fromIgdbAgeRatings(dto.ageRatings()));
        entity.setLastIgdbSync(OffsetDateTime.now());
    }
}
