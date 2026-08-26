package com.kevinleader.bgr.controller;

import com.kevinleader.bgr.dto.usergame.SteamFamilyImportResultDto;
import com.kevinleader.bgr.dto.usergame.UserGamePageDto;
import com.kevinleader.bgr.entity.AppUser;
import com.kevinleader.bgr.security.AppUserPrincipal;
import com.kevinleader.bgr.service.SteamFamilyLibraryImportService;
import com.kevinleader.bgr.service.UserGameService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserGameControllerTest {

    @Test
    void importsCsvForAuthenticatedUser() {
        SteamFamilyLibraryImportService service = mock(SteamFamilyLibraryImportService.class);
        UserGameController controller = new UserGameController(service, mock(UserGameService.class));
        AppUser user = new AppUser();
        user.setUsername("kevin");
        AppUserPrincipal principal = new AppUserPrincipal(user);
        MockMultipartFile file = new MockMultipartFile(
                "file", "library.csv", "text/csv", "appid,name".getBytes(StandardCharsets.UTF_8)
        );
        SteamFamilyImportResultDto expected = new SteamFamilyImportResultDto(1, 1, 0, 0, 1, 0);
        when(service.importCsv(user, file)).thenReturn(expected);

        SteamFamilyImportResultDto result = controller.importSteamFamily(principal, file);

        assertThat(result).isEqualTo(expected);
        verify(service).importCsv(user, file);
    }
}
