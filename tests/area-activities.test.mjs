import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { areaDefinitionFor, areaPlacementAllowed, installAreaActivityHooks, useAreaActivity } from "../scripts/automation/shared/area-activities.mjs";
import { getAreaWorkflowClass } from "../scripts/automation/midi/area-workflow.mjs";

let actor, item, activity, source, target, placed, placement, rolls, selections, templateActivity;
function merge(base, patch) {
  const output = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes(".")) { const keys = key.split("."), last = keys.pop(); let root = output;
      for (const part of keys) root = root[part] ??= {}; root[last] = value; }
    else if (value && typeof value === "object" && !Array.isArray(value)) output[key] = merge(output[key] ?? {}, value);
    else output[key] = structuredClone(value);
  }
  return output;
}
function nativeItem(data) {
  const doc = { id: data._id, uuid: `Actor.owner.Item.${data._id}`, name: data.name, type: data.type, img: "icon", flags: data.flags ?? {},
    actor, toObject: () => structuredClone(data), clone: patch => nativeItem(merge(data, patch)) };
  doc.system = { ...data.system, activities: new Map(Object.entries(data.system.activities).map(([id, body]) => [id,
    { ...structuredClone(body), id, uuid: `${doc.uuid}.Activity.${id}`, item: doc, actor, toObject: () => structuredClone(body) }])) };
  return doc;
}
beforeEach(() => {
  rolls = []; selections = []; placement = "success";
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => "newCast" } };
  actor = { uuid: "Actor.owner", system: { details: { alignment: "good" }, attributes: { concentration: { limit: 1 } } }, items: [], concentration: { effects: [] } };
  source = { id: "caster", actor, center: { x: 50, y: 50 }, document: { uuid: "Scene.one.Token.caster", x: 0, y: 0, width: 1, height: 1 } };
  target = { id: "target", document: { uuid: "Scene.one.Token.target" }, actor: {} };
  placed = { id: "area", uuid: "Scene.one.Region.area", x: 50, y: 50, deleted: false,
    async delete() { this.deleted = true; }, async update(data) { this.updateData = data; } };
  globalThis.canvas = { ready: true, scene: { id: "one", grid: { size: 100, distance: 5, units: "ft" } },
    tokens: { controlled: [source], placeables: [source, target] } };
  const create = () => nativeItem({ _id: "feature", name: "Spew", type: "feat", flags: { [MODULE_ID]: { feature: "spew-insects" } },
    effects: [], system: { identifier: "spew-insects", description: { value: "My rules" }, uses: { max: 2, spent: 0 }, activities: {
      ability: { _id: "ability", type: "utility", name: "Spew", flags: { [MODULE_ID]: { action: "roll-insect-spew" } },
        activation: { type: "action" }, consumption: { targets: [{ type: "itemUses", target: "", value: "1" }] }, target: {} }
    } } });
  item = create(); activity = item.system.activities.get("ability"); actor.items = [item];
  globalThis.game = { user: { id: "user", targets: new Set([{ id: "old" }]), async updateTokenTargets(ids) { selections.push(ids); } },
    settings: { get: () => true }, modules: new Map([["midi-qol", { active: true }]]), time: { worldTime: 120 },
    system: { canvas: { AbilityTemplate: { fromActivity(input) { templateActivity = input;
      return [{ async drawPreview() { if (placement === "cancel") throw undefined; return [placed]; } }]; } } } } };
  class Workflow { constructor(actor, activity, speaker, targets, options) { Object.assign(this, { actor, activity, targets, workflowOptions: options.workflowOptions }); } }
  class TrapWorkflow extends Workflow { constructor() { throw Error("Trap constructor must never run"); } }
  globalThis.MidiQOL = { Workflow, TrapWorkflow, computeTargetsFromTemplates: () => [target],
    async completeActivityUse(input, options) { rolls.push({ input, options }); return { activity: input, aborted: false }; } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
});

