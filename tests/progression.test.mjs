import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import { documents as transformations } from "../src/packs/transformations.mjs";
import { documents as features } from "../src/packs/features.mjs";
import { documents as subclasses } from "../src/packs/subclasses.mjs";
import { hollowTransformationLevel } from "../scripts/automation/transformations/hollow.mjs";
import { murderspawnTransformationLevel } from "../scripts/automation/transformations/murderspawn.mjs";
import {arkaneTransformationLevel} from "../scripts/automation/transformations/arkane.mjs";
import {automatonTransformationLevel} from "../scripts/automation/transformations/automaton.mjs";
import {broodmotherTransformationLevel} from "../scripts/automation/transformations/broodmother.mjs";
import {chimeraTransformationLevel} from "../scripts/automation/transformations/chimera.mjs";

const byUuid = new Map(features.map(feature => [`Compendium.${MODULE_ID}.features.Item.${feature._id}`, feature]));
for (const root of transformations) test(`${root.name}: levels 1/6/11/16 grant flaws and exactly one accumulated boon`, () => {
  const grants = root.system.advancement.filter(advancement => advancement.type === "ItemGrant");
  const choices = root.system.advancement.filter(advancement => advancement.type === "ItemChoice");
  assert.deepEqual(grants.map(grant => grant.level), [1, 6, 11, 16]);
  assert.equal(grants[0].configuration.items.length, 3);
  assert.ok(grants.slice(1).every(grant => grant.configuration.items.length === 1 && !grant.configuration.optional));
  let previous = [];
  for (const [index, choice] of choices.entries()) {
    const level = [6, 11, 16][index], tier = index + 2;
    assert.deepEqual(choice.configuration.choices, { [level]: { count: 1, replacement: false } });
    assert.equal(choice.configuration.allowDrops, false);
    const pool = choice.configuration.pool.map(entry => entry.uuid);
    assert.ok(previous.every(uuid => pool.includes(uuid)));
    assert.ok(pool.every(uuid => Number(byUuid.get(uuid)?.flags[MODULE_ID]?.transformationLevel) <= tier));
    previous = pool;
  }
  const getLevel = {hollow:hollowTransformationLevel,murderspawn:murderspawnTransformationLevel,arkane:arkaneTransformationLevel,automaton:automatonTransformationLevel,broodmother:broodmotherTransformationLevel,chimera:chimeraTransformationLevel}[root.flags[MODULE_ID].transformation];
  for (const characterLevel of [1, 5, 6, 10, 11, 15, 16, 20]) {
    const items = grants.filter(grant => grant.level <= characterLevel).flatMap(grant => grant.configuration.items.map(entry => byUuid.get(entry.uuid)));
    // Choosing an older boon must not lower the new transformation tier: its mandatory flaw defines it.
    if (characterLevel >= 6) items.push(byUuid.get(choices[0].configuration.pool[0].uuid));
    assert.equal(getLevel({ items }), Math.min(4, Math.ceil(characterLevel / 5)));
  }
});

test("subclasses remain bound to their base classes with resolvable feature grants", () => {
  assert.deepEqual(new Set(subclasses.map(subclass => subclass.system.classIdentifier)), new Set(["wizard", "keeper", "spirit-vessel", "master"]));
  for (const subclass of subclasses) for (const advancement of subclass.system.advancement) {
    if (advancement.type !== "ItemGrant") continue;
    for (const entry of advancement.configuration.items) if (entry.uuid.startsWith(`Compendium.${MODULE_ID}.`)) assert.ok(byUuid.has(entry.uuid), `${subclass.name}: ${entry.uuid}`);
  }
});
