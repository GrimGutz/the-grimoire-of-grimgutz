export function passiveEffectSignature(effect) {
  const data = effect?.toObject ? effect.toObject() : effect;
  return JSON.stringify({
    name: data?.name,
    img: data?.img,
    disabled: data?.disabled,
    showIcon: data?.showIcon,
    system: data?.system
  });
}

export function flaggedPassiveSource(moduleId, flag, effect) {
  return effect?.getFlag?.(moduleId, flag) ?? effect?.flags?.[moduleId]?.[flag];
}

export function flaggedPassiveEffectData(moduleId, flag, { key, feature, name = feature?.name, img = feature?.img, changes = [], description = "" }) {
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
    system: { changes }
  };
}

export async function syncFlaggedPassiveEffects(actor, syncSet, moduleId, flag, definitions) {
  if (syncSet.has(actor.uuid)) return;
  syncSet.add(actor.uuid);
  try {
    const desired = new Map(
      definitions(actor).map(effect => [flaggedPassiveSource(moduleId, flag, effect), effect])
    );
    const existing = new Map();
    for (const effect of actor.effects ?? []) {
      const source = flaggedPassiveSource(moduleId, flag, effect);
      if (source) existing.set(source, effect);
    }

    const creates = [];
    const updates = [];
    for (const [key, data] of desired) {
      const current = existing.get(key);
      if (!current) {
        creates.push(data);
      } else if (passiveEffectSignature(current) !== passiveEffectSignature(data)) {
        updates.push({ _id: current.id, ...data });
      }
      existing.delete(key);
    }

    const deletes = [...existing.values()].map(effect => effect.id);
    if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
  } finally {
    syncSet.delete(actor.uuid);
  }
}
