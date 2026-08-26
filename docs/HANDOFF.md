# Handoff

## Latest snapshot (2026-08-26)

**Steam metadata enrichment is now usable:** My Games exposes **Find game details**, which batches the authenticated user's unmatched Steam AppIDs through IGDB, saves the returned metadata in `game_cache`, links resolved `UserGame` rows, shows an indeterminate progress state, and reports matched versus unmatched counts. Next automatically uses the enriched rows on its next request.

**Files touched:**
- `frontend/src/pages/MyGamesPage.*`, `frontend/src/api/userGames.ts`, `frontend/src/types/index.ts` — user-triggered enrichment action, lifecycle, and result reporting.

**Verification:** `backend/mvnw.cmd test` green (77 tests). `frontend` production build green (`tsc -b && vite build`).

**Next sensible step:** Deploy this frontend alongside the already committed enrichment backend, run Find game details from My Games, then revisit Next with the reported match count.

---

## Latest snapshot (2026-08-26)

**Next v1 added:** Authenticated users can open `/next`, select a time-neutral session length and energy level, and receive three visual game picks with plainly stated reasons. The server evaluates the complete playable library, excludes Completed/Dropped, prioritizes unplayed and currently Playing games, then applies cached IGDB rating and HLTB commitment heuristics. The first picker intentionally does not claim genre, mood, or AI reasoning yet. Navigation now exposes Next as the primary signed-in experience.

**IGDB descriptions introduced:** V14 adds `game_cache.igdb_summary`; the IGDB cache sync requests and stores `summary`, and Next displays it when a user-game cache match exists. The page retains a clear fallback for unavailable metadata.

**Files touched:**
- `backend/src/main/resources/db/migration/V14__add_igdb_summary.sql`, `entity/GameCache.java`, `dto/igdb/IgdbGameDto.java`, `client/IgdbClient.java`, `service/IgdbSyncService.java` — cached description support.
- `backend/src/main/java/com/kevinleader/bgr/dto/nextplay/`, `controller/NextPlayController.java`, `service/NextPlayPickService.java` — picker request/response contract and deterministic shortlist logic.
- `backend/src/test/java/com/kevinleader/bgr/client/IgdbClientResolveSteamTest.java`, `service/NextPlayPickServiceTest.java` — IGDB DTO compatibility and picker behavior coverage.
- `frontend/src/pages/NextPage.*`, `api/nextPlay.ts`, `types/index.ts`, `main.tsx`, `components/Nav.tsx` — Next questionnaire and visual picks interface.
- `README.md`, `docs/DECISIONS.md`, `docs/NEXT_STEPS.md`, `docs/HANDOFF.md` — current behavior and priorities.

**Verification:** `backend/mvnw.cmd test` green (77 tests). `frontend` production build green (`tsc -b && vite build`).

**Open risks:** The actual Steam Family library currently has sparse `GameCache` matches, so many picks may lack cover art and descriptions until cache coverage is improved. V14 descriptions only populate after an IGDB sync; re-import the CSV afterward to link any now-matched rows.

**Next sensible step:** Deploy backend and frontend together, run the IGDB sync, re-import the real CSV, then use Next repeatedly with different selections and capture which picks/reasons feel wrong.

---

## Latest snapshot (2026-08-26)

**Personal statuses added to My Games:** `UserGame` now has an optional user-managed status: Backlog, Playing, Completed, or Dropped. Existing and imported games begin uncategorized; Steam playtime remains a separate fact and re-imports preserve a status for a game still in the CSV. My Games has a status filter, including Not categorized, and a compact per-game selector. `PATCH /users/me/games/{steamAppId}/status` updates only the authenticated user's matching library row.

**Files touched:**
- `backend/src/main/resources/db/migration/V13__add_user_game_status.sql`, `entity/UserGame.java`, `entity/UserGameStatus.java` — nullable constrained status persistence.
- `backend/src/main/java/com/kevinleader/bgr/dto/usergame/`, `UserGameController.java`, `UserGameService.java` — status query/result contract and authenticated update endpoint.
- `backend/src/test/java/com/kevinleader/bgr/service/SteamFamilyLibraryImportServiceTest.java`, `UserGameServiceTest.java`, `controller/UserGameControllerTest.java` — filter, endpoint delegation, and import-preservation coverage.
- `frontend/src/api/userGames.ts`, `frontend/src/types/index.ts`, `frontend/src/pages/MyGamesPage.*` — status filter and inline editing.
- `docs/DECISIONS.md`, `docs/NEXT_STEPS.md`, `docs/HANDOFF.md` — status and import semantics.

