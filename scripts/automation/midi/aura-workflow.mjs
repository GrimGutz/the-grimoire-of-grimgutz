import { MODULE_ID } from "../shared/constants.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { notify } from "../shared/helpers.mjs";
import { getAreaWorkflowClass } from "./area-workflow.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";

function freezeFormula(formula, actor) {
  const data = actor.getRollData?.() ?? {};
  return String(formula).replace(/@([\w.]+)/g, (_match, path) => {
    const value = path.split(".").reduce((value, key) => value?.[key], data);
    if (!Number.isFinite(Number(value))) throw Error(`Не удалось сохранить параметр ${path}.`);
    return String(Number(value));
  });
}

export async function dispatchAutomationPulse(data) {
  const { scene, sourceToken, sourceItem, eventKey } = data;
  if (!scene || !sourceToken?.actor || !sourceItem || !data.targets?.length) return false;
  const event = structuredClone(data.event);
  if (event.dc) event.dc = freezeFormula(event.dc, sourceToken.actor);
  for (const part of event.damage ?? []) part.formula = freezeFormula(part.formula, sourceToken.actor);
  const record = {
    id: eventKey,
    kind: "native-pulse",
    sceneId: scene.id,
    sourceActorUuid: sourceToken.actor.uuid,
    sourceTokenUuid: sourceToken.document.uuid,
    sourceItemUuid: sourceItem.uuid,
    name: sourceItem.name,
    targetUuids: data.targets.map(token => token.document.uuid),
    templateUuid: data.template?.uuid ?? null,
    event,
    itemSnapshot: sourceItem.toObject()
  };
  return runAutomationEvent(record, () => useAuraPulse({ ...data, event }), {
    queued: !canvas?.ready || canvas.scene?.id !== scene.id
  });
}

registerAutomationEvent("native-pulse", async record => {
  const sourceDocument = await fromUuid(record.sourceTokenUuid),
    item = await fromUuid(record.sourceItemUuid);
  if (!sourceDocument?.actor || !item || item.actor?.uuid !== sourceDocument.actor.uuid)
    throw Error("Источник больше недоступен; результат проверьте вручную.");
  const targets = (await Promise.all(record.targetUuids.map(uuid => fromUuid(uuid))))
    .filter(document => document?.actor && document.parent?.id === record.sceneId)
    .map(document => document.object ?? { actor: document.actor, document });
  if (targets.length !== record.targetUuids.length)
    throw Error("Часть целей удалена или сменила сцену; требуется ручная проверка.");
  return useAuraPulse({
    sourceToken: sourceDocument.object ?? { actor: sourceDocument.actor, document: sourceDocument },
    sourceItem: item,
    snapshot: record.itemSnapshot,
    scene: sourceDocument.parent,
    targets,
    event: record.event,
    eventKey: record.id,
    template: record.templateUuid ? await fromUuid(record.templateUuid) : null
  });
});

/** Resolve a timed aura pulse through Midi, using its already attached Region.
 * No placement, concentration replacement, action cost, slot or item-use cost. */
