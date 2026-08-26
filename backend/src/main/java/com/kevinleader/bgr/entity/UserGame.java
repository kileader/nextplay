package com.kevinleader.bgr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(
        name = "user_game",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "steam_app_id"})
)
@Getter @Setter @NoArgsConstructor
public class UserGame {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "igdb_game_id", referencedColumnName = "igdb_game_id")
    private GameCache gameCache;

    @Column(name = "steam_app_id", nullable = false)
    private Integer steamAppId;

    @Column(name = "steam_title", nullable = false)
    private String steamTitle;

    @Column(name = "steam_source", nullable = false, length = 50)
    private String steamSource;

    @Column(nullable = false)
    private boolean playable = true;

    @Column(name = "exclude_reason")
    private String excludeReason;

    @Column(name = "playtime_minutes", nullable = false)
    private int playtimeMinutes = 0;

    @Column(name = "acquired_at")
    private LocalDate acquiredAt;

    @Column(name = "last_played_at")
    private LocalDate lastPlayedAt;

    @Column(name = "imported_at", nullable = false)
    private OffsetDateTime importedAt = OffsetDateTime.now();

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
