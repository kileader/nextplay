package com.kevinleader.bgr.client;

import com.kevinleader.bgr.dto.igdb.IgdbExternalGameDto;
import com.kevinleader.bgr.dto.igdb.IgdbGameDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IgdbClientResolveSteamTest {

    @Test
    void resolvesSteamAppIdFromExternalGames() {
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
                List.of(new IgdbExternalGameDto(1, "222", null, null)),
                null
        );
        assertThat(IgdbClient.resolveSteamAppId(dto)).isEqualTo(222);
    }

}
