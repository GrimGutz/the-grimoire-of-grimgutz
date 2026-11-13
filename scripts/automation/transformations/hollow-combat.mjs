import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, itemUses, automationData, notify } from "../shared/helpers.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { askOwner, confirmOwner, chooseSceneTokens, promptOwner } from "../shared/owner-prompts.mjs";
import { choiceDialog, multiChoiceDialog } from "../shared/dialogs.mjs";
import { canReact, recordModuleReaction, tokenRef, inFeet } from "../shared/combat-benefits.mjs";
import { isEffectActive, temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { isAuraIncapacitated } from "../shared/aura-conditions.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { useAuraPulse, dispatchAutomationPulse } from "../midi/aura-workflow.mjs";
import { onHollowChargeUse, afterHollowChargeUse } from "./hollow.mjs";

const asToken = token => token.object ?? { actor: token.actor, document: token };
const activeWeakening = actor =>
  [...(actor.effects ?? [])].filter(effect => isEffectActive(effect) && effect.getFlag(MODULE_ID, "hollowWeakening"));
export function availableSpellSlots(actor) {
  return Object.entries(actor.system?.spells ?? {}).flatMap(([key, slot]) => {
    const level = key === "pact" ? Number(slot.level) : /^spell[1-9]$/.test(key) ? Number(key.slice(5)) : 0;
    return level > 0
      ? Array.from({ length: Math.max(0, Math.min(30, Number(slot.value) || 0)) }, (_, index) => ({
          id: `${key}:${index}`,
          key,
          level,
          label: `${key === "pact" ? "Договорная" : "Обычная"} ячейка ${level} уровня #${index + 1}`
        }))
      : [];
  });
}
export function slotSelection(slots, selected, budget) {
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length) return null;
  const entries = selected.map(id => slots.find(slot => slot.id === id));
  if (entries.some(slot => !slot) || entries.reduce((sum, slot) => sum + slot.level, 0) > budget) return null;
  return entries.reduce((counts, slot) => {
    counts[slot.key] = (counts[slot.key] ?? 0) + 1;
    return counts;
  }, {});
}
export function canSpendHollowCharges(actor, cost) {
  return Number.isInteger(cost) && cost >= 0 && itemUses(findFeature(actor, "magic-eradicator")).remaining >= cost;
}
async function spendCharges(actor, cost) {
  return serialMutation(`hollow-charges:${actor.uuid}`, async () => {
    if (!isGmAuthority() || !canSpendHollowCharges(actor, cost) || isAuraIncapacitated(actor)) return false;
    const feature = findFeature(actor, "magic-eradicator"),
      uses = itemUses(feature);
    if (!feature) return false;
    if (cost) await feature.update({ "system.uses.spent": uses.spent + cost });
    return true;
  });
}
async function eraseSlots(source, target, budget) {
  // NPC stock never enters an owner prompt/socket payload. The GM chooses it.
  const slots = availableSpellSlots(target.actor);
  if (!slots.length) return true;
  const owner = promptOwner(source.actor),
    disclose = target.actor.testUserPermission?.(owner, "OWNER") === true;
  const prompt = {
    kind: "checkbox",
    title: "Выжигание заклинаний",
    label: `Выберите ячейки: сумма уровней ${budget}. Меньшую сумму подтверждает GM.`,
    choices: slots.map(slot => [slot.id, slot.label]),
    min: 1,
    max: slots.length
  };
  const selected = disclose ? await askOwner(source.actor, prompt) : await multiChoiceDialog(prompt);
  const counts = slotSelection(slots, selected, budget);
  if (!counts) return { status: "needs-review" };
  const sum = selected.reduce((sum, id) => sum + slots.find(slot => slot.id === id).level, 0);
  if (
    sum !== budget &&
    (await choiceDialog({
      title: "Частичная потеря ячеек (GM)",
      label: `Сумма ${sum}, результат к6 ${budget}. Разрешить частичную потерю?`,
      choices: [
        ["no", "Нужна ручная проверка"],
        ["yes", "Разрешить"]
      ]
    })) !== "yes"
  )
    return { status: "needs-review" };
  return serialMutation(`spell-slots:${target.actor.uuid}`, async () => {
    if (!isGmAuthority()) return { status: "needs-review" };
    if (Object.entries(counts).some(([key, count]) => Number(target.actor.system.spells[key]?.value ?? 0) < count))
      return { status: "needs-review" };
    await target.actor.update(
      Object.fromEntries(
        Object.entries(counts).map(([key, count]) => [
          `system.spells.${key}.value`,
          target.actor.system.spells[key].value - count
        ])
      )
    );
    return true;
  });
}
async function burn(event) {
  const source = await fromUuid(event.sourceTokenUuid),
    target = await fromUuid(event.targetTokenUuid),
    item = await fromUuid(event.sourceItemUuid);
  if (
    !source?.actor ||
    !target?.actor ||
    item?.actor?.uuid !== source.actor.uuid ||
    source.parent.id !== event.sceneId ||
    target.parent.id !== event.sceneId
  )
    return { status: "needs-review" };
  if (!canSpendHollowCharges(source.actor, 6) || !availableSpellSlots(target.actor).length) return false;
  if (
    !(await confirmOwner(
      source.actor,
      item.name,
      "После попадания потратить 6 зарядов и предложить цели спасбросок Телосложения?"
    ))
  )
    return false;
  if (!(await spendCharges(source.actor, 6))) return false;
  const outcome = await useAuraPulse({
    scene: source.parent,
    sourceToken: asToken(source),
    sourceItem: item,
    targets: [asToken(target)],
    eventKey: event.id,
    event: { save: "con", dc: event.dc, damage: [], returnSaveOutcome: true }
  });
  if (outcome?.status !== "success") return outcome === false ? { status: "needs-review" } : outcome;
  let result = true;
  if (outcome.failedSaves.includes(target.uuid)) {
    const roll = await new Roll("1d6").evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: source.actor }), flavor: item.name });
    result = await eraseSlots(source, target, Number(roll.total));
  }
  await afterHollowChargeUse(source.actor, [...item.system.activities.values()][0]);
  return result;
}
registerAutomationEvent("hollow-spellburn", burn);
registerGmRequest("hollow-weapon-hit", async (actor, data) => {
  const source = await fromUuid(data.sourceUuid),
    activity = await fromUuid(data.activityUuid),
    item = findFeature(actor, "spellburn");
  if (
    !source ||
    source.actor.uuid !== actor.uuid ||
    activity?.item?.actor?.uuid !== actor.uuid ||
    !item ||
    activity.attack?.type?.value !== "melee" ||
    activity.attack?.type?.classification !== "weapon"
  )
    return { status: "declined" };
  for (const uuid of data.targets ?? []) {
    const target = await fromUuid(uuid);
    if (!target?.actor || target.parent.id !== source.parent.id) continue;
    const event = {
      id: `hollow-burn:${data.workflowId}:${source.uuid}:${target.uuid}`,
      kind: "hollow-spellburn",
      name: item.name,
      sceneId: source.parent.id,
      sourceActorUuid: actor.uuid,
      sourceTokenUuid: source.uuid,
      targetTokenUuid: target.uuid,
      sourceItemUuid: item.uuid,
      dc: String(8 + Number(actor.system.attributes.prof) + Number(actor.system.abilities.con.mod))
    };
    await runAutomationEvent(event, burn, { queued: !canvas?.ready || canvas.scene?.id !== source.parent.id });
  }
  return { status: "success" };
});
export async function handleHollowWeaponHit(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !workflow?.attackRoll ||
    !workflow.hitTargets?.size ||
    !findFeature(workflow.actor, "spellburn")
  )
    return;
  return requestGm(
    "hollow-weapon-hit",
    workflow.actor,
    {
      sourceUuid: tokenRef(workflow.token).uuid,
      activityUuid: workflow.activity.uuid,
      targets: [...workflow.hitTargets].map(token => tokenRef(token).uuid),
      workflowId: workflow.id
    },
    { timeoutMs: 120000, requestId: `hollow-hit:${workflow.id}` }
  );
}
async function offerWeakening(actor, activity, sourceUuid = null) {
  const item = findFeature(actor, "spell-weakening");
  if (!item || activity?.item?.system?.identifier === "spell-weakening" || !canSpendHollowCharges(actor, 3)) return;
  const source = sourceUuid
    ? await fromUuid(sourceUuid)
    : actor
        .getActiveTokens?.(true, true)
        ?.map(tokenRef)
        .find(token => token.parent?.id === canvas.scene?.id);
  if (!source || !(await confirmOwner(actor, item.name, "Потратить ещё 3 заряда при основной способности?"))) return;
  const selected = await chooseSceneTokens(actor, source.parent, {
    title: item.name,
    relation: token => inFeet(source, token, 60, source.parent)
  });
  if (!selected?.length) return;
  const target = selected[0];
  const damageType = await choiceDialog({
    title: "Ослабление чар: тип урона (GM)",
    label: "Правило не указывает тип урона. Выберите его.",
    choices: Object.entries(CONFIG.DND5E.damageTypes).map(([key, data]) => [
      key,
      game.i18n.localize(data.label ?? data)
    ])
  });
  if (!damageType || !(await spendCharges(actor, 3))) return;
  await target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: item.name,
      img: item.img,
      type: "base",
      origin: item.uuid,
      transfer: false,
      disabled: false,
      showIcon: 1,
      statuses: [],
      ...temporaryEffectTiming({ seconds: 60 }),
      system: { changes: [] },
      flags: {
        [MODULE_ID]: {
          hollowWeakening: {
            sourceTokenUuid: source.uuid,
            sourceActorUuid: actor.uuid,
            sourceItemUuid: item.uuid,
            damageType
          }
        },
        dae: { expiryMode: "delete" }
      }
    }
  ]);
}
registerGmRequest("hollow-weakening-offer", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid);
  if (activity?.item?.actor?.uuid !== actor.uuid) throw Error("Неверный источник Ослабления чар.");
  const source = data.sourceUuid && (await fromUuid(data.sourceUuid));
  if (source?.actor?.uuid !== actor.uuid) return { status: "declined" };
  const event = {
    id: `weakening-offer:${data.useId}`,
    kind: "hollow-weakening-offer",
    name: "Ослабление чар",
    sourceActorUuid: actor.uuid,
    sourceTokenUuid: source.uuid,
    activityUuid: activity.uuid,
    sceneId: source.parent.id
  };
  return runAutomationEvent(
    event,
    async () => {
      await offerWeakening(actor, activity, source.uuid);
      return true;
    },
    { queued: !canvas?.ready || canvas.scene?.id !== source.parent.id }
  );
});
registerAutomationEvent("hollow-weakening-offer", async event => {
  const source = await fromUuid(event.sourceTokenUuid),
    activity = await fromUuid(event.activityUuid);
  if (!source?.actor || !activity) return { status: "needs-review" };
  await offerWeakening(source.actor, activity, source.uuid);
  return true;
});
onHollowChargeUse((actor, activity) => {
  const source = actor
    .getActiveTokens?.(true, true)
    ?.map(tokenRef)
    .find(token => token.parent?.id === canvas.scene?.id);
  return isGmAuthority()
    ? offerWeakening(actor, activity, source?.uuid)
    : source &&
        requestGm(
          "hollow-weakening-offer",
          actor,
          { activityUuid: activity.uuid, sourceUuid: source.uuid, useId: foundry.utils.randomID() },
          { timeoutMs: 120000 }
        );
});

