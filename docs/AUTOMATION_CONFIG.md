# Automation config format

All generated module-owned documents and utility activities should expose automation metadata through one format:

```js
flags: {
  [MODULE_ID]: {
    schemaVersion: 1,

    // Legacy flat fields stay here for backwards compatibility.
    feature: "binding-ritual",
    action: "summon-ritualist-spirits",
    ritualistRitualPointCost: 1,

    // Canonical config used by new automation code.
    automation: {
      version: 1,
      kind: "activity",
      id: "summon-ritualist-spirits",
      action: {
        id: "summon-ritualist-spirits",
        data: {
          ritualistRitualPointCost: 1
        }
      },
      document: {
        type: "activity",
        key: "ritualist-summon-spirits",
        feature: null,
        prestigeClass: null,
        subclass: null,
        transformation: null,
        equipment: null
      },
      requirements: {
        minimumLevel: 1
      },
      tags: ["ritualistFeature"],
      data: {
        feature: "binding-ritual",
        action: "summon-ritualist-spirits",
        ritualistRitualPointCost: 1
      }
    }
  }
}
```

Source rules:

1. In `src/packs/*`, keep writing the simple `automation` and `actionData` objects.
2. Do not manually write the nested `automation` object in individual pack files.
3. `src/common.mjs` adds `schemaVersion` and the canonical nested config during build.
4. Runtime code should read through `automationData(document)`, `automationConfig(document)`, or `automationAction(document)` from `scripts/automation/shared/helpers.mjs`.
5. Existing flat keys are still valid for compatibility with old owned items.
6. `tools/validate.mjs` checks generated documents, activities, and pack effects for schema version `1`.

When adding a new deterministic action, prefer this shape in pack source:

```js
utilityActivity({
  key: "example-action",
  name: "Example action",
  action: "example-action",
  actionData: {
    resourceCost: 1,
    saveAbility: "wis"
  },
  spellSlot: false
})
```

Runtime then reads:

```js
const action = automationAction(activity);
const data = automationData(activity);
const cost = Number(data.resourceCost ?? 1);
```
