# Prestige class automation

Put prestige-class-specific automation here.

Current split examples:

- `juggernaut.mjs`
- `soul-eater.mjs`

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
