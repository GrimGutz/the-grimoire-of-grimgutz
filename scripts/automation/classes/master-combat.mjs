import { MODULE_ID } from "../shared/constants.mjs";
import { automationAction, automationData, enabled, findFeature, notify } from "../shared/helpers.mjs";
import {
  masterLevel,
  masterPath,
  masterConfiguration,
  masterMatchesSpell,
  masterMatchesWeapon,
  masterDC,
  masterFeatureAvailable,
  masterSettings,
  masterTechniqueUsage,
  recordMasterTechnique,
  releaseMasterTechnique,
  extendMasterCasting
} from "./master.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import {
  addCombatBenefit,
  activeBenefits,
  benefitData,
  canReact,
  inFeet,
  recordModuleReaction,
  tokenRef,
  turnKey
} from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { inspiringTemporaryHp } from "../shared/leader-presence-definitions.mjs";
import { installMasterBladeHooks } from "./master-blade.mjs";
import { effectKey } from "../shared/system-paths.mjs";

const isChild = activity =>
  automationData(activity).masterChild || automationData(activity).leaderResolved || automationData(activity).auraPulse;
const eligible = workflow =>
  workflow?.actor &&
  enabled() &&
  masterLevel(workflow.actor) &&
  !automationData(workflow.activity).auraPulse &&
  (masterMatchesWeapon(workflow.actor, workflow.item) || masterMatchesSpell(workflow.actor, workflow.item));
const featureActive = (actor, id) => {
  const item = findFeature(actor, `master-${id}`);
  return item && masterFeatureAvailable(actor, item) ? item : null;
};
const sourceFor = actor =>
  canvas?.tokens?.controlled?.find(t => t.actor?.uuid === actor.uuid)?.document ??
  actor.getActiveTokens?.()[0]?.document;
const useId = workflow => String(workflow.id ?? workflow.uuid);
const currentTurn = source => turnKey(encounterForScene(source.parent, source));
const rangeFeet = (value, units) => Number(value) * (units === "m" ? 1 / 0.3048 : units === "yd" ? 3 : 1);
const extraRange = (feet, units) => (units === "m" ? feet * 0.3048 : units === "yd" ? feet / 3 : feet);

export function removeMasterRangeDisadvantage(tracker, source = "range") {
  if (!tracker?.toJSON || !tracker?.restore) return false;
  const state = structuredClone(tracker.toJSON());
  if (!state.attribution?.DIS || !Object.hasOwn(state.attribution.DIS, source)) return false;
  delete state.attribution.DIS[source];
  if (!Object.keys(state.attribution.DIS).length && !state.disadvantage.override) state.disadvantage.active = false;
  // Do not clear disadvantage from blindness, other targets, manual overrides,
  // or any other attributed rule.
  tracker.restore(state);
  return true;
}
export function masterCriticalThreshold(current, actor, item) {
  return featureActive(actor, "path-apex") && (masterMatchesWeapon(actor, item) || masterMatchesSpell(actor, item))
    ? Math.max(1, Number(current ?? 20) - 1)
    : current;
}
export function masterWeaponDice(item, count = 2) {
  const base = item?.system?.damage?.base;
  return base && !base.custom?.enabled && Number(base.denomination) > 0
    ? `${count}d${Number(base.denomination)}`
    : null;
}
export function masterReliableFormula(formula) {
  return String(formula).replace(
    /(\d*d\d+)(?:min(\d+))?/g,
    (_match, dice, floor) => `${dice}min${Math.max(2, Number(floor ?? 0))}`
  );
}
export function selectedSchoolTempHp(before, after, castLevel, proficiency) {
  const spent = Object.keys(before).filter(
    k => Number(before[k].value) - Number(after[k]?.value) === 1 && Number(before[k].level) === castLevel
  );
  return castLevel > 0 &&
    spent.length === 1 &&
    Object.keys(before).filter(k => Number(before[k].value) > Number(after[k]?.value)).length === 1
    ? Number(proficiency) + Number(castLevel)
    : 0;
}
const slotSnapshot = actor =>
  Object.fromEntries(
    Object.entries(actor.system.spells ?? {})
      .filter(([key]) => /^(spell[1-9]|pact)$/.test(key))
      .map(([key, slot]) => [
        key,
        { value: Number(slot.value ?? 0), level: Number(key === "pact" ? slot.level : key.replace("spell", "")) }
      ])
  );

