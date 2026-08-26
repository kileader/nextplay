package com.kevinleader.bgr.service;

import com.kevinleader.bgr.client.IgdbClient;
import com.kevinleader.bgr.dto.igdb.IgdbGameDto;
import com.kevinleader.bgr.entity.GameCache;
import com.kevinleader.bgr.repository.GameCacheRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IgdbSyncServiceTest {

    private final IgdbClient igdbClient = mock(IgdbClient.class);
    private final GameCacheRepository gameCacheRepository = mock(GameCacheRepository.class);
    private final IgdbSyncService service = new IgdbSyncService(igdbClient, gameCacheRepository);

    @Test
    void returnsTheManagedCacheInstanceAfterSavingNewSteamLibraryMetadata() {
        IgdbGameDto dto = new IgdbGameDto(
                42L, "Alpha", null, null, null, null, null, null,
                null, null, null, null, null
        );
        GameCache managedCache = new GameCache();
        managedCache.setIgdbGameId(42L);

        when(igdbClient.fetchGamesBySteamAppIds(List.of(123))).thenReturn(List.of(
                new IgdbClient.SteamGameMatch(123, dto)
        ));
        when(gameCacheRepository.findById(42L)).thenReturn(java.util.Optional.empty());
        when(gameCacheRepository.saveAllAndFlush(any())).thenReturn(List.of(managedCache));

        Map<Integer, GameCache> saved = service.syncSteamLibraryGames(List.of(123));

        assertThat(saved).containsEntry(123, managedCache);
    }
}