**Verification:** `backend/mvnw.cmd test` green (75 tests). `frontend` production build green (`tsc -b && vite build`).

**Next sensible step:** Deploy backend and frontend together so Railway applies V13, then assign a few real-game statuses and assess the My Games workflow before expanding it.

---

## Latest snapshot (2026-08-26)

**Steam-library re-imports now replace the prior snapshot:** After full CSV validation, the importer updates or creates rows present in the export and deletes only the authenticated user's rows that are absent. The import result and My Games feedback report the removed count. This makes the small `local-data/library-test.csv` fixture a useful replacement-library test.

**Files touched:**
- `backend/src/main/java/com/kevinleader/bgr/service/SteamFamilyLibraryImportService.java`, `dto/usergame/SteamFamilyImportResultDto.java` — per-user snapshot reconciliation and removed count.
- `backend/src/test/java/com/kevinleader/bgr/service/SteamFamilyLibraryImportServiceTest.java`, `UserGameControllerTest.java` — result contract and stale-row removal coverage.
- `frontend/src/types/index.ts`, `frontend/src/pages/MyGamesPage.tsx` — display the removed count.
- `docs/DECISIONS.md`, `docs/HANDOFF.md` — updated import semantics.

**Verification:** `backend/mvnw.cmd test` green (73 tests). `frontend` production build green (`tsc -b && vite build`).

**Next sensible step:** Import `local-data/library-test.csv`; My Games should show four playable games. Re-import the full `local-data/library.csv` afterward to restore the full library.

---

## Latest snapshot (2026-08-26)

**Import progress revised:** CSV imports no longer abort automatically after 60 seconds, because Railway may be slow while still processing a valid library. The UI now has an indeterminate import bar, a clear refresh stage until the updated library query resolves, a “still importing” message after one minute, and an explicit Cancel control. A cancelled request tells the user to refresh in case the server completed before cancellation.

**Files touched:**
- `frontend/src/pages/MyGamesPage.tsx`, `MyGamesPage.css` — visible two-stage import lifecycle, long-import messaging, and explicit cancellation.

**Verification:** `frontend` production build green (`tsc -b && vite build`).

**Next sensible step:** Commit and deploy this correction, then let one import finish without closing the page. If it does not complete, inspect the Railway request logs rather than adding another client timeout.

---

## Latest snapshot (2026-08-26)

**My Games metadata fallback refined:** The library table now hides cover, genre, and rating columns when the current result page has no cache enrichment, leaving a dense Steam-facts table rather than empty placeholders and colliding headers. The genre filter also hides when no matched metadata supplies genres. Import feedback now reports whether any rows matched cached metadata, making sparse matching observable on the next import.

**Files touched:**
- `frontend/src/pages/MyGamesPage.tsx` — conditional cache-metadata columns/filter and import match feedback.

**Verification:** `frontend` production build green (`tsc -b && vite build`).

**Open risk:** Current imported rows appear to have little or no `GameCache` enrichment. Re-import after this deploy to see the exact match count, then investigate cache Steam AppID coverage if it remains near zero.

**Next sensible step:** Commit and deploy this UI fallback; then re-import `local-data/library.csv` and use the displayed cache-match count to decide whether a cache-coverage repair is needed.

---

## Latest snapshot (2026-08-26)

**My Games first-import UI refined:** The page now gives Steam Family CSV import its own full-width action band, with a styled file chooser and clear selected-file state. Before an import, it shows an honest empty-library prompt instead of filters plus a misleading “no games match” result. Filters stay visible once games exist or when they are actively narrowing a result set. Navigation now marks the current My Games or Value Rankings location.

**Local follow-up fixes (not deployed until next push):** `frontend/vercel.json` now rewrites direct routes to `index.html`, so refreshes on `/signup` and `/my-games` do not receive a Vercel 404. CSV imports now abort after 60 seconds and return an actionable timeout message rather than leaving the control indefinitely in an importing state. Railway’s production CORS preflight for `https://mynextplay.vercel.app` was verified as successful after the variable correction.