export function prepareMasterActivity(workflow) {
  if (!eligible(workflow) || workflow.grimgutzMaster) return;
  const actor = workflow.actor,
    config = masterConfiguration(actor),
    original = workflow.activity;
  const data = original.toObject(),
    ready = actor.getFlag(MODULE_ID, "masterReady"),
    source = tokenRef(workflow.token);
  const weaponReady =
    ready &&
    ["risky-maneuver", "long-lunge", "deadly-range"].includes(ready.id) &&
    masterMatchesWeapon(actor, workflow.item) &&
    (ready.id !== "long-lunge" || original.attack?.type?.value === "melee");
  const spellReady =
    ready &&
    ["distant-formula", "expanded-formula", "elemental-mastery", "reliable-formula"].includes(ready.id) &&
    masterMatchesSpell(actor, workflow.item);
  const matchingReady =
    !isChild(original) &&
    (weaponReady || spellReady) &&
    featureActive(actor, ready.id) &&
    masterTechniqueUsage(actor, useId(workflow), `master-${ready.id}`, source?.parent ? currentTurn(source) : null)
      ? ready
      : null;
  const range = workflow.item.system?.range,
    patch = {};
  if (masterMatchesWeapon(actor, workflow.item) && featureActive(actor, "long-shot") && range?.value != null) {
    patch["system.range.value"] = Number(range.value) + extraRange(30, range.units);
    if (Number(range.long) > 0) patch["system.range.long"] = Number(range.long) + extraRange(90, range.units);
  }
  if (masterMatchesWeapon(actor, workflow.item) && config.reloadProperty && featureActive(actor, "rapid-reload"))
    patch["system.properties"] = [...(workflow.item.system.properties ?? [])].filter(p => p !== config.reloadProperty);
  const normalRange = patch["system.range.value"] ?? range?.value;
  if (
    masterMatchesSpell(actor, workflow.item) &&
    featureActive(actor, "school-specialist") &&
    data.type === "save" &&
    Number.isFinite(Number(original.save?.dc?.value))
  )
    data.save = { ...data.save, dc: { calculation: "", formula: String(Number(original.save.dc.value) + 1) } };
  let preparedApplied = false;
  if (
    matchingReady?.id === "distant-formula" &&
    masterMatchesSpell(actor, workflow.item) &&
    rangeFeet(original.range.value, original.range.units) >= 5
  ) {
    data.range = {
      ...data.range,
      value: Number(original.range.value) + extraRange(30, original.range.units),
      override: true
    };
    preparedApplied = true;
  }
  if (
    matchingReady?.id === "expanded-formula" &&
    masterMatchesSpell(actor, workflow.item) &&
    ["cone", "cube", "line", "sphere", "cylinder"].includes(data.target?.template?.type)
  ) {
    const dimension = matchingReady.options?.dimension ?? "size",
      value = Number(data.target.template[dimension]);
    if (value > 0) {
      data.target = {
        ...data.target,
        template: { ...data.target.template, [dimension]: String(value + extraRange(5, data.target.template.units)) }
      };
      preparedApplied = true;
    }
  }
  if (
    matchingReady?.id === "long-lunge" &&
    masterMatchesWeapon(actor, workflow.item) &&
    original.attack?.type?.value === "melee"
  ) {
    data.range = {
      ...data.range,
      value: Number(original.range?.value ?? range?.reach ?? 5) + extraRange(5, original.range.units || "ft"),
      units: original.range.units || "ft",
      override: true
    };
    preparedApplied = true;
  }
  if (matchingReady?.id === "elemental-mastery") {
    for (const part of data.damage?.parts ?? []) {
      if (part.types?.includes(matchingReady.options.originalType)) {
        part.types = part.types.map(t =>
          t === matchingReady.options.originalType ? matchingReady.options.damageType : t
        );
        preparedApplied = true;
      }
    }
  }
  // A workflow owns its clone. Never update the actor's equipped Item in place.
  const item = original.item.clone({ ...patch, system: { activities: { [original.id]: data } } }, { keepId: true });
  workflow.item = item;
  workflow.activity = item.system.activities.get(original.id);
  workflow.grimgutzMaster = {
    ready: matchingReady,
    originalActivityUuid: original.uuid,
    normalRange,
    rangeUnits: range?.units ?? "ft",
    sourceUuid: source?.uuid,
    turn: source?.parent ? currentTurn(source) : null,
    slots: slotSnapshot(actor),
    preparedApplied
  };
}
export function prepareMasterAttack(workflow) {
  if (!eligible(workflow)) return;
  if (masterPath(workflow.actor) === "archer" && masterMatchesWeapon(workflow.actor, workflow.item))
    removeMasterRangeDisadvantage(workflow.attackRollModifierTracker, "range");
  if (featureActive(workflow.actor, "point-blank"))
    removeMasterRangeDisadvantage(workflow.attackRollModifierTracker, "nearbyFoe");
}
export function applyMasterAttackConfig(config) {
  if (!enabled() || config.grimgutzMasterAttack) return;
  const activity = config.subject,
    actor = activity?.actor;
  if (
    !actor ||
    automationData(activity).auraPulse ||
    !(masterMatchesWeapon(actor, activity.item) || masterMatchesSpell(actor, activity.item))
  )
    return;
  for (const roll of config.rolls ?? []) {
    roll.options ??= {};
    roll.options.criticalSuccess = masterCriticalThreshold(
      roll.options.criticalSuccess ?? activity.attack?.critical?.threshold ?? 20,
      actor,
      activity.item
    );
    if (masterMatchesSpell(actor, activity.item) && featureActive(actor, "school-specialist")) {
      roll.parts ??= [];
      roll.parts.push("1");
    }
    if (config.workflow?.grimgutzMaster?.ready?.id === "risky-maneuver" && masterMatchesWeapon(actor, activity.item)) {
      roll.parts ??= [];
      roll.parts.push("-2");
      config.workflow.grimgutzMaster.preparedApplied = true;
    }
  }
  config.grimgutzMasterAttack = true;
}
export function applyMasterDamageConfig(config) {
  const workflow = config.workflow,
    state = workflow?.grimgutzMaster;
  if (
    !eligible(workflow) ||
    !state?.ready ||
    config.grimgutzMasterDamage ||
    (!workflow.hitTargets?.size && workflow.item.type === "weapon")
  )
    return;
  const id = state.ready.id,
    activity = config.subject;
  if (activity?.type === "heal") return;
  let addition;
  if (id === "risky-maneuver" && masterMatchesWeapon(workflow.actor, workflow.item)) addition = "4";
  if (id === "deadly-range" && masterMatchesWeapon(workflow.actor, workflow.item) && workflow.hitTargets.size === 1) {
    const target = [...workflow.hitTargets][0],
      source = tokenRef(workflow.token);
    if (inFeet(source, target, rangeFeet(state.normalRange, state.rangeUnits), source.parent))
      addition = masterWeaponDice(workflow.item);
  }
  for (const roll of config.rolls ?? []) {
    if (["healing", "temphp"].includes(roll.options?.type)) continue;
    roll.parts ??= [];
    if (addition) {
      roll.parts.push(addition);
      state.preparedApplied = true;
    }
    if (id === "reliable-formula" && masterMatchesSpell(workflow.actor, workflow.item)) {
      roll.parts = roll.parts.map(part => (typeof part === "string" ? masterReliableFormula(part) : part));
      state.preparedApplied = true;
    }
  }
  config.grimgutzMasterDamage = true;
}

