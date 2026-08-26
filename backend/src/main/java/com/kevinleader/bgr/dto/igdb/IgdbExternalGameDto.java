package com.kevinleader.bgr.dto.igdb;

public record IgdbExternalGameDto(
        Integer category,
        String uid,
        Long game
) {}
