# Next Steps

## Start here (NextPlay, 2026-08-26)

1. **Use My Games with the real Steam Family CSV** — deploy the browse API and `/my-games`, import `local-data/library.csv`, then assess cache-match coverage and table usability with the full library.
2. **Personal game statuses** — add explicit backlog/playing/completed/dropped semantics only after the imported library has been exercised; do not infer status from Steam playtime.
3. **Value Rankings maintenance** — retain the existing ranking feature, but keep product and pricing trust scope focused on reliable tracked PC prices; do not expand console price estimation.
4. **Wishlist Watchtower (v1)** — `wishlist_entry` + `WishlistEntry` exist but remain unwired; revisit after status semantics so wishlist can potentially become a `UserGame` status.
5. **Game detail page** (`/game/:id`) — pairs with personal library/wishlist.

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
