CREATE TABLE user_game (
    id                 BIGSERIAL    PRIMARY KEY,
    user_id            BIGINT       NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    igdb_game_id       BIGINT       REFERENCES game_cache(igdb_game_id) ON DELETE SET NULL,
    steam_app_id       INTEGER      NOT NULL,
    steam_title        VARCHAR(255) NOT NULL,
    steam_source       VARCHAR(50)  NOT NULL,
    playable           BOOLEAN      NOT NULL DEFAULT TRUE,
    exclude_reason     VARCHAR(255),
    playtime_minutes   INTEGER      NOT NULL DEFAULT 0 CHECK (playtime_minutes >= 0),
    acquired_at        DATE,
    last_played_at     DATE,
    imported_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, steam_app_id)
);

CREATE INDEX idx_user_game_igdb_game_id  ON user_game (igdb_game_id);
CREATE INDEX idx_game_cache_steam_app_id ON game_cache (steam_app_id);
