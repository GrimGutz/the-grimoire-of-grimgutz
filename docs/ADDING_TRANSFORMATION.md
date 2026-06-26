# Adding a transformation

Use this order so transformation cards, feature cards, and automation stay separated.

1. Extract only the requested transformation.
   - Stop when another transformation or unrelated rule starts.
   - Record requirements, transformation save DC, level milestones, benefits, flaws, choices, and deterministic automation.

2. Split documents by purpose.
   - Main transformation card: `src/packs/<transformation-id>-transformation.mjs`
   - All benefits, flaws, and selectable upgrades: `src/packs/<transformation-id>-features.mjs`
   - The `transformations` compendium should contain only the main transformation card.
   - The `features` compendium should contain transformation features and flaws.

3. Wire pack aggregators.
   - Add transformation import/spread in `src/packs/transformations.mjs`.
   - Add feature import/spread in `src/packs/features.mjs`.

4. Apply the module transformation level model.
   - Character levels 1-5 unlock transformation level I.
   - Character levels 6-10 unlock transformation level II.
   - Character levels 11-15 unlock transformation level III.
   - Character levels 16-20 unlock transformation level IV.
   - Level I grants all base benefits and the level I flaw.
   - Later levels grant the new flaw and require choosing one benefit from the current or previous unlocked levels.

5. Add automation only when it is deterministic.
   - Runtime behavior belongs under `scripts/automation/transformations/`.
   - Passive effects should use stable dnd5e paths only.
   - Conditional benefits should be an active item, macro, or Midi-QOL hook instead of a permanent passive effect.

6. Update validation and linking.
   - Expected transformation and feature counts in `tools/validate.mjs`.
   - Required flags such as `transformation`, `transformationFeature`, `minimumLevel`, and choice metadata.
   - Runtime token checks only for features with real runtime automation.

7. Update `README.md`.
   - Add the transformation to the content list.
   - Document what is automatic and what remains GM-confirmed.

8. Verify.
   - `node -e "import('./scripts/automation.mjs')"`
   - `npm run check`

Rule of thumb: the transformation card is the entry point; every benefit/flaw is a feature card; automation lives outside `src/packs/`.
