package com.kevinleader.bgr.dto.igdb;

public record IgdbExternalGameDto(
        Integer category,
        String uid,
        Long game,
        @com.fasterxml.jackson.annotation.JsonProperty("external_game_source") Long externalGameSource
) {}
