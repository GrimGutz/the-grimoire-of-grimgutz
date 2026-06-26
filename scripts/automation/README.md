# Automation structure

`scripts/automation.mjs` remains the public entrypoint used by `scripts/main.mjs`.

Current layout:

- `runtime.mjs` — legacy runtime kept as the hook/registry layer while domain code is moved out.
- `shared/constants.mjs` — shared module id, settings keys, flags and common style constants.
- `shared/helpers.mjs` — shared document selectors, feature lookup helpers, and notifications.
- `classes/` — target folder for prestige-class-specific automation.
- `transformations/` — target folder for transformation-specific automation.
- `subclasses/` — target folder for subclass-specific automation.
- `midi/` — target folder for Midi-QOL hook handlers.
- `effects/` — target folder for active-effect/passive-sync helpers.

Future rule: new content automation should go into the most specific folder first. Only wire it into `runtime.mjs` after the content-specific code is isolated.
