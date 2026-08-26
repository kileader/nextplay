# Notes for Phi - NextPlay context (use in ChatGPT)

**Phi** here means **native ChatGPT** (Kevin's continuity/orientation assistant - see **`docs/PHI_AND_CID.md`**). This file is **not** for an in-repo agent named Phi; it is background you can paste or summarize when working with Phi on NextPlay.

**Cid** (implementation agent) should use `AGENTS.md` plus `docs/HANDOFF.md`, `docs/DECISIONS.md`, and `docs/NEXT_STEPS.md` for facts. If this file conflicts with those, **repo handoff docs win** for engineering truth.

Use this file together with the handoff trio for intent and priorities. If intent conflicts with code reality, flag it and prefer repo files for what is actually shipped.

---

## What this repo is

- **NextPlay** helps a user decide what to play next from games they already own or can access.
- **My Games** is the immediate foundation: imported library records, ownership/access source, playtime, and eventually personal statuses.
- **Value Rankings** is the retained ranking feature: a public rating/playtime/price view when reliable PC pricing exists.
- **Stack:** React + Spring Boot + Postgres + IGDB / CheapShark / HLTB sync. See `docs/HANDOFF.md` for the latest technical snapshot.

---

## Where product intent is right now

- Build the personal library before recommendations, alerts, or live Steam sync. The Steam Family CSV importer is the first ingestion path.
- **Value Rankings** remains useful, but reliable PC pricing is its scope. Do not make console price estimates or broad storefront pricing the foundation of NextPlay.
- Wishlist is a later personal-library feature, not an automatic immediate priority.
- Prefer small vertical slices that make Kevin's own library usable over speculative product abstractions.

---

## Default decision question

**What makes the accessible library more useful for deciding what to play next?**

Flag high product and engineering risk for work depending on real-time pricing, complete Steam coverage, or recommendation claims that outpace personal-library data.

---

## What to do when you land in the repo

1. Read **`docs/HANDOFF.md`** (latest snapshot first), then **`docs/NEXT_STEPS.md`**, then **`docs/DECISIONS.md`**.
2. Check **`docs/ADMIN_API.md`** if the task involves cache sync, ops, or Value Rankings pricing refresh.
3. Dates in docs should use the user's actual calendar date.

---

## Practical next moves (pick with the user)

| If the goal is... | Lean toward... |
|------------------|----------------|
| **Browse Kevin's library** | My Games browse API, then a dense usable frontend table with filtering and sorting. |
| **Choose what to play next** | First improve personal-library facts and statuses; do not build recommendations until the foundation is useful. |
| **More trustworthy Value Rankings prices** | Keep the scope to tracked PC deals, honest deal/estimate labeling, and cache-sync health. |
| **Wishlist** | Add it after My Games has a stable user-game foundation. |

---

## Style

- Practical, concise, scope-cutting.
- Separate now, later, and out of scope.
- Do not overpromise third-party data quality.
