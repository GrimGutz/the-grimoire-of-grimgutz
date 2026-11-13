import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { MODULE_ID, SETTINGS } from "../scripts/automation/shared/constants.mjs";
import { reportFailure } from "../scripts/automation/shared/helpers.mjs";
import {
  characterLevel,
  unlockedTier,
  transformationTier,
  transformationState,
  effectChange,
  enforcesTransformationPrerequisites,
  advancementResult,
  isDuplicateGrant,
  rejectDuplicateBoons
} from "../scripts/automation/shared/transformation-core.mjs";
import { validateIllithidAdvancement } from "../scripts/automation/transformations/illithid.mjs";
import { validateChimeraAdvancement } from "../scripts/automation/transformations/chimera.mjs";
import { clearSoulShard } from "../scripts/automation/classes/soul-eater.mjs";

const warnings = [];
const settings = { [SETTINGS.AUTOMATION]: true, [SETTINGS.STRICT_PREREQUISITES]: true };
beforeEach(() => {
  warnings.length = 0;
  settings[SETTINGS.AUTOMATION] = true;
  settings[SETTINGS.STRICT_PREREQUISITES] = true;
  globalThis.ui = {
    notifications: { warn: message => warnings.push(message), info() {}, error: message => warnings.push(message) }
  };
  globalThis.game = {
    user: { id: "gm" },
    users: { activeGM: { id: "gm" } },
    settings: { get: (_module, key) => settings[key] }
  };
  globalThis.foundry = { utils: { mergeObject: (target, source) => ({ ...target, ...source }) } };
});
const flagged = (flags, extra = {}) => ({ ...extra, flags: { [MODULE_ID]: flags } });
const cls = levels => ({ type: "class", system: { levels } });
const feature = (identifier, flags = {}, extra = {}) =>
  flagged(flags, { name: identifier, system: { identifier }, ...extra });
// Like a Foundry Document, getFlag lives on the prototype, so an object spread loses it.
class MockActor {
  constructor(items, state) {
    this.uuid = "Actor.a";
    this.items = items;
    this.state = state;
  }
  getFlag(module, key) {
    return module === MODULE_ID ? this.state[key] : undefined;
  }
}
const actorWith = (items, state = {}) => new MockActor(items, state);

test("characterLevel sums every class and ignores other items", () => {
  assert.equal(characterLevel(actorWith([cls(7), cls(4), feature("x")])), 11);
  assert.equal(characterLevel(null), 0);
});

test("unlockedTier opens one tier per five levels between 1 and 4", () => {
  for (const [level, tier] of [
    [1, 1],
    [5, 1],
    [6, 2],
    [10, 2],
    [11, 3],
    [15, 3],
    [16, 4],
    [20, 4],
    [30, 4]
  ])
    assert.equal(unlockedTier(level), tier, `level ${level}`);
});

test("transformationTier caps owned tiers by character level and honours include", () => {
  const root = feature("hag-transformation", { transformation: "hag" });
  const tier3 = feature("hag-x", { transformation: "hag", transformationLevel: 3 });
  assert.equal(transformationTier(actorWith([cls(20), root, tier3]), "hag"), 3);
  assert.equal(transformationTier(actorWith([cls(6), root, tier3]), "hag"), 2, "level 6 unlocks only tier 2");
  assert.equal(transformationTier(actorWith([root, tier3]), "hag"), 3, "classless actors are not capped");
  assert.equal(transformationTier(actorWith([cls(20), root, tier3]), "hag", { include: i => i !== tier3 }), 1);
  assert.equal(transformationTier(actorWith([cls(20), tier3]), "god"), 0, "other transformations do not count");
});

test("transformationState reads an empty default and patches serially without dropping keys", async () => {
  let stored = { a: 1 };
  const actor = {
    uuid: "Actor.s",
    getFlag: () => stored,
    setFlag: async (_m, _k, value) => {
      await Promise.resolve();
      stored = value;
    }
  };
  const { read, patch } = transformationState("testState", "test-state");
  assert.deepEqual(read({ getFlag: () => undefined }), {});
  await Promise.all([patch(actor, { b: 2 }), patch(actor, { c: 3 })]);
  assert.deepEqual(stored, { a: 1, b: 2, c: 3 });
});

test("effectChange stringifies values and defaults to initial add at priority 20", () => {
  assert.deepEqual(effectChange("k", 5), { key: "k", value: "5", type: "add", phase: "initial", priority: 20 });
  assert.deepEqual(effectChange("k", 1, "upgrade", "final", 40), {
    key: "k",
    value: "1",
    type: "upgrade",
    phase: "final",
    priority: 40
  });
});

