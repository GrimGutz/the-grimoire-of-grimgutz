# Adding a subclass

Use this order to keep subclasses compatible with dnd5e advancement and module automation.

1. Extract only the requested subclass.
   - Record parent class, subclass name, level table, feature levels, spell lists, resources, and deterministic automation.
   - Do not merge unrelated class options into the same source file.

2. Add pack source files.
   - Subclass card: `src/packs/<subclass-id>-subclass.mjs`
   - Feature cards: `src/packs/<subclass-id>-features.mjs`
   - Optional subclass spells/items: separate `src/packs/<subclass-id>-spells.mjs` or `*-equipment.mjs`.

3. Wire pack aggregators.
   - Add subclass import/spread in `src/packs/subclasses.mjs`.
   - Add feature import/spread in `src/packs/features.mjs`.
   - Add spell or equipment imports only if those documents exist.

4. Preserve dnd5e subclass data.
   - Set the parent class identifier correctly, for example `wizard`.
   - Set feature prerequisites/levels exactly as the subclass grants them.
   - If the subclass grants prepared/known spells, represent them as item grants or documented manual choices unless the path is stable.

5. Add automation only when it is deterministic.
   - Runtime behavior belongs under `scripts/automation/subclasses/`.
   - Temporary effects and passive-effect helpers belong under `scripts/automation/effects/`.
   - Midi-QOL hooks belong under `scripts/automation/midi/`.
   - Conditional reactions, rerolls, and choices should stay as item actions/macros unless fully triggerable.
   - Pack source should use simple `automation` / `actionData`; the canonical nested config is generated automatically. See `docs/AUTOMATION_CONFIG.md`.

6. Update validation.
   - Expected subclass and feature counts in `tools/validate.mjs`.
   - Parent class identifier checks.
   - Feature level checks.
   - Runtime token checks only if the subclass has runtime automation.

7. Update `README.md`.
   - Add content bullet.
   - Mention parent class and automated parts.

8. Verify.
   - `node -e "import('./scripts/automation.mjs')"`
   - `npm run check`

Rule of thumb: subclass identity goes in `subclasses`; actual playable powers go in `features`; runtime behavior goes in the matching automation folder.
