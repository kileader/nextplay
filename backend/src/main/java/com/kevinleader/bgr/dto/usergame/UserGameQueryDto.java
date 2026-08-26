package com.kevinleader.bgr.dto.usergame;

import com.kevinleader.bgr.dto.ranking.SortDirection;
import com.kevinleader.bgr.entity.UserGameStatus;

import java.util.List;

public record UserGameQueryDto(
        boolean playable,
        Boolean played,
        UserGameStatus status,
        Boolean uncategorized,
        String source,
        List<Integer> genreIds,
        String title,
        UserGameSort sort,
        SortDirection sortDirection,
        int offset,
        int limit
) {
}
