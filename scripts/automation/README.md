# Automation structure

`scripts/automation.mjs` remains the public entrypoint used by `scripts/main.mjs`.

Current layout:

- `runtime.mjs` — legacy runtime kept as the hook/registry layer while domain code is moved out.
- `shared/constants.mjs` — shared module id, settings keys, flags and common style constants.
- `shared/helpers.mjs` — shared document selectors, feature lookup helpers, and notifications.
- `shared/selectors.mjs` — class/subclass lookup helpers and level accessors.
- `shared/dnd5e.mjs` — small dnd5e math helpers such as ability modifiers, size, and clamping.
- `classes/` — target folder for prestige-class-specific automation.
- `transformations/` — target folder for transformation-specific automation.
- `validation/` — drag/drop prerequisite and feature-level validation.
- `subclasses/` — target folder for subclass-specific automation.
- `midi/` — target folder for Midi-QOL hook handlers.
- `effects/` — active-effect/passive-sync helpers, including module passive synchronization.

Future rule: new content automation should go into the most specific folder first. Only wire it into `runtime.mjs` after the content-specific code is isolated.