registerGmRequest("master-remember", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid);
  if (
    activity?.actor?.uuid !== actor.uuid ||
    source?.actor?.uuid !== actor.uuid ||
    !(masterMatchesWeapon(actor, activity.item) || masterMatchesSpell(actor, activity.item))
  )
    return false;
  const hits = [];
  for (const uuid of data.hits ?? []) {
    const target = await fromUuid(uuid);
    if (target?.parent?.id === source.parent.id) hits.push(uuid);
  }
  const targets = [];
  for (const uuid of data.targets ?? []) {
    const target = await fromUuid(uuid);
    if (target?.parent?.id === source.parent.id) targets.push(uuid);
  }
  const context = {
    workflowId: data.workflowId,
    activityUuid: activity.uuid,
    sourceUuid: source.uuid,
    hits,
    targets,
    attack: activity.type === "attack" && data.attack === true,
    turn: data.turn,
    spell: activity.item.type === "spell",
    tempHp: Number(data.tempHp ?? 0),
    castLevel: data.castLevel
  };
  await actor.setFlag(MODULE_ID, "masterLastUse", context);
  if (data.ready && data.applied && featureActive(actor, data.ready.id)) {
    await recordMasterTechnique(actor, data.workflowId, `master-${data.ready.id}`, data.turn);
    const current = actor.getFlag(MODULE_ID, "masterReady");
    if (current?.nonce === data.ready.nonce) await actor.unsetFlag(MODULE_ID, "masterReady");
  }
  return true;
});
async function rememberMasterUse(workflow) {
  if (!eligible(workflow) || isChild(workflow.activity) || workflow.aborted || !workflow.grimgutzMaster?.sourceUuid)
    return;
  const state = workflow.grimgutzMaster,
    castLevel = Number(workflow.castData?.castLevel ?? workflow.spellLevel ?? workflow.item.system.level ?? 0);
  const applied = state.preparedApplied;
  const tempHp =
    workflow.item.type === "spell" && featureActive(workflow.actor, "protective-formula")
      ? selectedSchoolTempHp(
          state.slots,
          slotSnapshot(workflow.actor),
          castLevel,
          workflow.actor.system.attributes.prof
        )
      : 0;
  const remembered = await requestGm(
    "master-remember",
    workflow.actor,
    {
      workflowId: useId(workflow),
      activityUuid: state.originalActivityUuid,
      sourceUuid: state.sourceUuid,
      hits: [...(workflow.hitTargets ?? [])].map(t => tokenRef(t).uuid),
      targets: [...(workflow.targets ?? [])].map(t => tokenRef(t).uuid),
      attack: Boolean(workflow.attackRoll),
      turn: state.turn,
      tempHp,
      castLevel,
      ready: state.ready,
      applied
    },
    { requestId: `master-remember:${useId(workflow)}` }
  );
  if (remembered.status === "success" && tempHp > 0)
    await requestGm(
      "master-formula-offer",
      workflow.actor,
      { workflowId: useId(workflow) },
      { requestId: `master-formula:${useId(workflow)}`, timeoutMs: 120000 }
    );
}
async function applyMasterProtection(actor, item, context) {
  if (
    !masterFeatureAvailable(actor, item) ||
    !context.tempHp ||
    !masterTechniqueUsage(actor, context.workflowId, item.system.identifier, context.turn)
  )
    return false;
  if (!(await confirmOwner(actor, item.name, `Применить ${context.tempHp} временных хитов за подтверждённую ячейку?`)))
    return false;
  if (!(await recordMasterTechnique(actor, context.workflowId, item.system.identifier, context.turn))) return false;
  const amount = inspiringTemporaryHp(actor, context.tempHp);
  if (Number(actor.system.attributes.hp.temp ?? 0) < amount)
    await actor.update({ "system.attributes.hp.temp": amount });
  return true;
}
registerAutomationEvent("master-protective-formula", async record => {
  const actor = await fromUuid(record.sourceActorUuid),
    item = await fromUuid(record.sourceItemUuid);
  if (!actor || !item || item.actor?.uuid !== actor.uuid) throw Error("Источник Защитной формулы недоступен.");
  return applyMasterProtection(actor, item, record.input.context);
});
registerGmRequest("master-formula-offer", async (actor, data) => {
  const context = actor.getFlag(MODULE_ID, "masterLastUse"),
    item = featureActive(actor, "protective-formula");
  if (!context || context.workflowId !== data.workflowId || !context.spell || !context.tempHp || !item) return false;
  const source = await fromUuid(context.sourceUuid);
  if (source?.actor?.uuid !== actor.uuid) return false;
  return runAutomationEvent(
    {
      id: `master-formula:${context.workflowId}`,
      kind: "master-protective-formula",
      sceneId: source.parent.id,
      sourceActorUuid: actor.uuid,
      sourceItemUuid: item.uuid,
      name: item.name,
      input: { context }
    },
    () => applyMasterProtection(actor, item, context)
  );
});
async function saveTarget(actor, item, source, target, save, context, condition = null) {
  return useAuraPulse({
    scene: source.parent,
    sourceToken: source.object ?? { actor: source.actor, document: source },
    sourceItem: item,
    targets: [target.object ?? { actor: target.actor, document: target }],
    eventKey: `master-save:${context.workflowId}:${item.id}:${target.uuid}`,
    event: {
      save,
      dc: String(masterDC(actor)),
      damage: [],
      returnSaveOutcome: true,
      ...(condition ? { condition } : {})
    }
  });
}
async function applyHitTechnique(actor, item, source, target, context, options) {
  const id = automationData(item).masterControl;
  if (id === "blade-onslaught") {
    const order = ["tiny", "sm", "med", "lg", "huge", "grg"];
    const a = order.indexOf(actor.system.traits.size),
      b = order.indexOf(target.actor.system.traits.size);
    if (a < 0 || b < 0 || b > a + 1) return false;
    const result = await saveTarget(
      actor,
      item,
      source,
      target,
      "str",
      context,
      options.prone ? { name: "Натиск клинка: сбит с ног", statuses: ["prone"] } : null
    );
    if (!options.prone && result?.failedSaves?.includes(target.uuid))
      notify("Спасбросок провален: переместите цель на 10 футов от Мастера вручную.");
    return result;
  }
  if (id === "disarming-strike") {
    const result = await saveTarget(actor, item, source, target, "str", context);
    if (result?.failedSaves?.includes(target.uuid))
      notify(
        "Спасбросок провален: цель роняет выбранный удерживаемый предмет; предмет и его положение определите вручную."
      );
    return result;
  }
  if (id === "suppressing-shot") {
    const result = await saveTarget(actor, item, source, target, "wis", context);
    if (!result || result.status === "needs-review" || result.aborted) return result;
    if (result.failedSaves?.includes(target.uuid))
      await addCombatBenefit(source, target, item, {
        kind: "attack-disadvantage",
        remaining: 1,
        expiry: "sourceStart"
      });
    return result;
  }
  if (id === "steel-barrier")
    return addCombatBenefit(source, target, item, {
      kind: "attack-disadvantage",
      remaining: 1,
      expiry: "sourceStart",
      notAgainst: [source.uuid]
    });
  if (id === "disrupting-shot")
    return addCombatBenefit(source, target, item, {
      kind: "master-no-reactions",
      expiry: "sourceStart",
      changes: [
        {
          key: "flags.midi-qol.actions.reactionsUsed",
          value: String(target.actor.getFlag?.("midi-qol", "actions")?.reactionsMax ?? 1),
          type: "upgrade",
          phase: "initial",
          priority: 100
        }
      ]
    });
  if (id === "pinning-maneuver") {
    if (activeBenefits(target.actor).some(effect => benefitData(effect).kind === "master-pinning")) {
      notify("У цели уже есть Пригвождение. Пересечение источников требует решения GM.", "warn");
      return false;
    }
    let pinned = false;
    if (options.anchor) {
      const result = await saveTarget(actor, item, source, target, "str", context);
      if (!result || result.status === "needs-review" || result.aborted) return result;
      pinned = result.failedSaves?.includes(target.uuid);
    }
    const movement = target.actor.system.attributes.movement;
    return addCombatBenefit(source, target, item, {
      kind: "master-pinning",
      expiry: "sourceStart",
      changes: ["walk", "fly", "swim", "climb", "burrow"]
        .filter(k => Number(movement[k]) > 0)
        .map(k => ({
          key: effectKey(`system.attributes.movement.${k}`),
          value: pinned ? "0" : String(-Math.min(Number(movement[k]), extraRange(10, movement.units))),
          type: pinned ? "override" : "add",
          phase: "final",
          priority: 30
        }))
    });
  }
  return false;
}

