package com.kevinleader.bgr.dto.usergame;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UserGameResultDto(
        Long id,
        int steamAppId,
        String title,
        String source,
        boolean playable,
        String excludeReason,
        int playtimeMinutes,
        LocalDate acquiredAt,
        LocalDate lastPlayedAt,
        Long igdbGameId,
        String coverImageUrl,
        BigDecimal igdbRating,
        int[] genreIds
) {
}
