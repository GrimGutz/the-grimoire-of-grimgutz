# Automation structure

`scripts/automation.mjs` remains the public entrypoint used by `scripts/main.mjs`.

Current layout:

- `runtime.mjs` — hook/registry layer. Older prestige classes are still wired here through ordered tables (actions, use validators, prerequisite chain, sync tasks); newer content registers itself through `content-registry.mjs`.
- `content-registry.mjs` — the ordered list of self-registering classes and transformations, plus the loops runtime uses (actions, validators, hook installers, sync tasks, Midi handlers, API, diagnostics).
- `shared/content.mjs` — `defineContent()`, the descriptor format (see below).
- `shared/constants.mjs` — shared module id, settings keys, flags and common style constants.
- `shared/helpers.mjs` — shared document selectors, feature lookup helpers, notifications, `actorFromEffect` and `reportFailure(label)` for fire-and-forget hook promises.
- `shared/authority.mjs` — `onAuthority()` and `isGmAuthority()` helpers for hooks that fire on every client but must change documents only once.
- `shared/system-paths.mjs` — D&D5e data paths that moved between 5.3 and 6.x. Write Active Effect keys and update paths through `effectKey()`; read movement and senses with `movementSpeed()` / `senseRange()`.
- `shared/transformation-core.mjs` — rules shared by every tiered transformation: character level, tier unlock and current tier, flag-backed state with serialized patches, Active Effect change builder, strict-prerequisite gate and advancement duplicate checks. New transformations should build on it instead of copying another transformation's helpers.
- `shared/selectors.mjs` — class/subclass lookup helpers and level accessors.
- `shared/dnd5e.mjs` — small dnd5e math helpers such as ability modifiers, size, and clamping.
- `classes/` — prestige-class automation.
- `transformations/` — transformation automation.
- `validation/` — drag/drop prerequisite and feature-level validation.
- `subclasses/` — subclass automation.
- `midi/` — Midi-QOL hook handlers; `midi/hooks.mjs` holds the global order they run in.
- `effects/` — active-effect/passive-sync helpers, including module passive synchronization.

## Data-defined transformations

Myconid, Psyker, Sphinx, Vendigo and Void are plain data: `transformations/<id>-definition.mjs` lists requirements, the DC rule and every boon and flaw (rules text, uses, native dnd5e activities, optional `passive(actor, kit)`), and `shared/transformation-kit.mjs` provides the runtime (tier and DC as roll data, passives, prerequisites, advancement checks, resource pools, self-clearing markers). `src/transformation-kit-pack.mjs` builds their compendium cards. A new transformation in the 14 boons + 4 flaws format needs only a definition file listed in `transformations/data-transformations.mjs`.

## Adding a class or transformation

1. Put the rules in `classes/<id>*.mjs` or `transformations/<id>*.mjs` (transformations: build on `shared/transformation-core.mjs`).
2. Write `<folder>/<id>-content.mjs` exporting one `defineContent({ id, kind, actions, itemValidators, advancementValidators, install, sync, inspect, midi, api })` descriptor. Only `id` and `kind` are required.
3. Add the descriptor to `CONTENT` in `content-registry.mjs`.
4. Only if it has Midi-QOL handlers: place their names in `MIDI_QOL_HOOKS` (`midi/hooks.mjs`). The content-registry tests fail if a descriptor handler is not scheduled.

No edits to `runtime.mjs` are needed.

## Conventions

- Hooks on document changes and combat (`create*`, `update*`, `delete*`, `updateCombat`, `deleteCombat`) fire on every connected client. Change documents only on the automation authority: register with `onAuthority()` or guard with `isAutomationAuthority(actor)`; `isOwner` alone lets the GM and the owning player both write.
- Read-modify-write of flag state must be serialized per actor: use `transformationState(flag, lock).patch` or `serialMutation(key, operation)`.
- Never leave a promise floating in a hook: `await` it or pass it to a `reportFailure(label)` reporter. `npm run lint` enforces this.
- Place an activity's area with `placeActivityArea()` (`shared/template-placement.mjs`), never dnd5e's `AbilityTemplate` (removed in dnd5e 6.2). It returns the placed zones as Regions, or `null` when the user cancels.
- List or look up zones with `sceneZones()` / `sceneZone()` (`shared/scene-zones.mjs`), never `scene.templates`: on Foundry v14 templates are Regions, `Scene#templates` returns a duplicate read-only wrapper for each, and it is removed in v16. Compare stored zone uuids with `sameZone()`.
- GM request handlers (`registerGmRequest`): the relay only proves the requester owns the owner actor. Resolve every other uuid in `data` with `shared/request-validation.mjs` (`requireOwned`, `requireToken`, `requireTokens`, `actorOnScene`) and rebuild effect data, change lists, flags and rolls on the GM instead of trusting them. `tests/gm-request-forgery.test.mjs` sends every handler forged uuids and fails if the GM then writes to another actor's documents.
- Target effects on creatures the player does not own go through `registerTargetEffect(key, build)` (`shared/target-effects.mjs`): the request carries only the key, the source item and the target tokens.
- Object-valued flags: Foundry merges objects on update and expands dotted keys inside them. Key maps by `flagKey(uuid)` and write whole values with `replaceFlag()` (`shared/flag-write.mjs`); `flagState().patch` already replaces. Keep ledgers bounded (`newestEntries`).
- Automation sync (`shared/actor-sync.mjs`) repeats until a pass changes nothing; a task that is not idempotent trips the loop guard, which names it in the console and pauses that actor (`api.pausedSyncs()`).
- Without a connected GM, `isAutomationAuthority()` elects one active owner (the player whose character it is, else the lowest user id), so shared actors are not synchronized on several clients.
- User-facing text: add it to `lang/ru.json` and `lang/en.json` and call `t("Section.Key", data)` (`shared/i18n.mjs`). `tests/i18n.test.mjs` fails if the number of hard-coded Russian strings grows.
- In-world checks against real Foundry and D&D5e: `await game.modules.get("the-grimoire-of-grimgutz").api.runSelfTest()` as GM (also a Quench batch when Quench is active). It creates and deletes a temporary actor and scene.
- Never walk `game.scenes` tokens or every actor in a frequent hook (`updateWorldTime`, `updateToken`, `updateActor`, `updateCombat`). Use `automationActors()` from `shared/actor-index.mjs`: a cached index of actors carrying this module's flags, items or effects, which builds synthetic actors only for module-bearing tokens. `everyActor()` builds every synthetic actor in the world; use it only for one-off seeding (`ready`, `canvasReady`).
