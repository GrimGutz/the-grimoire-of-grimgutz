// In-world self-test: checks the module against the real Foundry and D&D5e
// running in this world, which the Node tests (a hand-written Foundry stand-in)
// cannot. GM only. It creates a temporary actor and scene named
// "[Grimoire self-test]" and deletes them afterwards.
//
//   await game.modules.get("the-grimoire-of-grimgutz").api.runSelfTest()
//
// With the Quench module active the same checks appear as a Quench batch.
import { MODULE_ID } from "./shared/constants.mjs";
import { automationAction } from "./shared/helpers.mjs";
import { effectKey } from "./shared/system-paths.mjs";
import { flagKey, replaceFlag } from "./shared/flag-write.mjs";
import { sameZone, sceneZone, sceneZones } from "./shared/scene-zones.mjs";
import { documentActor, requireOwned, requireToken } from "./shared/request-validation.mjs";

const PREFIX = "[Grimoire self-test]";
const EXPECTED_COUNTS = {
  classes: 36,
  subclasses: 17,
  features: 978,
  transformations: 18,
  spells: 21,
  equipment: 8,
  bestiary: 30
};
// Paths the system derives during data preparation: valid Active Effect keys
// that are not stored fields of the actor schema.
const DERIVED = [/^system\.attributes\.ac\.(value|bonus|base|cover|min)$/, /^system\.attributes\.hp\.(max|tempmax)$/];

/** Keys (after effectKey) of `system.*` changes that no actor data model of this dnd5e version defines. */
function unknownPaths(keys) {
  const schemas = ["character", "npc"].map(type => CONFIG.Actor.dataModels[type]?.schema).filter(Boolean);
  const unknown = new Set();
  for (const raw of keys) {
    const key = effectKey(String(raw ?? ""));
    if (!key.startsWith("system.") || DERIVED.some(pattern => pattern.test(key))) continue;
    const path = key.slice("system.".length);
    if (!schemas.some(schema => schema.getField(path))) unknown.add(key);
  }
  return [...unknown];
}

