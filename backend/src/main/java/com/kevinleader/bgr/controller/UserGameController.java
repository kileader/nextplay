package com.kevinleader.bgr.controller;

import com.kevinleader.bgr.dto.usergame.SteamFamilyImportResultDto;
import com.kevinleader.bgr.security.AppUserPrincipal;
import com.kevinleader.bgr.service.SteamFamilyLibraryImportService;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/users/me/games")
public class UserGameController {

    private final SteamFamilyLibraryImportService steamFamilyLibraryImportService;

    public UserGameController(SteamFamilyLibraryImportService steamFamilyLibraryImportService) {
        this.steamFamilyLibraryImportService = steamFamilyLibraryImportService;
    }

    @PostMapping(value = "/import/steam-family", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SteamFamilyImportResultDto importSteamFamily(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam("file") MultipartFile file) {
        return steamFamilyLibraryImportService.importCsv(principal.getUser(), file);
    }
}
