export function passiveEffectSignature(effect) {
  const data = effect?.toObject ? effect.toObject() : effect;
  return JSON.stringify({
    name: data?.name,
    img: data?.img,
    disabled: data?.disabled,
    showIcon: data?.showIcon,
    origin: data?.origin ?? null,
    statuses: [...(data?.statuses ?? [])].sort(),
    duration: data?.duration,
    system: data?.system
  });
}

export function normalizedPassiveSignature(current, data) {
  return passiveEffectSignature(current?.clone?.(data) ?? data);
}

export function flaggedPassiveSource(moduleId, flag, effect) {
  return effect?.getFlag?.(moduleId, flag) ?? effect?.flags?.[moduleId]?.[flag];
}

export function flaggedPassiveEffectData(
  moduleId,
  flag,
  { key, feature, name = feature?.name, img = feature?.img, changes = [], description = "" }
) {
  return {
    name,
    img,
    type: "base",
    description,
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    tint: "#ffffff",
    start: null,
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    flags: {
      [moduleId]: {
        [flag]: key
      }
    },
    // Every module passive passes through here: keep its keys on the running dnd5e layout.
    system: { changes: changes.map(change => ({ ...change, key: effectKey(change.key) })) }
  };
}

export async function syncFlaggedPassiveEffects(actor, syncSet, moduleId, flag, definitions) {
  if (syncSet.has(actor.uuid)) return;
  syncSet.add(actor.uuid);
  try {
    const desired = new Map(definitions(actor).map(effect => [flaggedPassiveSource(moduleId, flag, effect), effect]));
    const existing = new Map();
    const deletes = [];
    for (const effect of actor.effects ?? []) {
      const source = flaggedPassiveSource(moduleId, flag, effect);
      if (!source) continue;
      if (existing.has(source)) deletes.push(effect.id);
      else existing.set(source, effect);
    }

    const creates = [];
    const updates = [];
    for (const [key, data] of desired) {
      const current = existing.get(key);
      const guarded = guardPassiveChanges(current, data, moduleId);
      if (!current) {
        creates.push(guarded);
      } else if (
        guarded &&
        (passiveEffectSignature(current) !== normalizedPassiveSignature(current, guarded) ||
          !current.flags?.[moduleId]?.managedPassiveChanges)
      ) {
        updates.push({ _id: current.id, ...guarded });
      }
      existing.delete(key);
    }

    deletes.push(...[...existing.values()].map(effect => effect.id));
    if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length)
      await recordPassiveSnapshots(actor, await actor.createEmbeddedDocuments("ActiveEffect", creates), moduleId);
  } finally {
    syncSet.delete(actor.uuid);
  }
}
import { migrationFingerprint } from "../shared/owned-item-migration.mjs";
import { effectKey } from "../shared/system-paths.mjs";

export function guardPassiveChanges(current, data, moduleId) {
  const changes = current?.toObject?.().system?.changes ?? current?.system?.changes ?? [];
  const normalized = current?.clone?.(data)?.toObject?.() ?? data;
  const desired = normalized.system?.changes ?? [];
  const currentHash = migrationFingerprint(changes),
    desiredHash = migrationFingerprint(desired);
  const previous =
    current?.getFlag?.(moduleId, "managedPassiveChanges") ?? current?.flags?.[moduleId]?.managedPassiveChanges;
  if (current && currentHash !== desiredHash && previous !== currentHash) return null;
  const presentation = {
    ...(current?.getFlag?.(moduleId, "managedPassivePresentation") ??
      current?.flags?.[moduleId]?.managedPassivePresentation)
  };
  const result = { ...data, disabled: current?.disabled ?? data.disabled };
  const currentData = current?.toObject?.() ?? current;
  for (const field of ["name", "img", "description", "statuses"]) {
    if (!(field in data)) continue;
    const before = migrationFingerprint(currentData?.[field]),
      after = migrationFingerprint(normalized[field]);
    if (current && before !== after && presentation[field] !== before) result[field] = currentData[field];
    else presentation[field] = after;
  }
  result.flags = {
    ...data.flags,
    [moduleId]: {
      ...data.flags?.[moduleId],
      managedPassiveChanges: desiredHash,
      managedPassivePresentation: presentation
    }
  };
  return result;
}

export async function recordPassiveSnapshots(actor, documents, moduleId) {
  const updates = [];
  for (const effect of documents ?? []) {
    const changes = effect.toObject?.().system?.changes ?? effect.system?.changes ?? [];
    const signature = migrationFingerprint(changes);
    if (effect.getFlag?.(moduleId, "managedPassiveChanges") === signature) continue;
    updates.push({ _id: effect.id, [`flags.${moduleId}.managedPassiveChanges`]: signature });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
}
