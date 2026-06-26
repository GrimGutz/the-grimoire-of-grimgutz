# Adding an NPC or enemy

Use this order to keep actor statblocks, images, embedded items, and automation maintainable.

1. Read the source statblock.
   - Record name, type, size, alignment, AC, HP, speed, abilities, saves, skills, senses, languages, CR, traits, actions, bonus actions, reactions, legendary actions, lair actions, spells, and phases.
   - If the source has multiple phases, create one actor per phase unless Foundry needs a single actor with switchable effects.

2. Match art and icons.
   - Actor/token art should come from `assets/character arts/`, `assets/Boss_art/`, or another explicit asset folder.
   - Every embedded action, trait, and spell should use an existing icon path.
   - Prefer WoW icon pack files when default icons are missing.

3. Add pack source files.
   - General enemies and bosses can live in `src/packs/bestiary.mjs`.
   - Large boss lines should be split into `src/packs/<boss-id>-bestiary.mjs` and exported through the bestiary aggregator if the file grows too large.
   - Keep reusable spells/items in `src/packs/spells.mjs` or `src/packs/equipment.mjs`, not duplicated inside actors unless they are monster-only actions.

4. Build embedded items intentionally.
   - Passive traits: `feat` items with descriptions and effects only if the effect is always on.
   - Attacks: weapon/feat activities with attack bonus, save DC, damage, range, target, and recharge when possible.
   - Spells: link existing spell documents when possible; custom spells should be separate spell documents if players or multiple NPCs can use them.

5. Add automation only when it is deterministic.
   - Passive actor effects may be embedded directly on the trait item.
   - Runtime behavior should go under the smallest matching folder in `scripts/automation/`.
   - Midi-QOL hooks belong under `scripts/automation/midi/`.
   - Do not automate tactical choices that require GM judgement.

6. Wire pack aggregators and folders.
   - Add actor documents to the bestiary export.
   - Place GM-facing actors in the GM folder/compendium structure.
   - Player-facing content must not be mixed into the GM-only bestiary.

7. Update validation.
   - Expected bestiary counts in `tools/validate.mjs`.
   - Actor image and token image existence checks.
   - Embedded item icon checks.
   - Runtime token checks only for actual runtime automation.

8. Verify.
   - `node -e "import('./scripts/automation.mjs')"`
   - `npm run check`
   - If actors were changed, run the pack build and inspect the actor sheet in Foundry.

Rule of thumb: an NPC actor should be self-contained enough for the GM to run immediately, but shared player-facing rules should stay as normal compendium documents.
