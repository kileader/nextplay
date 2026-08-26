package com.kevinleader.bgr.client;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.kevinleader.bgr.dto.igdb.IgdbExternalGameDto;
import com.kevinleader.bgr.dto.igdb.IgdbExternalIdsDto;
import com.kevinleader.bgr.dto.igdb.IgdbGameDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IgdbClientResolveSteamTest {

    private static final JsonNodeFactory N = JsonNodeFactory.instance;

    @Test
    void prefersExternalSteamOverExternalGames() {
        IgdbGameDto dto = new IgdbGameDto(
                1L,
                "n",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new IgdbExternalIdsDto(N.numberNode(111)),
                List.of(new IgdbExternalGameDto(1, "222", null)),
                null
        );
        assertThat(IgdbClient.resolveSteamAppId(dto)).isEqualTo(111);
    }

    @Test
    void fallsBackToExternalGamesWhenExternalMissing() {
        IgdbGameDto dto = new IgdbGameDto(
                1L,
                "n",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(new IgdbExternalGameDto(1, "222", null)),
                null
        );
        assertThat(IgdbClient.resolveSteamAppId(dto)).isEqualTo(222);
    }

    @Test
    void parsesExternalSteamFromTextNode() {
        IgdbGameDto dto = new IgdbGameDto(
                1L,
                "n",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new IgdbExternalIdsDto(N.textNode("333")),
                null,
                null
        );
        assertThat(IgdbClient.resolveSteamAppId(dto)).isEqualTo(333);
    }
}