async function nativeWeaponAttack(actor, activity, target, { reaction = false, noAbility = false } = {}) {
  const data = activity.toObject();
  data.activation = { type: reaction ? "reaction" : "special", value: reaction ? 1 : 0, override: true };
  data.flags = {
    ...data.flags,
    [MODULE_ID]: { ...data.flags?.[MODULE_ID], masterChild: true, action: "", moduleAction: "" }
  };
  if (noAbility) {
    const base = activity.item.system.damage.base;
    if (base.custom?.enabled || !Number(base.denomination))
      throw Error("Нестандартный базовый урон: атаку без модификатора нужно проверить вручную.");
    const bonus = [base.bonus?.replace(/@mod\b/g, "0"), activity.item.system.magicalBonus].filter(Boolean).join(" + ");
    data.damage = {
      ...data.damage,
      includeBase: false,
      parts: [
        areaDamagePart({
          formula: `${base.number}d${base.denomination}${bonus ? ` + ${bonus}` : ""}`,
          type: [...base.types][0]
        }),
        ...(data.damage.parts ?? [])
      ]
    };
  }
  const item = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  const result = await MidiQOL.completeActivityUse(
    item.system.activities.get(activity.id),
    {
      midiOptions: {
        targetUuids: [target.uuid],
        ignoreUserTargets: true,
        workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
      }
    },
    { configure: false }
  );
  if (result && !result.aborted && reaction) await recordModuleReaction(actor, target.parent);
  return result;
}
async function chooseMasterAttack(actor) {
  const candidates = [...actor.items]
    .filter(i => masterMatchesWeapon(actor, i) && i.system.equipped === true)
    .flatMap(i => [...i.system.activities.values()].filter(a => a.type === "attack"));
  const uuid = await askOwner(actor, { title: "Избранная атака", choices: candidates.map(a => [a.uuid, a.item.name]) });
  return candidates.find(a => a.uuid === uuid);
}
registerAutomationEvent("master-hit", async record => {
  const actor = await fromUuid(record.sourceActorUuid),
    item = await fromUuid(record.input.itemUuid),
    source = await fromUuid(record.input.context.sourceUuid),
    target = await fromUuid(record.input.targetUuid);
  if (!actor || !item || source?.actor?.uuid !== actor.uuid || !target?.actor || !masterFeatureAvailable(actor, item))
    throw Error("Источник или цель Мастера больше недоступны.");
  const result = await applyHitTechnique(actor, item, source, target, record.input.context, record.input.options);
  if (result === false || result?.aborted)
    await releaseMasterTechnique(
      actor,
      record.input.context.workflowId,
      item.system.identifier,
      record.input.context.turn
    );
  return result;
});
registerGmRequest("master-play", async (actor, data, { requestId }) => {
  const activity = await fromUuid(data.activityUuid),
    item = activity?.item;
  if (activity?.actor?.uuid !== actor.uuid || !masterFeatureAvailable(actor, item)) return false;
  const meta = automationData(item),
    id = meta.masterControl,
    mode = meta.masterMode;
  if (mode === "arm") {
    if (!masterConfiguration(actor)) return false;
    const options = {};
    if (id === "elemental-mastery") {
      options.damageType = await askOwner(actor, {
        title: item.name,
        choices: ["acid", "thunder", "fire", "cold", "lightning"].map(k => [k, k])
      });
      if (!options.damageType) return false;
      options.originalType = await askOwner(actor, {
        title: "Заменяемый тип",
        choices: ["acid", "thunder", "fire", "cold", "lightning"].map(k => [k, k])
      });
      if (!options.originalType) return false;
    }
    if (id === "expanded-formula") {
      options.dimension = await askOwner(actor, {
        title: item.name,
        choices: [
          ["size", "Основной размер"],
          ["width", "Ширина линии"],
          ["height", "Высота цилиндра"]
        ]
      });
      if (!options.dimension) return false;
    }
    if (
      !(await confirmOwner(
        actor,
        item.name,
        "Подготовить только для следующего подходящего применения? Сюжетные условия, хват и перемещение подтверждаются вручную."
      ))
    )
      return false;
    await actor.setFlag(MODULE_ID, "masterReady", { id, options, nonce: requestId });
    return true;
  }
  const source = data.sourceUuid ? await fromUuid(data.sourceUuid) : sourceFor(actor);
  if (source?.actor?.uuid !== actor.uuid) {
    notify("Для применения Мастера нужен его токен на сцене владельца.", "warn");
    return false;
  }
  if (["hit-save", "hit-effect", "spell-temp"].includes(mode)) {
    const context = actor.getFlag(MODULE_ID, "masterLastUse");
    if (
      !context ||
      context.turn !== currentTurn(source) ||
      !masterTechniqueUsage(actor, context.workflowId, item.system.identifier, context.turn)
    )
      return false;
    const original = await fromUuid(context.activityUuid);
    if (mode === "spell-temp") {
      if (!masterMatchesSpell(actor, original?.item)) return false;
      return runAutomationEvent(
        {
          id: `master-formula:${context.workflowId}`,
          kind: "master-protective-formula",
          sceneId: source.parent.id,
          sourceActorUuid: actor.uuid,
          sourceItemUuid: item.uuid,
          name: item.name,
          input: { context }
        },
        () => applyMasterProtection(actor, item, context)
      );
    }
    if (!masterMatchesWeapon(actor, original?.item) || !context.hits.length) return false;
    const selected = await chooseSceneTokens(actor, source.parent, {
      title: item.name,
      relation: t => context.hits.includes(t.uuid)
    });
    const target = selected?.[0];
    if (!target) return false;
    const options = {};
    if (id === "blade-onslaught") {
      const value = await askOwner(actor, {
        title: item.name,
        choices: [
          ["prone", "Сбить с ног"],
          ["push", "Оттолкнуть вручную"]
        ]
      });
      if (!value) return false;
      options.prone = value === "prone";
    }
    if (id === "pinning-maneuver")
      options.anchor = await confirmOwner(actor, item.name, "Цель в пределах 5 футов от твёрдого объекта?");
    if (
      id === "disarming-strike" &&
      !(await confirmOwner(actor, item.name, "Цель держит предмет, который можно выбить?"))
    )
      return false;
    if (!(await recordMasterTechnique(actor, context.workflowId, item.system.identifier, context.turn))) return false;
    return runAutomationEvent(
      {
        id: `master-hit:${context.workflowId}:${item.id}:${target.uuid}:${requestId}`,
        kind: "master-hit",
        sceneId: source.parent.id,
        sourceActorUuid: actor.uuid,
        name: item.name,
        input: { itemUuid: item.uuid, context, options, targetUuid: target.uuid }
      },
      async () => {
        const result = await applyHitTechnique(actor, item, source, target, context, options);
        if (result === false || result?.aborted)
          await releaseMasterTechnique(actor, context.workflowId, item.system.identifier, context.turn);
        return result;
      },
      { queued: canvas.scene?.id !== source.parent.id }
    );
  }
  if (mode === "great-spell") {
    if (canvas.scene?.id !== source.parent.id) {
      notify("GM должен открыть сцену владельца. Расход ещё не выполнен.", "warn");
      return false;
    }
    const spells = [...actor.items].filter(
      i => masterMatchesSpell(actor, i) && i.system.level >= 0 && i.system.level <= 5
    );
    const uuid = await askOwner(actor, { title: item.name, choices: spells.map(i => [i.uuid, i.name]) });
    const spell = spells.find(i => i.uuid === uuid);
    if (!spell) return false;
    if (
      !(await confirmOwner(actor, item.name, "Заклинание известно или подготовлено и соответствует условиям техники?"))
    )
      return false;
    const cast = [...spell.system.activities.values()].find(a => a.activation?.type && a.activation.type !== "special");
    if (!cast) return false;
    const castData = cast.toObject();
    if (
      cast.activation.type === "action" &&
      (await confirmOwner(actor, item.name, "Заменить действие бонусным действием?"))
    )
      castData.activation = { type: "bonus", value: 1, override: true };
    castData.consumption = {
      ...castData.consumption,
      spellSlot: false,
      targets: [...(castData.consumption?.targets ?? []), { type: "itemUses", target: item.id, value: "1" }]
    };
    castData.flags = { ...castData.flags, [MODULE_ID]: { ...castData.flags?.[MODULE_ID], masterChild: true } };
    const clone = spell.clone({ system: { activities: { [cast.id]: castData } } }, { keepId: true });
    return applyNativeOnce(
      actor,
      { requestId, action: "master-great-spell", activityUuid: cast.uuid },
      () =>
        MidiQOL.completeActivityUse(
          clone.system.activities.get(cast.id),
          { spell: { slot: false }, scaling: 0, midiOptions: { workflowOptions: { noOnUseMacro: true } } },
          { configure: true }
        ),
      async () => true
    );
  }
  if (mode === "reaction" || mode === "extra-attack" || mode === "whirlwind") {
    if (canvas.scene?.id !== source.parent.id) {
      notify("GM должен открыть сцену владельца. Расход ещё не выполнен.", "warn");
      return false;
    }
    if (mode === "reaction" && !canReact(actor)) return false;
    let previousAttack;
    if (mode === "extra-attack") {
      previousAttack = actor.getFlag(MODULE_ID, "masterLastUse");
      if (
        !previousAttack?.attack ||
        previousAttack.sourceUuid !== source.uuid ||
        previousAttack.turn !== currentTurn(source) ||
        !masterTechniqueUsage(actor, previousAttack.workflowId, item.system.identifier, previousAttack.turn)
      )
        return false;
      if (id === "piercing-shot" && !previousAttack.hits.length) return false;
      if (id === "ricochet" && (previousAttack.hits.length || !previousAttack.targets.length)) return false;
      if (id === "cleave") {
        const victims = await Promise.all(previousAttack.hits.map(uuid => fromUuid(uuid)));
        if (!victims.some(t => t?.actor && Number(t.actor.system.attributes.hp.value) <= 0)) {
          notify("Сначала подтвердите снижение хитов поражённой цели до 0.", "warn");
          return false;
        }
      }
    }
    if (
      !(await confirmOwner(
        actor,
        item.name,
        "Подтверждены момент, видимость, дистанция, исходное событие, ограничения серии и действия Атака?"
      ))
    )
      return false;
    const attack = await chooseMasterAttack(actor);
    if (!attack) return false;
    const reach = rangeFeet(
        attack.range?.value ?? attack.item.system.range.reach ?? 5,
        attack.range?.units || attack.item.system.range.units || "ft"
      ),
      normal = rangeFeet(attack.item.system.range.value, attack.item.system.range.units);
    const max = mode === "whirlwind" ? (source.parent.tokens.size ?? source.parent.tokens.length) : 1;
    const excluded = [
      source.uuid,
      ...(mode === "extra-attack" && ["piercing-shot", "ricochet", "aimed-volley"].includes(id)
        ? previousAttack.targets
        : [])
    ];
    const chosen = await chooseSceneTokens(actor, source.parent, {
      title: item.name,
      max,
      exclude: excluded,
      relation: t => inFeet(source, t, masterPath(actor) === "blade" ? reach : normal, source.parent)
    });
    if (!chosen?.length) return false;
    if (mode === "whirlwind")
      return applyNativeOnce(
        actor,
        { requestId, action: "master-whirlwind", activityUuid: activity.uuid },
        () =>
          useNativeUtility(activity, {
            dataPatch: {
              activation: { type: "action", value: 1, override: true },
              consumption: { spellSlot: false, targets: [{ type: "itemUses", target: item.id, value: "1" }] }
            }
          }),
        async () => {
          for (const target of chosen) {
            const result = await nativeWeaponAttack(actor, attack, target);
            if (!result || result.aborted) return { status: "needs-review" };
          }
          return true;
        }
      );
    if (mode === "extra-attack")
      return applyNativeOnce(
        actor,
        { requestId, action: "master-extra-attack", activityUuid: activity.uuid },
        async () => {
          if (
            !(await recordMasterTechnique(
              actor,
              previousAttack.workflowId,
              item.system.identifier,
              previousAttack.turn
            ))
          )
            return false;
          const result = await nativeWeaponAttack(actor, attack, chosen[0], {
            noAbility: ["piercing-shot", "ricochet"].includes(id)
          });
          if (result === false || result?.aborted)
            await releaseMasterTechnique(actor, previousAttack.workflowId, item.system.identifier, previousAttack.turn);
          return result;
        },
        async () => true
      );
    return nativeWeaponAttack(actor, attack, chosen[0], { reaction: true });
  }
  return false;
});

