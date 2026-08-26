package com.kevinleader.bgr.dto.usergame;

import com.kevinleader.bgr.dto.metadata.MetadataItemDto;

import java.util.List;

public record UserGamePageDto(
        int offset,
        int limit,
        int total,
        List<UserGameResultDto> results,
        List<MetadataItemDto> availableGenres
) {
}
