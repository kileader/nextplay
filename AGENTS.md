# Shared Agent Workflow

This repo supports handoffs between multiple coding agents.

**Personas:** Kevin uses **Phi** (native ChatGPT) for continuity/orientation and **Cid** (implementation agent; tool/IDE-independent) for implementation — see **`docs/PHI_AND_CID.md`**. Coding agents here act as **Cid** (scaffold), not Phi (compass).

## Read First

Before making non-trivial changes, read:

1. `docs/HANDOFF.md`
2. `docs/DECISIONS.md`
3. `docs/NEXT_STEPS.md`

## Update Rule

After meaningful work, update `docs/HANDOFF.md` with:

- what changed
- files touched
- verification performed
- open risks or blockers
- the next sensible step

If you make a durable project decision, append it to `docs/DECISIONS.md`.

If priorities change, update `docs/NEXT_STEPS.md`.

## Scope

Keep these notes short and operational. This is shared working memory, not polished documentation.
