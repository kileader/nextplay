ALTER TABLE user_game
    ADD COLUMN status VARCHAR(20)
        CHECK (status IN ('BACKLOG', 'PLAYING', 'COMPLETED', 'DROPPED'));