test("strict prerequisites apply only to the creating user, enabled strict mode and owned roots", () => {
  const item = { system: { identifier: "hag-transformation" }, parent: {} };
  assert.equal(enforcesTransformationPrerequisites(item, "gm", "hag-transformation"), true);
  assert.equal(enforcesTransformationPrerequisites(item, "player", "hag-transformation"), false);
  assert.equal(enforcesTransformationPrerequisites({ ...item, parent: null }, "gm", "hag-transformation"), false);
  assert.equal(enforcesTransformationPrerequisites(item, "gm", "god-transformation"), false);
  settings[SETTINGS.STRICT_PREREQUISITES] = false;
  assert.equal(enforcesTransformationPrerequisites(item, "gm", "hag-transformation"), false);
});

test("duplicate boons are rejected whether owned, deleted or granted twice", () => {
  const owned = { id: "o", ...feature("x-boon") };
  const manager = { actor: { items: [owned] } };
  const grant = feature("x-boon", { boon: true });
  assert.equal(isDuplicateGrant(grant, [owned], [grant]), true);
  assert.equal(
    rejectDuplicateBoons(manager, [grant], [], d => d.flags[MODULE_ID].boon),
    false
  );
  assert.match(warnings[0], /уже получено/);
  assert.equal(
    rejectDuplicateBoons(manager, [grant], ["o"], d => d.flags[MODULE_ID].boon),
    undefined,
    "replacing the owned copy is allowed"
  );
  assert.equal(
    rejectDuplicateBoons({ actor: { items: [] } }, [grant, grant], [], d => d.flags[MODULE_ID].boon),
    false
  );
  assert.equal(
    rejectDuplicateBoons(
      manager,
      [grant],
      [],
      d => d.flags[MODULE_ID].boon,
      i => i !== owned
    ),
    undefined,
    "keepOwned excludes shared copies"
  );
});

test("advancementResult applies deletions, updates and creations", () => {
  const a = { id: "a", name: "A", toObject: () => ({ _id: "a", name: "A" }) },
    b = { id: "b", name: "B" };
  const result = advancementResult({ actor: { items: [a, b] } }, [{ name: "C" }], [{ _id: "a", name: "A2" }], ["b"]);
  assert.deepEqual(
    result.map(d => d.name),
    ["A2", "C"]
  );
});

test("Illithid advancement honours GM-confirmed spellcasting (actor flags survive validation)", () => {
  const grant = feature("illithid-spellcasting", { transformation: "illithid", illithidBoon: true });
  const noCaster = actorWith([cls(10)]);
  assert.equal(validateIllithidAdvancement({ actor: noCaster }, {}, [grant], [], []), false);
  const confirmed = actorWith([cls(10)], { illithidState: { spellcastingConfirmed: true } });
  assert.equal(validateIllithidAdvancement({ actor: confirmed }, {}, [grant], [], []), undefined);
});

test("Chimera advancement validation is skipped while automation is disabled, like other transformations", () => {
  const grant = feature("chimera-wings", { transformation: "chimera", chimeraBoon: true });
  const manager = { actor: { items: [{ id: "w", ...feature("chimera-wings") }] } };
  assert.equal(validateChimeraAdvancement(manager, {}, [grant], [], []), false);
  settings[SETTINGS.AUTOMATION] = false;
  assert.equal(validateChimeraAdvancement(manager, {}, [grant], [], []), undefined);
});

test("Soul Shard cleanup runs only on the automation authority", async () => {
  let deletes = 0;
  const actor = {
    isOwner: true,
    effects: [
      {
        getFlag: (_m, key) => key === "soulShardEffect",
        delete: async () => {
          deletes++;
        }
      }
    ]
  };
  game.user.id = "player";
  await clearSoulShard(actor);
  assert.equal(deletes, 0, "an owning player must leave the delete to the GM");
  game.user.id = "gm";
  await clearSoulShard(actor);
  assert.equal(deletes, 1);
});

test("reportFailure logs rejections with its label and ignores non-promises", async () => {
  const logged = [],
    original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    const report = reportFailure("Unit");
    report(undefined);
    report(false);
    report(Promise.reject(new Error("boom")));
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], `${MODULE_ID} | Unit`);
  assert.equal(logged[0][1].message, "boom");
});
