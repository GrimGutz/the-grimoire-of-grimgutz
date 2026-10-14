# Transformation automation

Put transformation-specific automation here.

Current modules:

- `index.mjs` — transformation action routing and aggregate passive/level sync.
- `hollow.mjs` — Hollow transformation level sync, Anti-Magic Charges, and passive effects.
- `murderspawn.mjs` — Murderspawn level sync and passive effects.
- `arkane*.mjs` — Presence: tier/passive sync, shared native costs, actions, movable storm zones, spell immunity/barrier lifecycle and event hooks. See `docs/ARKANE.md`.
- `dullahan*.mjs` — Dullahan: oath, mounted resistance, burning areas, native damage/saves, summons and GM-confirmed rituals. See `docs/DULLAHAN.md`.

Keep transformation cards and feature cards in `src/packs/*-transformation.mjs`; keep level sync, resources, and runtime effects here.
