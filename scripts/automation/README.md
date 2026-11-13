# Automation structure

`scripts/automation.mjs` remains the public entrypoint used by `scripts/main.mjs`.

Current layout:

- `runtime.mjs` — legacy runtime kept as the hook/registry layer while domain code is moved out.
- `shared/constants.mjs` — shared module id, settings keys, flags and common style constants.
- `shared/helpers.mjs` — shared document selectors, feature lookup helpers, notifications, `actorFromEffect` and `reportFailure(label)` for fire-and-forget hook promises.
- `shared/transformation-core.mjs` — rules shared by every tiered transformation: character level, tier unlock and current tier, flag-backed state with serialized patches, Active Effect change builder, strict-prerequisite gate and advancement duplicate checks. New transformations should build on it instead of copying another transformation's helpers.
- `shared/selectors.mjs` — class/subclass lookup helpers and level accessors.
- `shared/dnd5e.mjs` — small dnd5e math helpers such as ability modifiers, size, and clamping.
- `classes/` — target folder for prestige-class-specific automation.
- `transformations/` — target folder for transformation-specific automation.
- `validation/` — drag/drop prerequisite and feature-level validation.
- `subclasses/` — target folder for subclass-specific automation.
- `midi/` — target folder for Midi-QOL hook handlers.
- `effects/` — active-effect/passive-sync helpers, including module passive synchronization.

Future rule: new content automation should go into the most specific folder first. Only wire it into `runtime.mjs` after the content-specific code is isolated.
