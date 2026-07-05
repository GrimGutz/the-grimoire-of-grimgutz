import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { automationData, isAutomationAuthority, itemIdentifier } from "../shared/helpers.mjs";
import { passiveEffectSignature } from "./passive-helpers.mjs";

const passiveEffectSyncs = new Set();
let migrationSourcesPromise;

function passiveSource(effect) {
  return effect?.getFlag?.(MODULE_ID, FLAGS.PASSIVE_SOURCE)
    ?? effect?.flags?.[MODULE_ID]?.[FLAGS.PASSIVE_SOURCE];
}

export async function moduleItemSources() {
  migrationSourcesPromise ??= (async () => {
    const sourceDocuments = [];
    for (const packName of ["classes", "subclasses", "features", "transformations", "spells", "equipment"]) {
      const pack = game.packs.get(`${MODULE_ID}.${packName}`);
      if (pack) sourceDocuments.push(...await pack.getDocuments());
    }
    return new Map(sourceDocuments.map(item => [itemIdentifier(item), item]));
  })();
  return migrationSourcesPromise;
}

export function isLikelyModuleItem(item, source) {
  const compendiumSource = String(item?._stats?.compendiumSource ?? "");
  if (compendiumSource.startsWith(`Compendium.${MODULE_ID}.`)) return true;
  return itemIdentifier(item) === itemIdentifier(source) && item.name === source.name;
}

function normalizePassiveChanges(actor, item, changes) {
  const feature = automationData(item).feature ?? itemIdentifier(item);
  return changes.map(change => {
    const normalized = foundry.utils.deepClone(change);
    normalized.key = normalized.key
      .replace("system.attributes.senses.darkvision", "system.attributes.senses.ranges.darkvision")
      .replace("system.attributes.senses.blindsight", "system.attributes.senses.ranges.blindsight");
    if (feature === "forest-barkskin" && normalized.key === "system.attributes.ac.bonus") {
      normalized.value = String(Math.max(1, Number(actor.system?.abilities?.con?.mod ?? 0)));
    }
    return normalized;
  });
}

function actorPassiveEffectData(actor, item, effect) {
  const data = effect.toObject();
  delete data._id;
  data.transfer = false;
  data.origin = item.uuid;
  data.system ??= {};
  data.system.changes = normalizePassiveChanges(actor, item, data.system.changes ?? []);
  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}),
    [FLAGS.PASSIVE_SOURCE]: {
      itemId: item.id,
      effectId: effect.id
    }
  };
  return data;
}

export async function syncModulePassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || passiveEffectSyncs.has(actor.uuid)) return;
  passiveEffectSyncs.add(actor.uuid);
  try {
    const sources = await moduleItemSources();
    const desired = new Map();
    for (const item of actor.items) {
      if (automationData(item).aberrantFeature === true) continue;
      if (automationData(item).forestLordFeature === true) continue;
      if (automationData(item).deathKnightFeature === true) continue;
      if (automationData(item).leaderFeature === true) continue;
      if (automationData(item).hereticFeature === true) continue;
      if (automationData(item).murderspawnFeature === true) continue;
      if (automationData(item).hollowFeature === true) continue;
      if (automationData(item).spiritVesselFeature === true) continue;
      if (automationData(item).oracleFeature === true) continue;
      const source = sources.get(itemIdentifier(item));
      const sourceEffects = source && isLikelyModuleItem(item, source)
        ? [...(source.effects ?? [])]
        : [];
      const effects = sourceEffects.some(effect => effect.getFlag(MODULE_ID, "passiveEffect") === true)
        ? sourceEffects
        : [...(item.effects ?? [])];
      for (const effect of effects) {
        if (effect.getFlag(MODULE_ID, "passiveEffect") !== true) continue;
        const key = `${item.id}:${effect.id}`;
        desired.set(key, actorPassiveEffectData(actor, item, effect));
      }
    }

    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = passiveSource(effect);
      if (!source?.itemId || !source?.effectId) continue;
      existing.set(`${source.itemId}:${source.effectId}`, effect);
    }

    const creates = [];
    const updates = [];
    for (const [key, data] of desired) {
      const current = existing.get(key);
      if (!current) {
        creates.push(data);
        continue;
      }
      if (passiveEffectSignature(current) !== passiveEffectSignature(data)) {
        updates.push({ _id: current.id, ...data });
      }
      existing.delete(key);
    }

    const deletes = [...existing.values()].map(effect => effect.id);
    if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
  } finally {
    passiveEffectSyncs.delete(actor.uuid);
  }
}
