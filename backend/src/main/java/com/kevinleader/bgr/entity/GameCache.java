package com.kevinleader.bgr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "game_cache")
@Getter @Setter @NoArgsConstructor
public class GameCache {

    @Id
    @Column(name = "igdb_game_id")
    private Long igdbGameId;

    @Column(nullable = false)
    private String title;

    @Column(name = "igdb_summary")
    private String igdbSummary;

    @Column(name = "igdb_rating", precision = 5, scale = 2)
    private BigDecimal igdbRating;

    @Column(name = "igdb_rating_count", nullable = false)
    private int igdbRatingCount = 0;

    @Column(name = "platform_ids", columnDefinition = "integer[]")
    private int[] platformIds = new int[0];

    @Column(name = "genre_ids", columnDefinition = "integer[]")
    private int[] genreIds = new int[0];

    @Column(name = "first_release_date")
    private LocalDate firstReleaseDate;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Column(name = "igdb_url")
    private String igdbUrl;

    @Column(name = "hltb_hours", precision = 6, scale = 2)
    private BigDecimal hltbHours;

    @Column(name = "hltb_found", nullable = false)
    private boolean hltbFound = false;

    @Column(name = "cheapshark_price_cents")
    private Integer cheapsharkPriceCents;

    @Column(name = "estimated_price_cents")
    private Integer estimatedPriceCents;

    @Column(name = "is_free", nullable = false)
    private boolean isFree = false;

    @Column(name = "is_multiplayer_only", nullable = false)
    private boolean isMultiplayerOnly = false;

    @Column(name = "steam_app_id")
    private Integer steamAppId;

    @Column(name = "cheapshark_deal_url")
    private String cheapsharkDealUrl;

    /** Content rating label from IGDB (e.g. ESRB · Teen); nullable when unknown. */
    @Column(name = "age_rating_display", length = 128)
    private String ageRatingDisplay;

    @Column(name = "last_igdb_sync")
    private OffsetDateTime lastIgdbSync;

    @Column(name = "last_hltb_sync")
    private OffsetDateTime lastHltbSync;

    @Column(name = "last_price_sync")
    private OffsetDateTime lastPriceSync;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    /**
     * Best available price in cents: CheapShark when present (per Steam sync), otherwise tier estimate.
     */
    public Integer getEffectivePriceCents() {
        Integer cs = cheapsharkPriceCents;
        if (cs != null) {
            return cs;
        }
        return estimatedPriceCents;
    }
}
