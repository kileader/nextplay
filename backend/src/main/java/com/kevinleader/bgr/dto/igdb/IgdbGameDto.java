package com.kevinleader.bgr.dto.igdb;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record IgdbGameDto(
        Long id,
        String name,
        String summary,
        Double rating,
        @JsonProperty("rating_count") Integer ratingCount,
        List<Integer> platforms,
        List<Integer> genres,
        // Unix epoch seconds from IGDB -- convert to LocalDate via Instant.ofEpochSecond(n).atOffset(ZoneOffset.UTC).toLocalDate()
        @JsonProperty("first_release_date") Long firstReleaseDate,
        IgdbCoverDto cover,
        String url,
        @JsonProperty("game_modes") List<Integer> gameModes,
        /** Direct Steam id when IGDB exposes {@code external.steam} (preferred). */
        @JsonProperty("external") IgdbExternalIdsDto external,
        @JsonProperty("external_games") List<IgdbExternalGameDto> externalGames,
        @JsonProperty("age_ratings") List<IgdbAgeRatingDto> ageRatings
) {}