export async function useAuraPulse({
  sourceToken,
  sourceItem,
  template,
  targets,
  event,
  eventKey,
  scene,
  snapshot = null
}) {
  const api = globalThis.MidiQOL,
    actor = sourceToken?.actor;
  if (!actor || !sourceItem || !targets.length) return false;
  if (canvas?.scene?.id !== scene.id || !canvas.ready) {
    notify(
      "Для бросков ауры активный GM должен открыть её сцену. Баффы и привязка продолжают работать; пропущенный урон проверьте вручную.",
      "warn"
    );
    return false;
  }
  if (!game.modules?.get("midi-qol")?.active || !api?.completeActivityUse) {
    notify("Автоматический урон/спасброски аур требуют Midi-QOL.", "warn");
    return false;
  }
  const original = snapshot ?? sourceItem.toObject(),
    activities = original.system.activities ?? {};
  const id = Object.keys(activities)[0] ?? "grimgutzaurapuls";
  const activity = {
    ...(activities[id] ?? {}),
    _id: id,
    name: sourceItem.name,
    type: event.save ? "save" : "damage",
    activation: { type: "special", value: 0, override: true, condition: "Автоматическое срабатывание ауры" },
    consumption: { targets: [], spellSlot: false, scaling: { allowed: false, max: "" } },
    uses: { max: "", spent: 0, recovery: [] },
    range: { units: "any", value: null, override: true },
    target: {
      template: { type: "", count: "" },
      affects: { type: "creature", count: "", choice: false },
      prompt: false,
      override: true
    },
    duration: { value: "", units: "inst", concentration: false, override: true },
    damage: { onSave: event.onSave ?? "none", parts: (event.damage ?? []).map(areaDamagePart) },
    effects: [],
    midiProperties: {
      autoTargetAction: "always",
      confirmTargets: "never",
      forceDamageDialog: "never",
      autoCEEffects: "itempri",
      ignoreTraits: event.ignoreTraits ?? []
    },
    // Item.clone merges nested flags. Explicitly blank the activation action so
    // its "no uses remaining" validator cannot reject later aura pulses.
    flags: {
      [MODULE_ID]: {
        ...(event.metadata ?? {}),
        action: "",
        moduleAction: "",
        areaResolved: true,
        auraPulse: true,
        auraEventKey: eventKey
      }
    }
  };
  delete activity.roll;
  delete activity.attack;
  delete activity.healing;
  delete activity.save;
  if (event.save) activity.save = { ability: [event.save], dc: { calculation: "", formula: event.dc } };
  const effects = [];
  if (event.condition) {
    const condition = event.condition,
      effectId = `aura${id}`.slice(0, 16);
    activity.effects = [{ _id: effectId, onSave: false }];
    effects.push({
      _id: effectId,
      type: "base",
      name: condition.name,
      img: sourceItem.img,
      origin: sourceItem.uuid,
      transfer: false,
      disabled: false,
      showIcon: condition.persistent ? 0 : 1,
      statuses: condition.statuses ?? [],
      start: null,
      duration: condition.duration ?? { value: null, units: "seconds", expiry: null, expired: false },
      flags: {
        [MODULE_ID]: {
          auraPersistentCondition: condition.key,
          auraConditionSource: actor.uuid,
          auraEventKey: eventKey,
          ...(condition.flags ?? {})
        },
        dae: { expiryMode: "delete" }
      },
      system: { changes: condition.changes ?? [] }
    });
  }
  const item = sourceItem.clone(
    { system: { activities: { [id]: activity } }, effects, "flags.midi-qol.syntheticItem": true },
    { keepId: true }
  );
  const resolved = item.system.activities.get(id),
    oldTargets = [...(game.user.targets ?? [])].map(token => token.id);
  const workflowOptions = {
    ignoreUserTargets: true,
    targetConfirmation: "none",
    checkTargets: false,
    autoRollDamage: "always",
    ...(event.allowIncapacitated === true ? { allowIncapacitated: true } : {}),
    fastForwardDamage: true,
    forceCompletion: true,
    noOnUseMacro: true,
    grimgutzAuraPulse: true,
    grimgutzValidatedDrain: game.user.isGM && event.metadata?.bloodDrain === true,
    ...(template?.uuid ? { templateUuid: template.uuid } : {})
  };
  const Workflow = getAreaWorkflowClass();
  const workflow = new Workflow(
    actor,
    resolved,
    ChatMessage.getSpeaker({ actor, token: sourceToken.document }),
    new Set(targets),
    { workflowOptions }
  );
  try {
    const result = await api.completeActivityUse(
      resolved,
      {
        workflow,
        create: { measuredTemplate: false },
        consume: { resources: false, spellSlot: false, action: false },
        midiOptions: {
          asUser: game.user.id,
          ignoreUserTargets: true,
          targetUuids: targets.map(token => token.document.uuid),
          workflowOptions
        }
      },
      { configure: false },
      { create: true, ...(sourceToken.document.hidden ? { rollMode: "gmroll" } : {}) }
    );
    if (result === undefined)
      notify(
        "Результат срабатывания ауры ещё не подтверждён Midi-QOL. Проверьте карточку; повторный бросок автоматически не делается.",
        "warn"
      );
    if (
      result !== false &&
      !result?.aborted &&
      (event.removeEffectOnSaveUuid || event.replaceCondition || event.returnSaveOutcome)
    ) {
      const completed = result?.workflow ?? (result?.saves ? result : workflow);
      const successes = new Set([...(completed.saves ?? [])].map(token => token.document?.uuid ?? token.uuid));
      const failures = new Set([...(completed.failedSaves ?? [])].map(token => token.document?.uuid ?? token.uuid));
      if (targets.some(token => !successes.has(token.document.uuid) && !failures.has(token.document.uuid))) {
        if (event.removeEffectOnSaveUuid)
          await (await fromUuid(event.removeEffectOnSaveUuid))?.setFlag(MODULE_ID, "repeatSaveReview", true);
        return { status: "needs-review" };
      }
      if (event.removeEffectOnSaveUuid && targets.every(token => successes.has(token.document.uuid))) {
        const effect = await fromUuid(event.removeEffectOnSaveUuid);
        if (effect?.getFlag?.(MODULE_ID, "repeatSave")?.sourceItemUuid === sourceItem.uuid) await effect.delete();
      }
      if (event.replaceCondition && event.condition)
        for (const token of targets.filter(token => failures.has(token.document.uuid))) {
          const effects = [...token.actor.effects].filter(
            effect =>
              effect.getFlag?.(MODULE_ID, "auraPersistentCondition") === event.condition.key &&
              effect.getFlag(MODULE_ID, "auraConditionSource") === actor.uuid
          );
          if (!effects.some(effect => effect.getFlag(MODULE_ID, "auraEventKey") === eventKey))
            return { status: "needs-review" };
          for (const effect of effects.filter(effect => effect.getFlag(MODULE_ID, "auraEventKey") !== eventKey))
            await effect.delete();
        }
      if (event.returnSaveOutcome) return { status: "success", saves: [...successes], failedSaves: [...failures] };
    }
    return result;
  } finally {
    if (canvas?.scene?.id === scene.id) await game.user.updateTokenTargets?.(oldTargets);
  }
}