**Files touched:**
- `frontend/src/pages/MyGamesPage.tsx`, `MyGamesPage.css`, `frontend/src/api/client.ts`, `frontend/src/api/userGames.ts`, `frontend/vercel.json` — import band, selected file state, conditional filters, first-import empty state, bounded import request, and Vercel SPA routing.
- `frontend/src/components/Nav.tsx`, `Nav.css` — active navigation state.

**Verification:** `frontend` production build green (`tsc -b && vite build`).

**Next sensible step:** Push and deploy this visual cleanup, finish the Railway CORS correction, then import `local-data/library.csv` through My Games.

---

## Latest snapshot (2026-08-26)

**My Games browse vertical slice complete:** Authenticated users can use `GET /users/me/games` to browse their playable Steam Family library and can open `/my-games` to import a CSV and browse a dense, paginated table. The view supports title search, played/unplayed, owned/family-shared, and matched-genre filters, plus title/playtime/last-played sorting. Library rows always retain Steam title/source/playtime; optional `GameCache` matches add cover, IGDB rating, and genre metadata.

**Files touched:**
- `backend/src/main/java/com/kevinleader/bgr/dto/usergame/`, `UserGameService.java`, `UserGameController.java`, `UserGameRepository.java` — paginated browse contract, filtering/sorting, and a fetch-joined cache relation for the existing `user_game` data.
- `backend/src/test/java/com/kevinleader/bgr/service/UserGameServiceTest.java`, `UserGameControllerTest.java` — browse filtering, metadata enrichment, pagination, and updated controller construction coverage.
- `frontend/src/pages/MyGamesPage.*`, `frontend/src/api/userGames.ts`, `frontend/src/api/client.ts`, `frontend/src/types/index.ts`, `frontend/src/main.tsx`, `frontend/src/components/Nav.tsx` — `/my-games` route, authenticated CSV import, library table, and navigation to both My Games and Value Rankings.
- `docs/DECISIONS.md`, `docs/NEXT_STEPS.md`, `docs/HANDOFF.md` — browse behavior decision and revised priority list.

**Verification:** `backend/mvnw.cmd test` green (72 tests). `frontend` production build green (`tsc -b && vite build`). `frontend` lint still fails on pre-existing React 19 rule violations in `MultiSelect.tsx`, `OnboardingModal.tsx`, `SavedConfigs.tsx`, `AuthContext.tsx`, `OnboardingContext.tsx`, and `RankingsPage.tsx`; the new My Games page has no remaining lint finding.

**Open risks / blockers:** No production migration was added, and the real CSV has not yet been imported through the deployed UI. The browse query operates in memory over one user's roughly 1,000-row library after a fetch join; appropriate for this first personal-library slice, but revisit database-side filtering if libraries grow materially.

**Next sensible step:** Deploy, import `local-data/library.csv` while authenticated, and use My Games with the actual library before designing user-managed statuses.

---

## Latest snapshot (2026-08-26)

**NextPlay rename complete:** The product is now branded **NextPlay**. The existing public ranking experience is labeled **Value Rankings** and remains intact. The first-stage rename updates user-facing branding, frontend metadata/assets, Maven and Spring application identity, and current product documentation without changing routes, database schema/history, Java packages, or browser-storage keys.

**Files touched:**
- `README.md` — reframed the app as a personal game-library product and documented Value Rankings as a retained feature.
- `frontend/index.html`, `frontend/src/components/Nav.tsx`, `frontend/src/pages/RankingsPage.tsx`, `frontend/package.json`, `frontend/package-lock.json` — NextPlay branding, Value Rankings page label, and frontend package metadata.
- `frontend/public/nextplay_favicon*` — renamed former BGR favicon assets; SVG accessibility label updated.
- `backend/pom.xml`, `backend/src/main/resources/application.properties` — `nextplay-backend` Maven and Spring application identity.
- `docs/PHI_PROJECT_INSTRUCTIONS.md`, `docs/PHI_AND_CID.md`, `docs/DECISIONS.md`, `docs/NEXT_STEPS.md` — updated product context, decisions, and priorities.

**Verification:** `backend/mvnw.cmd test` green (70 tests). `frontend` production build green (`tsc -b && vite build`).

**Open risks / blockers:** GitHub repository, local directory, Railway project, Vercel project, and domains have not been renamed. Rename those outside this commit and then update `origin` to the new GitHub repository URL. No database migration is part of the product rename.

