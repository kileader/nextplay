# Next Steps

## Start here (NextPlay, 2026-08-26)

1. **Exercise Next with the real library** — deploy current `/next`, run an IGDB sync to populate descriptions/genres, re-import `local-data/library.csv`, then judge whether time/energy, genre, Refresh, and Surprise me feel useful.
2. **Improve metadata coverage for My Games** — cache matching is currently sparse for the Steam Family export; investigate targeted metadata enrichment before treating the visual Next experience as complete.
3. **Generalize My Games for manual console entries** — evolve Steam-specific identity carefully so a user can add individual non-Steam games.
4. **Taste profile and mood/genre matching** — add simple editable preferences only after the time/energy picker has been exercised; AI remains optional and later.
5. **Wishlist Watchtower (v1)** — `wishlist_entry` + `WishlistEntry` exist but remain unwired; revisit after the personal-library model supports manual entries.

## Active queue (maintenance)

- **Production migrations** — confirm Railway (or host) has applied through **V11** (`exclude_adult_rated`) and prior ranking-config migrations.
- **Mobile-first CSS** — flip `max-width` → `min-width` where appropriate.
- **Onboarding vs weights** — **done:** My Setup upsert reads weights from `bgr_last_ranking_filters` or preserves existing config.

## Planned features

- **"No thanks"** — v1 shipped (localStorage). Optional: DB sync when logged in; hidden-list UI.
- **Commerce-first cover** — shipped (deal → Steam → IGDB). Deferred: affiliate params + disclosure.
- **HLTB deep links (optional)** — `hltb_game_id` on cache + DTO for direct game URLs (today: search URL when `hltbFound`).
- **Shopping assistant (optional)** — opt-in; RAG over nightly cache when needed (`docs/DECISIONS.md`).
- **Sale sniper / alerts** — CheapShark alert API; pairs with wishlist.
- **Community tagging** — backlog.

## Deferred / known gaps

- `POST /admin/sync` synchronous.
- Token revocation on deactivate — deferred.
- Token in localStorage — known XSS tradeoff.

## Usage

- Keep this file short; replace completed bullets instead of stacking stale history.