export const requiresHigherSlot = (baseLevel, castLevel) =>
  Number.isFinite(baseLevel) && Number.isFinite(castLevel) && castLevel <= baseLevel;
async function inspectCast(event, { live = false } = {}) {
  const source = await fromUuid(event.sourceTokenUuid),
    activity = await fromUuid(event.activityUuid);
  if (!source?.actor || activity?.item?.actor?.uuid !== source.actor.uuid) return { status: "needs-review" };
  let blocked = false;
  for (const data of event.weakening ?? []) {
    const hollow = await fromUuid(data.sourceTokenUuid),
      item = await fromUuid(data.sourceItemUuid);
    if (!hollow?.actor || !item) continue;
    if (event.castLevel > 0)
      await dispatchAutomationPulse({
        scene: source.parent,
        sourceToken: asToken(hollow),
        sourceItem: item,
        targets: [asToken(source)],
        eventKey: `hollow-weakening-damage:${event.id}:${data.effectUuid}`,
        event: { damage: [{ formula: String(event.castLevel), type: data.damageType }], onSave: "full" }
      });
    if (requiresHigherSlot(event.baseLevel, event.castLevel)) {
      blocked =
        (await choiceDialog({
          title: "Ослабление чар (GM)",
          label: "Не использована более высокая ячейка. Подтвердить неудачу заклинания?",
          choices: [
            ["no", "Особый случай: решить вручную"],
            ["yes", "Заклинание не срабатывает"]
          ]
        })) === "yes" || blocked;
    }
  }
  if (!blocked)
    for (const uuid of event.dispellerUuids ?? []) {
      const hollow = await fromUuid(uuid);
      if (!hollow?.actor) continue;
      const item = hollow.actor && findFeature(hollow.actor, "dispelling"),
        cost = 2 * event.castLevel;
      if (
        !item ||
        hollow.uuid === source.uuid ||
        cost > 10 ||
        !canReact(hollow.actor) ||
        !inFeet(hollow, source, 60, source.parent) ||
        !canSpendHollowCharges(hollow.actor, cost)
      )
        continue;
      if (
        !(await confirmOwner(
          hollow.actor,
          item.name,
          `Вы видите накладывание заклинания? Потратить реакцию и ${cost} зарядов на его аннулирование?`
        ))
      )
        continue;
      if (
        (await choiceDialog({
          title: "Рассеивание (GM)",
          label: "Подтвердить аннулирование именно этого заклинания? Потраченная ячейка заклинателя не возвращается.",
          choices: [
            ["no", "Не аннулировать"],
            ["yes", "Аннулировать"]
          ]
        })) !== "yes"
      )
        continue;
      if (!canReact(hollow.actor) || !(await spendCharges(hollow.actor, cost))) continue;
      await globalThis.MidiQOL?.setReactionUsed?.(hollow.actor);
      await recordModuleReaction(hollow.actor, hollow.parent);
      blocked = true;
      await afterHollowChargeUse(hollow.actor, [...item.system.activities.values()][0]);
      break;
    }
  if (blocked && !live) {
    notify(
      "Отложенная антимагия: GM должен вручную проверить уже сыгранное заклинание; автоматического отката нет.",
      "warn"
    );
    return { status: "needs-review" };
  }
  return { blocked };
}
registerAutomationEvent("hollow-cast", event => inspectCast(event));
registerGmRequest("hollow-cast", async (actor, data) => {
  const source = await fromUuid(data.sourceTokenUuid),
    activity = await fromUuid(data.activityUuid);
  if (
    !source ||
    source.actor.uuid !== actor.uuid ||
    activity?.item?.actor?.uuid !== actor.uuid ||
    activity.item.type !== "spell"
  )
    return { status: "declined" };
  const weakening = activeWeakening(actor).map(effect => ({
    ...effect.getFlag(MODULE_ID, "hollowWeakening"),
    effectUuid: effect.uuid
  }));
  const dispellerUuids = [...source.parent.tokens]
    .filter(
      token =>
        token.actor &&
        findFeature(token.actor, "dispelling") &&
        token.uuid !== source.uuid &&
        inFeet(token, source, 60, source.parent)
    )
    .map(token => token.uuid);
  if (!weakening.length && !dispellerUuids.length) return { status: "declined" };
  const event = {
    ...data,
    weakening,
    dispellerUuids,
    sourceActorUuid: actor.uuid,
    id: `hollow-cast:${data.workflowId}`,
    kind: "hollow-cast",
    name: "Антимагия: " + activity.item.name,
    sceneId: source.parent.id,
    baseLevel: Number(activity.item.system.level)
  };
  let outcome;
  const result = await runAutomationEvent(
    event,
    async () => {
      outcome = await inspectCast(event, { live: true });
      return outcome;
    },
    { queued: !canvas?.ready || canvas.scene?.id !== source.parent.id }
  );
  return { status: result.status, blocked: outcome?.blocked === true };
});
export async function prepareHollowCast(workflow) {
  if (
    !enabled() ||
    workflow?.item?.type !== "spell" ||
    !workflow.token ||
    workflow.workflowOptions?.grimgutzAuraPulse ||
    workflow.grimgutzHollowCastChecked
  )
    return;
  workflow.grimgutzHollowCastChecked = true;
  const castLevel = Number(workflow.castData?.castLevel ?? workflow.spellLevel ?? workflow.item.system.level);
  const result = await requestGm(
    "hollow-cast",
    workflow.actor,
    {
      workflowId: workflow.id,
      sourceTokenUuid: tokenRef(workflow.token).uuid,
      activityUuid: workflow.activity.uuid,
      castLevel
    },
    { timeoutMs: 120000, requestId: `hollow-cast:${workflow.id}` }
  );
  if (result.blocked) {
    workflow.grimgutzBloodCastConfirmed = true;
    workflow.aborted = true;
    notify("Заклинание аннулировано антимагией. Уже израсходованная ячейка не возвращается.", "info");
    return false;
  }
}
export function installHollowCombatHooks() {
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (!enabled() || automationData(activity).leaderResolved || automationData(activity).areaResolved) return;
    if (["spellburn", "spell-weakening", "dispelling"].includes(activity?.item?.system?.identifier)) {
      notify("Эта способность предлагается в подходящем событии Midi-QOL. Без него ресурс не расходуется.", "info");
      return false;
    }
  });
  Hooks.on("dnd5e.postUseActivity", activity => {
    if (enabled() && activity.item?.type === "spell" && !game.modules?.get("midi-qol")?.active)
      notify("Антимагию этого заклинания нужно подтвердить вручную: поток Midi-QOL недоступен.", "warn");
  });
}
