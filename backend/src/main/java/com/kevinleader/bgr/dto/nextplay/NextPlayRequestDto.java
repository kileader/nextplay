package com.kevinleader.bgr.dto.nextplay;

public record NextPlayRequestDto(
        NextPlaySessionLength sessionLength,
        NextPlayEnergy energy
) {
}
