package com.kevinleader.bgr.service;

import com.kevinleader.bgr.dto.usergame.SteamLibraryEnrichmentResultDto;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.entity.UserGame;
import com.kevinleader.bgr.repository.UserGameRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SteamLibraryMetadataEnrichmentService {
    private static final int BATCH_SIZE = 100;
    private final UserGameRepository userGameRepository;
    private final IgdbSyncService igdbSyncService;

    public SteamLibraryMetadataEnrichmentService(UserGameRepository userGameRepository, IgdbSyncService igdbSyncService) {
        this.userGameRepository = userGameRepository;
        this.igdbSyncService = igdbSyncService;
    }

    @Transactional
    public SteamLibraryEnrichmentResultDto enrich(AppUser user) {
        List<UserGame> unmatched = userGameRepository.findByUser(user).stream()
                .filter(game -> game.getGameCache() == null).toList();
        int matched = 0;
        for (int start = 0; start < unmatched.size(); start += BATCH_SIZE) {
            List<UserGame> batch = unmatched.subList(start, Math.min(start + BATCH_SIZE, unmatched.size()));
            Map<Integer, GameCache> cacheByAppId = igdbSyncService.syncSteamLibraryGames(
                    batch.stream().map(UserGame::getSteamAppId).toList()
            );
            for (UserGame game : batch) {
                GameCache cache = cacheByAppId.get(game.getSteamAppId());
                if (cache != null) {
                    game.setGameCache(cache);
                    matched++;
                }
            }
        }
        userGameRepository.saveAll(unmatched);
        return new SteamLibraryEnrichmentResultDto(unmatched.size(), matched, unmatched.size() - matched);
    }
}
