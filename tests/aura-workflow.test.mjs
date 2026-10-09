import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { useAuraPulse } from "../scripts/automation/midi/aura-workflow.mjs";
import { automationAction } from "../scripts/automation/shared/helpers.mjs";

let actor, sourceItem, sourceToken, targets, calls, restored, scene;
function item(data) {
  const doc = { uuid: "Actor.owner.Item.feature", name: "Aura", img: "icon", actor, toObject: () => structuredClone(data),
    clone(patch) {
      const activities = Object.fromEntries(Object.entries(patch.system.activities).map(([id, activity]) => [id,
        { ...activity, flags: { ...data.system.activities[id]?.flags, ...activity.flags,
          [MODULE_ID]: { ...data.system.activities[id]?.flags?.[MODULE_ID], ...activity.flags?.[MODULE_ID] } } }]));
      return item({ ...structuredClone(data), ...patch, system: { ...data.system, ...patch.system, activities } });
    } };
  doc.system = { ...data.system, activities: new Map(Object.entries(data.system.activities).map(([id, data]) => [id,
    { ...data, id, uuid: `${doc.uuid}.Activity.${id}`, item: doc, actor }])) };
  return doc;
}
beforeEach(() => {
  actor = { uuid: "Actor.owner", system: { attributes: { hp: { value: 40 } } } }; calls = []; restored = [];
  sourceItem = item({ system: { uses: { max: "1", spent: 1 }, activities: { first: { _id: "first", type: "utility",
    consumption: { targets: [{ type: "itemUses", target: "", value: "1" }] }, flags: { [MODULE_ID]: { action: "spirit-vessel-fiend-flames" } } } } }, effects: [] });
  sourceToken = { actor, document: { uuid: "Scene.one.Token.owner", hidden: false } };
  targets = [{ id: "enemy", actor: {}, document: { uuid: "Scene.one.Token.enemy" } }];
  scene = { id: "one" }; globalThis.canvas = { ready: true, scene };
  globalThis.game = { user: { id: "gm", targets: new Set([{ id: "previous" }]), async updateTokenTargets(ids) { restored.push(ids); } },
    modules: new Map([["midi-qol", { active: true }]]) };
  globalThis.ChatMessage = { getSpeaker: () => ({}) }; globalThis.ui = { notifications: { warn() {} } };
  class Workflow { constructor(actor, activity, speaker, targets, options) { Object.assign(this, { actor, activity, targets, workflowOptions: options.workflowOptions }); } }
  class TrapWorkflow extends Workflow { constructor() { throw Error("Self-starting Trap constructor must not run"); } }
  globalThis.MidiQOL = { Workflow, TrapWorkflow, async completeActivityUse(...args) { calls.push(args); return { aborted: false }; } };
});
const pulse = event => useAuraPulse({ sourceToken, sourceItem, targets, scene, template: { uuid: "Scene.one.Region.aura" }, event, eventKey: "source-start:turn-one" });

test("aura damage uses native Midi, its attached Region, and no further costs or dialogs", async () => {
  assert.ok(await pulse({ damage: [{ formula: "1d6", type: "fire" }] }));
  const [activity, usage, dialog] = calls[0];
  assert.equal(activity.type, "damage"); assert.deepEqual(activity.damage.parts[0].types, ["fire"]);
  assert.equal(activity.flags[MODULE_ID].areaResolved, true); assert.equal(activity.midiProperties.forceDamageDialog, "never");
  assert.deepEqual(usage.consume, { resources: false, spellSlot: false, action: false }); assert.equal(dialog.configure, false);
  assert.equal(usage.create.measuredTemplate, false); assert.equal(usage.midiOptions.workflowOptions.templateUuid, "Scene.one.Region.aura");
  assert.deepEqual(usage.midiOptions.targetUuids, [targets[0].document.uuid]); assert.ok(usage.workflow instanceof MidiQOL.TrapWorkflow);
  assert.equal(sourceItem.toObject().system.uses.spent, 1); assert.equal(sourceItem.toObject().system.activities.first.type, "utility");
  assert.deepEqual(restored.at(-1), ["previous"]);
});

test("a pulse clone must not inherit its already consumed activation action", async () => {
  await pulse({ damage: [{ formula: "1d6", type: "fire" }] });
  assert.equal(automationAction(calls[0][0]), "");
  assert.equal(automationAction(sourceItem.system.activities.get("first")), "spirit-vessel-fiend-flames");
});

test("plague pulse links a permanent latent condition to failed native saves only", async () => {
  await pulse({ save: "con", dc: "15", damage: [], condition: { name: "Latent plague", key: "hidden-intellect-plague", persistent: true } });
  const [activity] = calls[0]; assert.equal(activity.type, "save"); assert.deepEqual(activity.save.ability, ["con"]);
  assert.equal(activity.save.dc.formula, "15"); assert.equal(activity.effects[0].onSave, false);
  const effect = activity.item.toObject().effects[0]; assert.equal(effect.flags[MODULE_ID].auraPersistentCondition, "hidden-intellect-plague");
  assert.equal(effect.duration.value, null); assert.equal(effect.transfer, false); assert.equal(effect.showIcon, 0);
  assert.equal(sourceItem.toObject().effects.length, 0);
});

test("missing Midi or another open scene cannot silently apply raw HP damage", async () => {
  game.modules.get("midi-qol").active = false; assert.equal(await pulse({ damage: [{ formula: "1d6", type: "fire" }] }), false);
  game.modules.get("midi-qol").active = true; canvas.scene = { id: "other" };
  assert.equal(await pulse({ damage: [{ formula: "1d6", type: "fire" }] }), false); assert.equal(calls.length, 0);
});

test("native failure restores target selection and never charges the aura activation again", async () => {
  MidiQOL.completeActivityUse = async () => { throw Error("native failure"); };
  await assert.rejects(pulse({ damage: [{ formula: "1d6", type: "fire" }] }), /native failure/);
  assert.deepEqual(restored.at(-1), ["previous"]); assert.equal(sourceItem.toObject().system.uses.spent, 1);
});