**Next sensible step:** Continue the NextPlay My Games vertical slice with the paginated browse API, then the frontend library view and import control.

---

## Latest snapshot (2026-08-26)

**Steam Family CSV import backend complete:** Authenticated users can now upload an export to `POST /users/me/games/import/steam-family` using multipart field `file`. The importer validates the complete file before saving, upserts by `(user_id, steam_app_id)`, preserves Steam facts, and links `game_cache` metadata only for unambiguous AppID matches. It does not delete rows missing from a later export.

**Files touched:**
- `AGENTS.md`, `docs/PHI_AND_CID.md`, `docs/DECISIONS.md` — updated Cid wording so it is implementation-agent/tool-independent, not Cursor-specific; recorded import decisions.
- `backend/src/main/resources/db/migration/V12__create_user_game.sql` — creates `user_game` with user association, optional `game_cache` match, Steam AppID/title/source/playability/playtime/date fields, uniqueness on `(user_id, steam_app_id)`, a foreign-key index, and an index for cache matching by Steam AppID.
- `backend/src/main/java/com/kevinleader/bgr/entity/UserGame.java` — JPA entity for imported user library rows.
- `backend/src/main/java/com/kevinleader/bgr/repository/UserGameRepository.java`, `GameCacheRepository.java` — import lookup methods.
- `backend/src/main/java/com/kevinleader/bgr/service/SteamFamilyLibraryImportService.java` — CSV parsing, validation, matching, and upsert logic.
- `backend/src/main/java/com/kevinleader/bgr/controller/UserGameController.java` — authenticated multipart import endpoint.
- `backend/src/main/java/com/kevinleader/bgr/dto/usergame/SteamFamilyImportResultDto.java` — import counts returned to the client.
- `backend/src/test/java/com/kevinleader/bgr/service/SteamFamilyLibraryImportServiceTest.java`, `UserGameControllerTest.java` — parser/match/upsert and controller delegation coverage.
- `backend/pom.xml` — Apache Commons CSV parser dependency.

**Verification:** `backend/mvnw.cmd test` green (70 tests). Existing tests do not start PostgreSQL/Flyway, so V12 is compile-reviewed but not migration-tested against a database.

**Open risks / blockers:** No My Games browse endpoint or UI yet. No status field yet; this avoids prematurely labeling imported library games as backlog/completed/dropped before the app has status-management UI. Cache metadata coverage depends on the existing rating-filtered IGDB cache, so unmatched Steam records intentionally fall back to their Steam title.

**Next sensible step:** Add paginated `GET /users/me/games` with playable/played/source/title filters and title/playtime sorting, then build the My Games page and upload control.

---

## Latest snapshot (2026-04-19)

**Admin API:** Full reference and **when to use each sync endpoint** — `docs/ADMIN_API.md`. Partial sync: `POST /admin/sync/cheapshark`, `/admin/sync/hltb`, `/admin/sync/igdb`, `/admin/sync/price-estimation`; full pipeline `POST /admin/sync`; HLTB reset+full `POST /admin/hltb-resync`. All share the cache lock (**409** if busy).

---

## Previous snapshot (2026-04-19)

**CheapShark sync bug fixed:** `CheapSharkClient` was calling `GET /games?steamAppID={id}` and deserializing the JSON array response as a single `CheapSharkGameDto`. Jackson silently failed; `cheapshark_price_cents` was never written for any game; every game with a Steam ID fell back to the $14.99 PC tier estimate. Fixed with a two-step lookup: (1) search by Steam App ID to get CheapShark `gameID`, (2) fetch deals by that ID (`GET /games?id={gameID}`). Added `CheapSharkSearchResultDto` to model the search response array element.

**Files touched:**
- `backend/src/.../client/CheapSharkClient.java` — two-step lookup replacing single call
- `backend/src/.../dto/cheapshark/CheapSharkSearchResultDto.java` — new record for search result array element

**Verification:** `./mvnw compile` clean. No existing CheapShark tests.

**Required action:** `POST /admin/sync` after deploying to populate real `cheapshark_price_cents` values. All current DB rows have null — estimates are the only prices right now.

---

## Previous snapshot (2026-04-18)

**Pricing fix (2026-04-19):** `GameCache.getEffectivePriceCents()` **prefers `cheapshark_price_cents` when set**, else tier estimate (removed **`min(cs, est)`** that forced ~**$14.99** over higher Steam deals). Deploy backend only; no migration. If UI still shows mostly **Est.** / **$14.99**, **`cheapshark_price_cents`** is often null — check sync logs / DB coverage, not only app code (`docs/DECISIONS.md`).