const calls = new Map();
export async function controlMaster(actor, activity) {
  const key = `${actor.uuid}:${activity.item.id}`;
  if (calls.has(key)) return calls.get(key);
  const mode = automationData(activity.item).masterMode;
  const operation = automationData(activity).masterForesightReroll
    ? requestGm("master-foresight", actor, { activityUuid: activity.uuid }, { timeoutMs: 120000 })
    : ["configure", "expertise", "reload", "foresight", "series", "asi"].includes(mode)
      ? masterSettings(actor, activity.item)
      : requestGm(
          "master-play",
          actor,
          { activityUuid: activity.uuid, sourceUuid: sourceFor(actor)?.uuid },
          { timeoutMs: 120000 }
        );
  calls.set(key, operation);
  void operation.finally(() => calls.delete(key)).catch(() => {});
  return operation;
}
registerGmRequest("master-foresight", async (actor, data, { requestId }) => {
  const activity = await fromUuid(data.activityUuid),
    selected = actor.getFlag(MODULE_ID, "masterForesight");
  if (
    activity?.actor?.uuid !== actor.uuid ||
    !automationData(activity).masterForesightReroll ||
    !masterFeatureAvailable(actor, activity.item) ||
    !selected
  )
    return false;
  const [kind, key] = selected.split("."),
    method = kind === "skills" ? actor.rollSkill : actor.rollToolCheck;
  if (
    typeof method !== "function" ||
    !(await confirmOwner(
      actor,
      activity.item.name,
      "Это перебросок только выбранного владения после подтверждённой исходной проверки? Новый результат обязателен."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "master-foresight", activityUuid: activity.uuid },
    () =>
      useNativeUtility(activity, {
        dataPatch: {
          consumption: { spellSlot: false, targets: [{ type: "itemUses", target: activity.item.id, value: "1" }] }
        }
      }),
    async () => {
      const rolls = await method.call(actor, { [kind === "skills" ? "skill" : "tool"]: key }, { configure: false });
      return rolls?.length ? true : { status: "needs-review" };
    }
  );
});
export function installMasterHooks() {
  installMasterBladeHooks();
  const intercept = activity => {
    if (!enabled() || isChild(activity)) return;
    if (automationData(activity?.item).masterFeature && !masterFeatureAvailable(activity.actor, activity.item))
      return false;
    if (automationAction(activity) !== "master-control") return;
    void controlMaster(activity.actor, activity).catch(error => notify(error.message, "warn"));
    return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => {
    const result = intercept(workflow?.activity);
    if (result === false) return false;
    prepareMasterActivity(workflow);
  });
  Hooks.on("dnd5e.preUseActivity", intercept);
  Hooks.on("midi-qol.preAttackRollConfig", prepareMasterAttack);
  Hooks.on("dnd5e.preRollAttack", applyMasterAttackConfig);
  Hooks.on("dnd5e.preRollDamage", applyMasterDamageConfig);
  Hooks.on("midi-qol.RollComplete", workflow => {
    void rememberMasterUse(workflow).catch(error => notify(error.message, "warn"));
  });
  Hooks.on("dnd5e.computePactProgression", (_p, actor, cls, descriptor) => {
    extendMasterCasting(actor, cls, descriptor);
  });
  Hooks.on("dnd5e.restCompleted", actor => {
    if (enabled() && isGmAuthority() && masterLevel(actor)) void actor.unsetFlag(MODULE_ID, "masterForesight");
  });
}
