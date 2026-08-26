package com.kevinleader.bgr.dto.usergame;

public record SteamFamilyImportResultDto(
        int totalRows,
        int created,
        int updated,
        int cacheMatched,
        int cacheUnmatched,
        int cacheAmbiguous
) {
}
