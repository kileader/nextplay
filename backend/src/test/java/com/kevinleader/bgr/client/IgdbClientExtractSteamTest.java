package com.kevinleader.bgr.client;

import com.kevinleader.bgr.dto.igdb.IgdbExternalGameDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IgdbClientExtractSteamTest {

    private static final int STEAM_CATEGORY = 1;

    @Test
    void returnsNullWhenExternalGamesNull() {
        assertThat(IgdbClient.extractSteamAppId(null)).isNull();
    }

    @Test
    void firstMatchingSteamRowWinsWhenMultiplePresent() {
        List<IgdbExternalGameDto> games = List.of(
                new IgdbExternalGameDto(STEAM_CATEGORY, "2379780", null, null),
                new IgdbExternalGameDto(STEAM_CATEGORY, "999999", null, null)
        );
        assertThat(IgdbClient.extractSteamAppId(games)).isEqualTo(2379780);
    }

    @Test
    void ignoresNonSteamCategories() {
        List<IgdbExternalGameDto> games = List.of(
                new IgdbExternalGameDto(14, "111", null, null),
                new IgdbExternalGameDto(STEAM_CATEGORY, "42", null, null)
        );
        assertThat(IgdbClient.extractSteamAppId(games)).isEqualTo(42);
    }
}