test("canceling preview never starts native consumption or damage", async () => {
  placement = "cancel";
  assert.equal(await useAreaActivity(activity), false);
  assert.equal(rolls.length, 0);
  assert.equal(item.system.uses.spent, 0);
  assert.deepEqual(selections.at(-1), ["old"]);
});

test("placement resolves geometry first, then one native save/damage workflow with both damage types", async () => {
  let geometries = 0;
  MidiQOL.computeTargetsFromTemplates = (...args) => { geometries++; assert.equal(args[0][0], placed); return [target]; };
  assert.ok(await useAreaActivity(activity, { usage: { workflow: { aborted: true }, consume: { resources: false } } }));
  assert.equal(geometries, 1); assert.equal(rolls.length, 1);
  const { input, options } = rolls[0];
  assert.equal(input.type, "save"); assert.deepEqual(input.save.ability, ["dex"]);
  assert.equal(input.damage.onSave, "half");
  assert.deepEqual(input.damage.parts.map(part => part.types), [["piercing"], ["poison"]]);
  assert.equal(input.damage.parts[0].number, 4); assert.equal(input.damage.parts[1].number, 3);
  assert.equal(templateActivity.target.template.type, "cone");
  assert.equal(input.target.template.type, ""); assert.equal(options.create.measuredTemplate, false);
  assert.deepEqual(options.midiOptions.targetUuids, [target.document.uuid]);
  assert.equal(options.consume.resources, true); assert.ok(options.workflow instanceof MidiQOL.Workflow);
  assert.equal(areaDefinitionFor(input), null);
  assert.deepEqual(input.item.toObject().effects.at(-1).statuses, ["poisoned"]);
  assert.equal(item.toObject().system.activities.ability.type, "utility"); // no owned document edits
  assert.equal(input.item.toObject().system.description.value, "My rules");
  assert.deepEqual(selections.at(-1), ["old"]);
});

test("an invalid origin or a canceled native dialog removes only its new preview", async () => {
  placed.x = 500;
  assert.equal(await useAreaActivity(activity), false); assert.equal(rolls.length, 0); assert.equal(placed.deleted, true);
  placed.x = 50; placed.deleted = false;
  MidiQOL.completeActivityUse = async (input, options) => { options.workflow.aborted = true; return options.workflow; };
  assert.equal(await useAreaActivity(activity), false); assert.equal(placed.deleted, true);
});

test("an unknown completion retains the area and never assumes a refund", async () => {
  MidiQOL.completeActivityUse = async () => undefined;
  assert.equal(await useAreaActivity(activity), false); assert.equal(placed.deleted, false);
  assert.equal(placed.updateData[`flags.${MODULE_ID}.zoneExpiresAt`], null);
});

test("an explicit native cancellation removes its own template without starting another cast", async () => {
  MidiQOL.completeActivityUse = async () => false;
  assert.equal(await useAreaActivity(activity), false);
  assert.equal(placed.deleted, true);
});

test("generic native AoE retains its concentration and duration", () => {
  const native = { ...activity, name: "Different area", flags: {}, type: "save", target: { template: { type: "sphere", size: "20" } },
    duration: { value: "10", units: "minute", concentration: true } };
  native.item = { ...item, system: { ...item.system, identifier: "other-area" }, flags: { [MODULE_ID]: {} } };
  const spec = areaDefinitionFor(native);
  assert.equal(spec.native, true); assert.equal(spec.concentration, true); assert.equal(spec.templateSeconds, 600);
});

test("fallback concentration registers only this cast's template and conditions through Midi", async () => {
  const spec = { ...areaDefinitionFor(activity), concentration: 60 };
  activity.flags[MODULE_ID].area = spec;
  const concentration = { id: "conc", uuid: "Actor.owner.ActiveEffect.conc" };
  actor.beginConcentrating = async () => { actor.concentration.effects = [concentration]; return concentration; };
  const condition = { uuid: "Actor.target.ActiveEffect.current", flags: { [MODULE_ID]: { areaCastId: "newCast" } } };
  target.actor.effects = [condition, { uuid: "Actor.target.ActiveEffect.old", flags: { [MODULE_ID]: { areaCastId: "oldCast" } } }];
  const dependents = [];
  MidiQOL.addDependent = async (owner, dependent) => { assert.equal(owner, concentration); dependents.push(dependent.uuid); };
  assert.ok(await useAreaActivity(activity));
  assert.deepEqual(dependents, [placed.uuid, condition.uuid]);
  assert.equal(placed.updateData[`flags.${MODULE_ID}.zoneConcentrationEffect`], concentration.uuid);
  assert.equal(placed.updateData[`flags.${MODULE_ID}.zoneExpiresAt`], 180);
});