**Rankings / UI**

- **Grid cards:** Title (2-line fixed height) → **meta row**: platforms **left**, content rating **right** (or —). **Stats row:** site **favicon** + value score (first), ⭐ IGDB rating, price, playtime; value is not a giant hero number. **Links:** price → CheapShark deal if present, else **Steam** when `steamAppId` and `priceCents` > 0; ⭐ → IGDB only when `igdbUrl` is non-empty; **HLTB** only when API sends **`hltbFound: true`** (real HLTB match, not genre fallback). Table price uses same link rules.
- **Playtime filter:** Min/Max **number inputs only** (dual-range **slider removed**). Advanced Scoring still uses **range inputs** for weights.
- **Saved configs:** `exclude_adult_rated` (V11); onboarding **merges** into current filters (weights preserved). `SavedConfigs` summary includes hide-M/18+ when set.
- **Favicon:** `frontend/index.html` + multi-format assets in `frontend/public/` (`favicon.ico`, `bgr_favicon.svg`, PNGs, apple-touch).
- **About copy:** “How does the value score work?” includes a **Grid cards** paragraph (icons, when links appear, HLTB rule).

**API**

- `RankingResultDto` / JSON: `steamAppId`, `platformIds`, `ageRatingDisplay`, **`hltbFound`**, **`priceIsTrackedDeal`** (true when displayed price is from CheapShark, false when tier estimate; suppressed for nominal free substitute). Grid/table show **Deal** / **Est.** badges. **Deploy backend + frontend together** when adding DTO fields.

**Pricing (US-first, product intent)**

- Canonical display/ranking price: **CheapShark** when set, else **`estimated_price_cents`**. Steam store link is for **navigation**, not necessarily the number shown. **No** multi-region pricing slice shipped; USD baseline per `docs/DECISIONS.md`. Trust issues (e.g. wrong deal / estimate) = **sync + coverage + UI labeling** (“deal” vs “est.”), not solved by this handoff.

**Wishlist**

- DB: **`wishlist_entry`** (V3) + **`WishlistEntry`** entity. **No REST/UI** wired yet — logical start for **Wishlist Watchtower** (`docs/NEXT_STEPS.md`).

## Files recently relevant

- `frontend/src/pages/RankingsPage.tsx` + `RankingsPage.css` — filters, cards, table, `cardPriceHref`, `canLinkHltbSearch`, `igdbPageUrl`, meta row
- `frontend/src/types/index.ts` — `RankingResult` (`hltbFound`, etc.)
- `frontend/index.html` + `frontend/public/bgr_favicon*` — favicon set
- `backend/.../dto/ranking/RankingResultDto.java` — includes `hltbFound`
- `backend/.../service/RankingService.java` — `toRankingResult` maps `hltbFound`
- `backend/.../entity/WishlistEntry.java` + `V3__create_wishlist.sql` — wishlist persistence only

## Verification (last known)

- `backend/mvnw.cmd test` — green (includes `hltbFound` JSON assertions in `RankingControllerTest`).
- `frontend/npm run build` — green.

## Open risks / notes

- Rankings are in-memory after cache fetch; `POST /admin/sync` synchronous.
- JWT not revoked on deactivate/role change.
- Desktop-first CSS; mobile pass still backlog.
- HLTB: long resyncs / session limits — see logs if odd playtime coverage.
- **My Setup:** `upsertMySetup` now sends **rating/playtime/price weights** from `bgr_last_ranking_filters` when present, else preserves existing saved weights, else defaults to 1 — avoids wiping weights on wizard save.

## Next sensible step (new chat)

1. **Wishlist Watchtower v1** — repository + service + `GET/POST/DELETE` (or similar) for wishlist; minimal UI from rankings (e.g. “Add” + `/wishlist` page). Pair with **game detail** later if desired (`docs/NEXT_STEPS.md`).
2. **US price trust** — audit CheapShark coverage / `steam_app_id`; optional UI badge for deal vs estimate; optional Steam list-price research spike (separate from link).

## paper-mcp

Project page ID: `jd7fbgc841fk9pt764973gwvax84nxy6`  
Read or post at [paper.ruixen.app](https://paper.ruixen.app)
