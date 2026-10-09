import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../src/common.mjs";
import { documents as features } from "../src/packs/features.mjs";
import { documents as bestiary } from "../src/packs/bestiary.mjs";
import { configureNpcAuraCards } from "../src/auras.mjs";
import { automationAction } from "../scripts/automation/shared/helpers.mjs";
import { getAutomationActionHandlers } from "../scripts/automation/runtime.mjs";

test("carnage card offers a registered, non-consuming damage-type choice", () => {
  const card = features.find(item => item.system.identifier === "aura-of-carnage");
  const activity = Object.values(card.system.activities).find(activity => automationAction(activity) === "choose-carnage-aura-type");
  assert.ok(activity); assert.equal(typeof getAutomationActionHandlers().get(automationAction(activity)), "function");
  assert.deepEqual(activity.consumption.targets, []); assert.equal(activity.consumption.spellSlot, false);
  assert.ok(card.system.description.value.includes("включая владельца"));
});

test("NPC aura notes use canonical config and are not duplicated on reconfiguration", () => {
  const items = bestiary.flatMap(actor => actor._embeddedItems ?? []).filter(item => item.flags?.[MODULE_ID]?.auraDefinitionId);
  assert.equal(items.length, 4);
  const before = items.map(item => item.system.description.value); configureNpcAuraCards(bestiary);
  assert.deepEqual(items.map(item => item.system.description.value), before);
  for (const item of items) assert.equal(item.flags[MODULE_ID].automation.data.auraDefinitionId, item.flags[MODULE_ID].auraDefinitionId);
});

test("demonic vitality card identifies its aura and documents native retaliation, not a reminder roll", () => {
  const card = features.find(item => item.system.identifier === "demonic-vitality");
  assert.equal(card.flags[MODULE_ID].automation.data.auraDefinitionId, "demonologist-vitality");
  assert.ok(card.system.description.value.includes("иммунитет сохраняется"));
  assert.ok(card.system.description.value.includes("привязанный к токену"));
  assert.equal(card.system.description.value.includes("выводится в чат как напоминание"), false);
});

test("divine devotion keeps its self-immunity and identifies its separate ally aura", () => {
  const card = features.find(item => item.system.identifier === "divine-devotion");
  assert.equal(card.flags[MODULE_ID].automation.data.auraDefinitionId, "crusader-divine-devotion");
  assert.ok(card.system.description.value.includes("преимущество только на спасброски от смерти"));
  assert.deepEqual(card.effects[0].system.changes.map(change => change.value), ["frightened", "charmed"]);
});
