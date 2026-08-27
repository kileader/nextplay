package com.kevinleader.bgr.dto.nextplay;

import java.util.List;

public record NextPlayRequestDto(
        NextPlaySessionLength sessionLength,
        NextPlayEnergy energy,
        List<Integer> genreIds,
        Integer refreshKey
) {
}
