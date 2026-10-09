import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { presenceApplies, LEADER_PRESENCE_DEFINITIONS, inspiringTemporaryHp } from "../scripts/automation/shared/leader-presence-definitions.mjs";
import { calmingHealingBonus } from "../scripts/automation/classes/leader-presences.mjs";
import { leaderDocuments } from "../src/packs/leader-features.mjs";
import { automationAction } from "../scripts/automation/shared/helpers.mjs";

let scene, source, target;
function actor(id) { return { uuid: `Actor.${id}`, type: "character", flags: {}, effects: [], statuses: new Set(),
  items: LEADER_PRESENCE_DEFINITIONS.map(def => ({ system: { identifier: def.sourceFeature }, name: def.sourceFeature })),
  system: { attributes: { prof: 5, hp: { value: 20 }, movement: { walk: 30, units: "ft" } }, abilities: { cha: { mod: 3 }, int: { mod: 4 }, wis: { mod: 2 } } },
  getFlag(module, key) { return this.flags[module]?.[key]; } }; }
beforeEach(() => {
  scene = { id: "one", tokens: [] }; source = { uuid: "Scene.one.Token.leader", parent: scene, actor: actor("leader") };
  target = { uuid: "Scene.one.Token.target", parent: scene, actor: actor("target"), hidden: true };
  source.actor.flags[MODULE_ID] = { leaderPresenceRecipients: LEADER_PRESENCE_DEFINITIONS.map(def => ({ key: def.sourceFeature,
    sceneId: "one", sourceTokenUuid: source.uuid, targetUuids: [target.uuid] })) };
  scene.tokens = [source, target]; globalThis.game = { scenes: [scene] };
});
test("explicit recipients work without sight, hearing, visibility or an invented radius", () => {
  target.actor.statuses.add("blinded"); target.actor.statuses.add("deafened"); target.x = 100000;
  assert.equal(presenceApplies(source, target, "inspiring-presence"), true);
  assert.ok(LEADER_PRESENCE_DEFINITIONS.every(def => def.unlimitedRange && def.indicator === false));
  target.parent = { id: "other" }; assert.equal(presenceApplies(source, target, "inspiring-presence"), false);
});
test("source incapacitation disables presence and only the specified variants include self", () => {
  assert.equal(presenceApplies(source, source, "tactical-presence"), true);
  assert.equal(presenceApplies(source, source, "inspiring-presence"), false);
  source.actor.statuses.add("incapacitated"); assert.equal(presenceApplies(source, target, "inspiring-presence"), false);
});
test("calming bonus obeys spell level, one halving, class-healing threshold and hit-die count", () => {
  assert.equal(calmingHealingBonus(source, { spellLevel: 4 }), 8);
  assert.equal(calmingHealingBonus(source, { spellLevel: 4, longDuration: true, fast: true, multiple: true }), 4);
  assert.equal(calmingHealingBonus(source, { classHealing: true, base: 4 }), 0);
  assert.equal(calmingHealingBonus(source, { classHealing: true, base: 5 }), 2);
  assert.equal(calmingHealingBonus(source, { hitDice: 3 }), 6);
});
test("inspiring temporary HP do not compound and selecting no recipients grants no ally bonus", () => {
  assert.equal(inspiringTemporaryHp(target.actor, 10), 13);
  for (const record of source.actor.flags[MODULE_ID].leaderPresenceRecipients) record.targetUuids = [];
  assert.equal(inspiringTemporaryHp(target.actor, 10), 10);
});
test("all six cards provide a non-consuming chooser and distracting presence does not spend a reaction", () => {
  const cards = leaderDocuments.filter(item => item.flags[MODULE_ID].presence);
  assert.equal(cards.length, 6);
  for (const card of cards) { const choice = Object.values(card.system.activities).find(activity => automationAction(activity) === "choose-leader-presence-targets");
    assert.ok(choice); assert.deepEqual(choice.consumption.targets, []); }
  assert.ok(cards.find(card => card.system.identifier === "distracting-presence").system.description.value.includes("сама реакция не расходуется"));
});
