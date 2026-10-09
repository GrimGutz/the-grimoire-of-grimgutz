# Adding a prestige class

Use this order to avoid touching unrelated module systems.

1. Extract only the requested PDF section.
   - Stop when another class/subclass starts.
   - Record requirements, hit die, proficiencies, level table, feature names, and deterministic automation.

2. Add pack source files.
   - Class card: `src/packs/<class-id>-class.mjs`
   - Feature cards: `src/packs/<class-id>-features.mjs`
   - Export `*ClassDocuments`, `*Documents`, and `*Folders`.

3. Wire pack aggregators.
   - Add class import/spread in `src/packs/classes.mjs`.
   - Add feature import/spread in `src/packs/features.mjs`.

4. Add automation only when it is deterministic.
   - Runtime behavior belongs under `scripts/automation/classes/`.
   - Temporary effects and passive-effect helpers belong under `scripts/automation/effects/`.
   - Midi-QOL hooks belong under `scripts/automation/midi/`.
   - Avoid permanent effects for conditional rules unless the dnd5e path and trigger are stable.
   - Pack source should use simple `automation` / `actionData`; the canonical nested config is generated automatically. See `docs/AUTOMATION_CONFIG.md`.
   - Save/damage AoE uses the shared template/Midi flow, not utility rolls or manually selected failed saves. See `docs/AREA_AUTOMATION.md`.
   - Token-bound auras use `shared/aura-definitions.mjs` and the existing Region/event engines. Define the exact timing; movement must not deal damage repeatedly. See `docs/AURA_AUTOMATION.md`.

5. Update validation.
   - Expected class/feature counts in `tools/validate.mjs`.
   - Class document checks.
   - Feature group checks.
   - Runtime token checks only if the feature needs runtime automation.

6. Update `README.md`.
   - Add content bullet.
   - Add requirements section.
   - Mention what is automated and what remains GM-confirmed.

7. Verify.
   - `node -e "import('./scripts/automation.mjs')"`
   - `npm run check`

Rule of thumb: item/card generation goes in `src/packs/`; runtime behavior goes in `scripts/automation/`; validation goes in `tools/validate.mjs`.
