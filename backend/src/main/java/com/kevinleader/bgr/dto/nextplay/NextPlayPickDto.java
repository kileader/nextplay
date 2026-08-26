package com.kevinleader.bgr.dto.nextplay;

import com.kevinleader.bgr.entity.UserGameStatus;

import java.math.BigDecimal;
import java.util.List;

public record NextPlayPickDto(
        int steamAppId,
        String title,
        String description,
        String coverImageUrl,
        BigDecimal igdbRating,
        BigDecimal hltbHours,
        int playtimeMinutes,
        UserGameStatus status,
        List<String> reasons
) {
}
