package com.kevinleader.bgr.client;

import com.kevinleader.bgr.dto.igdb.IgdbAuthResponse;
import com.kevinleader.bgr.dto.igdb.IgdbExternalGameDto;
import com.kevinleader.bgr.dto.igdb.IgdbGameDto;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Collection;

@Component
public class IgdbClient {

    private static final int STEAM_CATEGORY = 1;
    private static final int SINGLE_PLAYER_MODE = 1;
    private static final String COVER_URL_TEMPLATE =
            "https://images.igdb.com/igdb/image/upload/t_cover_big/%s.jpg";

    // Apicalypse clauses -- each segment must not include a trailing semicolon;
    // fetchGames() assembles the final query and adds semicolons between clauses.
    private static final String FIELDS =
            "fields id,name,summary,rating,rating_count,platforms,genres," +
            "first_release_date,cover.image_id,url,game_modes," +
            "external.steam," +
            "external_games.uid,external_games.category," +
            "age_ratings.rating_category.rating,age_ratings.organization.name";

    private final RestClient igdbRestClient;
    private final RestClient twitchRestClient;
    private final String clientId;
    private final String clientSecret;
    private final String authUrl;
    private final int minRatingCount;

    private String cachedToken;
    private Instant tokenExpiry = Instant.EPOCH;

    public IgdbClient(
            @Qualifier("igdbRestClient") RestClient igdbRestClient,
            @Qualifier("twitchRestClient") RestClient twitchRestClient,
            @Value("${igdb.client-id}") String clientId,
            @Value("${igdb.client-secret}") String clientSecret,
            @Value("${igdb.auth-url}") String authUrl,
            @Value("${cache.min-rating-count}") int minRatingCount) {
        this.igdbRestClient = igdbRestClient;
        this.twitchRestClient = twitchRestClient;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.authUrl = authUrl;
        this.minRatingCount = minRatingCount;
    }

    private synchronized String getAccessToken() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiry.minusSeconds(60))) {
            return cachedToken;
        }
        URI uri = UriComponentsBuilder.fromUriString(authUrl)
                .queryParam("client_id", clientId)
                .queryParam("client_secret", clientSecret)
                .queryParam("grant_type", "client_credentials")
                .build().toUri();
        IgdbAuthResponse response = twitchRestClient.post()
                .uri(uri)
                .retrieve()
                .body(IgdbAuthResponse.class);
        if (response == null || response.accessToken() == null) {
            throw new IllegalStateException("IGDB auth failed: no access token returned from Twitch");
        }
        cachedToken = response.accessToken();
        tokenExpiry = Instant.now().plusSeconds(response.expiresIn());
        return cachedToken;
    }

    public List<IgdbGameDto> fetchGames(int offset, int limit) {
        String token = getAccessToken();
        String query = FIELDS + "; " +
                "where rating_count >= " + minRatingCount + "; " +
                "limit " + limit + "; " +
                "offset " + offset + ";";
        return igdbRestClient.post()
                .uri("/games")
                .header("Client-ID", clientId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.TEXT_PLAIN)
                .body(query)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }

    /** Resolves a bounded set of Steam AppIDs without the broad catalog rating filter. */
    public List<SteamGameMatch> fetchGamesBySteamAppIds(Collection<Integer> steamAppIds) {
        if (steamAppIds == null || steamAppIds.isEmpty()) return List.of();
        String token = getAccessToken();
        String ids = steamAppIds.stream().map(String::valueOf).map(id -> "\"" + id + "\"")
                .collect(java.util.stream.Collectors.joining(","));
        List<IgdbExternalGameDto> externalGames = igdbRestClient.post()
                .uri("/external_games")
                .header("Client-ID", clientId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.TEXT_PLAIN)
                .body("fields category,game,uid; where uid = (" + ids + ");")
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
        if (externalGames == null || externalGames.isEmpty()) return List.of();
        List<IgdbExternalGameDto> steamExternalGames = externalGames.stream()
                .filter(externalGame -> externalGame.category() != null && externalGame.category() == STEAM_CATEGORY)
                .filter(externalGame -> externalGame.game() != null)
                .toList();
        String gameIds = steamExternalGames.stream().map(IgdbExternalGameDto::game)
                .map(String::valueOf).distinct().collect(java.util.stream.Collectors.joining(","));
        if (gameIds.isEmpty()) return List.of();
        List<IgdbGameDto> games = igdbRestClient.post()
                .uri("/games")
                .header("Client-ID", clientId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.TEXT_PLAIN)
                .body(FIELDS + "; where id = (" + gameIds + ");")
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
        if (games == null || games.isEmpty()) return List.of();
        java.util.Map<Long, IgdbGameDto> gamesById = games.stream()
                .filter(game -> game.id() != null)
                .collect(java.util.stream.Collectors.toMap(IgdbGameDto::id, game -> game, (left, right) -> left));
        return steamExternalGames.stream()
                .map(externalGame -> toSteamGameMatch(externalGame, gamesById.get(externalGame.game())))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private SteamGameMatch toSteamGameMatch(IgdbExternalGameDto externalGame, IgdbGameDto game) {
        if (game == null) return null;
        try {
            return new SteamGameMatch(Integer.parseInt(externalGame.uid()), game);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    public record SteamGameMatch(int steamAppId, IgdbGameDto game) {
    }

    public static String buildCoverUrl(String imageId) {
        return String.format(COVER_URL_TEMPLATE, imageId);
    }

    public static boolean isSinglePlayer(List<Integer> gameModes) {
        return gameModes != null && gameModes.contains(SINGLE_PLAYER_MODE);
    }

    /**
     * Resolves Steam app id: prefers IGDB {@code external.steam}, then the legacy
     * {@code external_games} list (category Steam = 1).
     */
    public static Integer resolveSteamAppId(IgdbGameDto dto) {
        if (dto == null) {
            return null;
        }
        if (dto.external() != null && dto.external().steamAppId() != null) {
            return dto.external().steamAppId();
        }
        return extractSteamAppId(dto.externalGames());
    }

    /**
     * Picks a Steam app id from IGDB external games. Uses the first matching Steam
     * ({@code category} 1) row after filter — IGDB order is relied on; numeric min/max across ids
     * would be wrong (newer games have larger app ids than older bundles/demos).
     */
    public static Integer extractSteamAppId(List<IgdbExternalGameDto> externalGames) {
        if (externalGames == null) return null;
        return externalGames.stream()
                .filter(e -> e.category() != null && e.category() == STEAM_CATEGORY && e.uid() != null)
                .map(e -> {
                    try { return Integer.parseInt(e.uid()); }
                    catch (NumberFormatException ex) { return null; }
                })
                .filter(id -> id != null)
                .findFirst()
                .orElse(null);
    }
}
