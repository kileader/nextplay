package com.kevinleader.bgr.controller;

import com.kevinleader.bgr.dto.usergame.SteamFamilyImportResultDto;
import com.kevinleader.bgr.dto.ranking.SortDirection;
import com.kevinleader.bgr.dto.usergame.UserGamePageDto;
import com.kevinleader.bgr.dto.usergame.UserGameQueryDto;
import com.kevinleader.bgr.dto.usergame.UserGameSort;
import com.kevinleader.bgr.security.AppUserPrincipal;
import com.kevinleader.bgr.service.SteamFamilyLibraryImportService;
import com.kevinleader.bgr.service.UserGameService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Validated
@RestController
@RequestMapping("/users/me/games")
public class UserGameController {

    private final SteamFamilyLibraryImportService steamFamilyLibraryImportService;
    private final UserGameService userGameService;

    public UserGameController(SteamFamilyLibraryImportService steamFamilyLibraryImportService,
                              UserGameService userGameService) {
        this.steamFamilyLibraryImportService = steamFamilyLibraryImportService;
        this.userGameService = userGameService;
    }

    @GetMapping
    public UserGamePageDto getGames(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam(defaultValue = "true") boolean playable,
            @RequestParam(required = false) Boolean played,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) List<Integer> genreIds,
            @RequestParam(required = false) String title,
            @RequestParam(defaultValue = "TITLE") UserGameSort sort,
            @RequestParam(defaultValue = "ASC") SortDirection sortDirection,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "50") @Min(1) @Max(500) int limit) {
        return userGameService.getGamesPage(principal.getUser(), new UserGameQueryDto(
                playable, played, source, genreIds, title, sort, sortDirection, offset, limit
        ));
    }

    @PostMapping(value = "/import/steam-family", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SteamFamilyImportResultDto importSteamFamily(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam("file") MultipartFile file) {
        return steamFamilyLibraryImportService.importCsv(principal.getUser(), file);
    }
}