test("hook blocks the original utility before resources; resolved flow is not intercepted twice", async () => {
  let hook;
  globalThis.Hooks = { on(name, callback) { assert.equal(name, "dnd5e.preUseActivity"); hook = callback; } };
  installAreaActivityHooks({ validate: () => false });
  assert.equal(hook(activity, {}, {}, {}), false);
  assert.equal(rolls.length, 0);
  const resolved = { ...activity, flags: { [MODULE_ID]: { areaResolved: true } } };
  assert.equal(hook(resolved, {}, {}, {}), undefined);
});

test("origin constraints use the caster footprint and measured range", () => {
  assert.equal(areaPlacementAllowed({ x: 90, y: 90 }, source, { origin: "self" }, canvas.scene), true);
  assert.equal(areaPlacementAllowed({ x: 200, y: 90 }, source, { origin: "self" }, canvas.scene), false);
  assert.equal(areaPlacementAllowed({ x: 450, y: 50 }, source, { origin: "point", maxRange: 15 }, canvas.scene), false);
});

test("save-first adapter uses Midi's stages without invoking its self-starting trap constructor", async () => {
  const calls = [];
  MidiQOL.TrapWorkflow.prototype.WorkflowState_WaitForSaves = async function () { calls.push("saves"); await this.checkSaves(); return "saved"; };
  MidiQOL.Workflow.prototype.WorkflowState_DamageRollComplete = async function () { calls.push("damage"); return this.WorkflowState_WaitForSaves; };
  MidiQOL.Workflow.prototype.WorkflowState_AllRollsComplete = async () => { calls.push("apply"); };
  MidiQOL.Workflow.prototype.checkSaves = async () => { calls.push("native-rolls"); };
  const Class = getAreaWorkflowClass(), workflow = new Class(actor, { hasAttack: false }, {}, new Set([target]), { workflowOptions: {} });
  workflow.callMidiHooks = async name => calls.push(name);
  workflow.WorkflowState_WaitForSaves = Class.prototype.WorkflowState_WaitForSaves;
  assert.equal(await workflow.WorkflowState_WaitForAttackRoll(), workflow.WorkflowState_WaitForSaves);
  assert.equal(await workflow.WorkflowState_WaitForSaves(), "saved");
  await workflow.WorkflowState_DamageRollComplete(); await workflow.WorkflowState_AllRollsComplete();
  assert.deepEqual(calls, ["midi-qol.preCheckSaves", "saves", "native-rolls", "midi-qol.postCheckSaves", "damage", "apply"]);
});

test("MidiActivityMixin preserves the supplied workflow instead of replacing it", () => {
  const Class = getAreaWorkflowClass();
  const workflow = new Class(actor, activity, {}, new Set([target]), { workflowOptions: {} });
  // Midi 14.0.9 only preserves usage.workflow when it is a TrapWorkflow instance.
  assert.ok(workflow instanceof MidiQOL.TrapWorkflow);
  assert.ok(workflow instanceof MidiQOL.Workflow);
});

test("save-only areas finish without entering a saves/damage loop", async () => {
  MidiQOL.Workflow.prototype.WorkflowState_SavesComplete = async function () { return this.WorkflowState_AllRollsComplete; };
  const Class = getAreaWorkflowClass();
  const workflow = new Class(actor, { hasDamage: false, hasHealing: false }, {}, new Set([target]), { workflowOptions: {} });
  assert.equal(await workflow.WorkflowState_SavesComplete(), workflow.WorkflowState_AllRollsComplete);
});