function assert(condition, message) {
  if (!condition) throw Error(message);
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(Error(`${label}: no result after ${ms / 1000} s`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

const modulePacks = () => [...game.packs].filter(pack => pack.metadata.packageName === MODULE_ID);

async function moduleDocuments() {
  const documents = [];
  for (const pack of modulePacks()) documents.push(...(await pack.getDocuments()));
  return documents;
}

/** Writes to `actor` and its embedded documents while `operation` runs. */
async function countWrites(actor, operation) {
  const names = ["updateActor", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]
    .concat(["createItem", "updateItem", "deleteItem"])
    .map(hook => [hook, document => (documentActor(document)?.uuid === actor.uuid ? writes.push(hook) : null)]);
  const writes = [];
  const ids = names.map(([hook, handler]) => [hook, Hooks.on(hook, handler)]);
  try {
    await operation();
    // Let deferred tasks (50 ms debounce, Midi follow-ups) land.
    await new Promise(resolve => setTimeout(resolve, 500));
  } finally {
    for (const [hook, id] of ids) Hooks.off(hook, id);
  }
  return writes;
}

/**
 * Run every check. `synchronize(actor)` and `actionHandlers` come from the
 * runtime (module API). Resolves to `{ passed, failed, results }`.
 */
export async function runSelfTest({ synchronize, actionHandlers = new Map(), log = console } = {}) {
  if (!game.user?.isGM) throw Error("The Grimoire self-test needs a GM: it creates and deletes test documents.");
  const results = [];
  const created = [];
  const check = async (name, test, timeoutMs = 30000) => {
    try {
      const detail = await withTimeout(Promise.resolve().then(test), timeoutMs, name);
      results.push({ name, ok: true, detail: detail ?? "" });
    } catch (error) {
      results.push({ name, ok: false, error: error?.message ?? String(error) });
    }
  };

  try {
    await check("language files are loaded", () => {
      assert(game.i18n.has("GRIMGUTZ.Panel.Refresh"), "GRIMGUTZ keys are missing from game.i18n");
      return game.i18n.lang;
    });

    await check("compendiums load with the expected document counts", async () => {
      const counts = Object.fromEntries(modulePacks().map(pack => [pack.metadata.name, pack.index.size]));
      for (const [name, count] of Object.entries(EXPECTED_COUNTS))
        assert(counts[name] === count, `${name}: ${counts[name] ?? "missing"} documents, expected ${count}`);
      return JSON.stringify(counts);
    });

    const documents = await moduleDocuments();

    await check("every compendium activity's automation action is registered", () => {
      const missing = [];
      for (const document of documents)
        for (const item of [document, ...(document.items ?? [])])
          for (const activity of item.system?.activities ?? []) {
            const action = automationAction(activity);
            if (action && typeof actionHandlers.get(action) !== "function") missing.push(`${item.name}: ${action}`);
          }
      assert(!missing.length, `no handler for ${missing.slice(0, 10).join("; ")}`);
    });

    await check("compendium Active Effect keys exist in this dnd5e version's actor data", () => {
      const keys = documents.flatMap(document =>
        [document, ...(document.items ?? [])].flatMap(item =>
          [...(item.effects ?? [])].flatMap(effect =>
            (effect.system?.changes ?? effect.changes ?? []).map(change => change.key)
          )
        )
      );
      assert(keys.length, "the compendiums contain no Active Effect changes: their effects did not load");
      const unknown = unknownPaths(keys);
      assert(!unknown.length, `unknown data paths: ${unknown.slice(0, 15).join(", ")}`);
      return `${keys.length} changes`;
    });

    const actor = await Actor.implementation.create({ name: `${PREFIX} actor`, type: "character" });
    created.push(actor);
    const stranger = await Actor.implementation.create({ name: `${PREFIX} other actor`, type: "npc" });
    created.push(stranger);

    await check("flag maps: Foundry expands dotted keys; flagKey and replaceFlag store maps exactly", async () => {
      await actor.setFlag(MODULE_ID, "selfTest", { "Scene.a": 1 });
      const expanded = actor.getFlag(MODULE_ID, "selfTest");
      assert(expanded?.Scene?.a === 1, "Foundry no longer expands dotted keys: flagKey() may be unnecessary");
      await replaceFlag(actor, "selfTest", { [flagKey("Scene.a.Token.b")]: 1, kept: 2 });
      assert(actor.getFlag(MODULE_ID, "selfTest")?.[flagKey("Scene.a.Token.b")] === 1, "encoded key lost");
      await replaceFlag(actor, "selfTest", { kept: 2 });
      const stored = actor.getFlag(MODULE_ID, "selfTest");
      assert(JSON.stringify(stored) === JSON.stringify({ kept: 2 }), `replaceFlag merged: ${JSON.stringify(stored)}`);
      await actor.unsetFlag(MODULE_ID, "selfTest");
    });

    await check(
      "passive sync of every class, transformation and feature settles; a repeat pass writes nothing",
      async () => {
        assert(typeof synchronize === "function", "no synchronize function");
        // Every class and transformation root, and every third feature: all ~940
        // items on one actor take Foundry several minutes to create.
        const items = documents.filter(
          (document, index) =>
            document.documentName === "Item" &&
            (document.type === "class" ||
              document.pack?.endsWith(".transformations") ||
              (document.pack?.endsWith(".features") && index % 3 === 0))
        );
        const data = items.map(document => game.items.fromCompendium(document, { keepId: false }));
        for (let index = 0; index < data.length; index += 50)
          await actor.createEmbeddedDocuments("Item", data.slice(index, index + 50));
        await synchronize(actor);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const writes = await countWrites(actor, () => synchronize(actor));
        assert(!writes.length, `a repeat sync wrote ${writes.length} time(s): ${[...new Set(writes)].join(", ")}`);
        const paused = game.modules.get(MODULE_ID).api.pausedSyncs?.() ?? [];
        assert(!paused.some(entry => entry.uuid === actor.uuid), "the loop guard paused the test actor");
        const changes = [...actor.effects].flatMap(effect => effect.system?.changes ?? effect.changes ?? []);
        const unknown = unknownPaths(changes.map(change => change.key));
        assert(!unknown.length, `synced effects use unknown data paths: ${unknown.slice(0, 15).join(", ")}`);
        return `${items.length} items, ${actor.effects.size} actor effects, ${changes.length} changes`;
      },
      360000
    );

    const scene = await Scene.implementation.create({ name: `${PREFIX} scene`, width: 2000, height: 2000 });
    created.unshift(scene);

    await check("request validation resolves real documents and rejects other actors' documents", async () => {
      const [token] = await scene.createEmbeddedDocuments("Token", [
        (await actor.getTokenDocument({ x: 200, y: 200 })).toObject()
      ]);
      const [item] = await actor.createEmbeddedDocuments("Item", [{ name: `${PREFIX} item`, type: "loot" }]);
      const [foreign] = await stranger.createEmbeddedDocuments("Item", [{ name: `${PREFIX} item`, type: "loot" }]);
      assert((await requireOwned(item.uuid, actor)) === item, "own item rejected");
      assert((await requireToken(token.uuid, { scene })).id === token.id, "own token rejected");
      let rejected = false;
      try {
        await requireOwned(foreign.uuid, actor);
      } catch {
        rejected = true;
      }
      assert(rejected, "another actor's item was accepted");
      assert(documentActor(token)?.id === actor.id, "token actor not resolved");
    });

    await check("zones: a created template is one Region, listed once and updatable", async () => {
      const [template] = await scene.createEmbeddedDocuments("MeasuredTemplate", [
        { t: "circle", x: 500, y: 500, distance: 10, flags: { [MODULE_ID]: { zoneTemplate: true } } }
      ]);
      const zone = sceneZone(scene, template.id);
      const listed = sceneZones(scene).filter(entry => entry.flags?.[MODULE_ID]?.zoneTemplate);
      assert(listed.length === 1, `listed ${listed.length} times`);
      assert(sameZone(template, zone), "template and zone are not the same zone");
      await zone.setFlag(MODULE_ID, "selfTest", true);
      assert(sceneZone(scene, template.id)?.getFlag(MODULE_ID, "selfTest") === true, "zone flag not stored");
      return zone.documentName;
    });
  } finally {
    for (const document of created)
      try {
        await document.delete();
      } catch (error) {
        log.warn(`${MODULE_ID} | Self-test cleanup failed for ${document.name}`, error);
      }
  }

  const failed = results.filter(result => !result.ok);
  const report = { passed: results.length - failed.length, failed: failed.length, results };
  lastReport = report;
  (failed.length ? log.warn : log.info)(`${MODULE_ID} | Self-test: ${report.passed} passed, ${report.failed} failed`);
  if (log.table) log.table(results);
  return report;
}

let lastReport = null;
/** The report of the last completed self-test in this session, or null. */
export const lastSelfTest = () => lastReport;

/** Register the self-test as a Quench batch (call from the quenchReady hook). */
export function registerQuenchBatch(quench, options) {
  quench.registerBatch(
    `${MODULE_ID}.self-test`,
    ({ describe, it, assert: expect }) => {
      describe("Grimoire of GrimGutz self-test", function () {
        it("passes every in-world check", async function () {
          this.timeout(180000);
          const report = await runSelfTest(options());
          const failures = report.results.filter(result => !result.ok);
          expect.deepEqual(
            failures.map(result => `${result.name}: ${result.error}`),
            []
          );
        });
      });
    },
    { displayName: "Grimoire of GrimGutz: self-test" }
  );
}
