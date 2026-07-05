# Prestige class automation

Put prestige-class-specific automation here.

Current modules:

- `aberrant.mjs`
- `blood-mage.mjs`
- `blinker.mjs`
- `crusader.mjs`
- `crusher.mjs`
- `death-knight.mjs`
- `fey-warrior.mjs`
- `fallen-priest.mjs`
- `forest-lord.mjs`
- `gambler.mjs`
- `ghost-walker.mjs`
- `guardian.mjs`
- `heretic.mjs`
- `insect-lord.mjs`
- `juggernaut.mjs`
- `keeper.mjs`
- `leader.mjs`
- `onmyoji.mjs`
- `ritualist.mjs`
- `dark-warrior.mjs`
- `devil-worshipper.mjs`
- `netherese-arcanist.mjs`
- `plague-doctor.mjs`
- `soul-eater.mjs`
- `witch-blade.mjs`

Recommended shape for a new file:

```js
export function classLevel(actor) {}
export function prerequisiteFailures(actor) {}
export function validateClassPrerequisites(item, userId, context) {}
export function validateFeaturePrerequisites(item, options, userId, context) {}
export async function handleActivityAction(activity, context) {}
export async function initializeActor(actor, context) {}
```

Keep PDF text and item definitions in `src/packs/*`; keep runtime behavior here.
