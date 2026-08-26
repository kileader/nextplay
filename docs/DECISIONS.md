# Decisions

## 2026-08-26

- **NextPlay product framing:** Rename the product from Budget Game Rankings to **NextPlay**. Keep the existing ranking implementation as **Value Rankings**, a feature within the broader personal-library product. Preserve API routes, database schema/history, Java packages, and existing browser-storage keys during this first-stage rename.
- **Value Rankings scope:** Treat reliable tracked PC pricing as the trusted scope for Value Rankings. Existing console tier estimates remain for compatibility but are not a foundation for NextPlay and should not be expanded as a pricing system.
- **My Games persistence:** Start the personal library foundation with a new **`user_game` / `UserGame`** model instead of evolving `wishlist_entry` immediately. `WishlistEntry` is narrow and not yet wired to REST/UI; leaving it untouched keeps the first Steam Family import slice non-destructive. Imported rows store per-user Steam relationship facts and optionally link to `game_cache` by matched `steam_app_id`.
- **Imported status:** Do **not** add a durable wishlist/backlog/playing/completed/dropped status in the first migration. A Steam Family CSV row means "in this user's Steam-family library"; explicit statuses should be added later with UI semantics rather than defaulting every imported playable game to backlog.
- **Steam import metadata:** Persist Steam AppID and the exporter facts that cannot be derived (title, source, playability, exclusion reason, playtime, and dates). Derive the store URL from the AppID instead of storing a duplicate value. Link `UserGame` to `GameCache` only when the Steam AppID match is unambiguous; preserve the Steam row without cache metadata otherwise.
- **Steam import behavior:** A CSV import validates the whole file before saving, then creates or updates rows by `(user_id, steam_app_id)`. It does not remove existing rows absent from a later export; snapshot reconciliation is deferred until the library has user-managed statuses and a clear confirmation flow.
- **My Games browse behavior:** The playable library view reads `UserGame` as the source of truth for title, access source, playtime, and playability. Matched `GameCache` data is optional enrichment for covers, ratings, and genres; an unmatched Steam row remains browseable and filterable by its Steam facts. Keep this first browse slice migration-free and defer explicit personal statuses.

## 2026-04-19

- **Ranking price assembly:** `GameCache.getEffectivePriceCents()` **prefers `cheapshark_price_cents` when set**, else tier estimate. (Earlier **`min(cs, est)`** incorrectly made the **$14.99 PC tier** beat higher Steam deal prices.) **`priceIsTrackedDeal`** and **`cheapshark_deal_url`** apply when the **displayed** cent value equals the CheapShark column. Nominal **free** substitute when `includeFreeToPlay` uses **$1.00** and is **not** flagged as a tracked deal.
- **Tier estimation:** `PriceEstimationService` unions IGDB **`platform_ids`** with **Windows (6)** whenever **`steam_app_id`** is present (Steam catalog ⇒ PC tier participates in the **lowest-tier pick** across platforms), including when IGDB omits PC from platforms. If **`platform_ids` is empty** but **`steam_app_id`** is set, only the PC tier is used (~$14.99 baseline). (Not the same as the old **`min(cheapshark, estimate)`** effective price.)
- **IGDB Steam id:** Sync requests **`external.steam`** and **`IgdbClient.resolveSteamAppId`** prefers that, then falls back to the **first** Steam row in **`external_games`** (`category` 1, parse `uid`). IGDB’s **`external`** map is the documented first-class Steam link; relying on **`external_games`** alone matched almost nothing. Numeric min/max across multiple Steam `uid`s was rejected — use first matching row after filter.
- **Admin partial cache sync:** `POST /admin/sync` runs the full nightly pipeline (IGDB → price estimation → CheapShark → HLTB). **`POST /admin/sync/igdb`**, **`/sync/price-estimation`**, **`/sync/cheapshark`**, **`/sync/hltb`** run a single phase each; all use the same **`CacheRefreshJob` lock** (409 if another job is in progress). **`POST /admin/hltb-resync`** (clear HLTB timestamps + full HLTB pass) also takes that lock. **When to use each** + full **`/admin`** route list: **`docs/ADMIN_API.md`**.
- **Phi vs Cid:** **Phi** = native ChatGPT (continuity/orientation; compass). **Cid** = implementation agent (tool/IDE-independent; scaffold). **`docs/PHI_AND_CID.md`**. **`docs/PHI_PROJECT_INSTRUCTIONS.md`** is NextPlay context **for Phi in ChatGPT**, not an in-repo agent.

## 2026-04-18

- **Handoff refresh:** `docs/HANDOFF.md` and `docs/NEXT_STEPS.md` rewritten for current rankings UI (grid meta row, favicon value score, conditional HLTB/IGDB/price links, `hltbFound` on API). Next product focus: **Wishlist Watchtower v1** (entity/DB exist; API/UI TBD).
- **US pricing scope:** Improve **US** trust (CheapShark + estimates + honest labeling) before multi-region or per-store API sprawl. Aligns with existing **USD canonical** baseline (2026-04-03).
- **HLTB outbound links:** Only when **`hltb_found`** is true in DB; genre (or other) fallback hours stay **plain text** so users are not sent to irrelevant HLTB search results.
- **My Setup + weights:** Onboarding save merges **Advanced Scoring** weights from `localStorage` (`bgr_last_ranking_filters`) or keeps existing **My Setup** config weights so `updateConfig` no longer resets them to 1.

## 2026-04-14

- **Optional shopping assistant:** ship as an **opt-in** feature. First slice: **runtime context** (current filters + API/ranking payload + user message). Add **retrieval / RAG** over the existing nightly **game cache DB** when answers need broader catalog grounding or context would exceed practical token limits. Nightly refresh + admin resync already match a KB-style cadence.

## 2026-04-04

- Agent instructions: **`AGENTS.md` is the single source of truth** for handoff/update rules. Root **`CLAUDE.md`** is a short pointer so Claude Code (and similar) still has a conventional entry file without duplicating content.
- **`.claude/`** project folder removed from the repo (was duplicate + local permission JSON). Recreate locally if a tool needs it. **`/.claude/settings.json`** is gitignored so local Claude Code permissions never show up as untracked churn.
- **Root `/.vscode/`** is gitignored so local VS Code settings do not appear as churn; `frontend/.vscode` remains governed by `frontend/.gitignore` (e.g. optional `extensions.json`).
- **`.cursor/rules/`** is tracked so Cursor rules are shared, not only on one machine.

## 2026-04-03

- Shared cross-agent project memory lives in repo files, not tool-local chat/session memory.
- The default handoff files are `docs/HANDOFF.md`, `docs/DECISIONS.md`, and `docs/NEXT_STEPS.md`.
- Agents should read those files before non-trivial work and update them after meaningful work.
- Keep Railway as the backend host path for now; optimize costs through refresh cadence and efficient read paths rather than changing platform.
- Treat USD as the canonical pricing baseline for now; international price display/localization is deferred.
- Phase 2 is considered complete with platform-tier estimated pricing included.
- Phase 3 is considered planted once the public ranking API, filters, sorting, pagination, validation, and tests are in place.
- Phase 4 is considered planted once signup, login, JWT, `/auth/me`, and admin route protection are in place.
