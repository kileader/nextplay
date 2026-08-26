package com.kevinleader.bgr.controller;

import com.kevinleader.bgr.dto.nextplay.NextPlayPickDto;
import com.kevinleader.bgr.dto.nextplay.NextPlayRequestDto;
import com.kevinleader.bgr.security.AppUserPrincipal;
import com.kevinleader.bgr.service.NextPlayPickService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/users/me/next-picks")
public class NextPlayController {

    private final NextPlayPickService nextPlayPickService;

    public NextPlayController(NextPlayPickService nextPlayPickService) {
        this.nextPlayPickService = nextPlayPickService;
    }

    @PostMapping
    public List<NextPlayPickDto> getPicks(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestBody NextPlayRequestDto request) {
        return nextPlayPickService.getPicks(principal.getUser(), request);
    }
}
