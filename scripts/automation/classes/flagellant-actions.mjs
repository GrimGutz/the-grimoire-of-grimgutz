import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, findFeature, itemUses, notify } from "../shared/helpers.mjs";
import { flagellantDie, flagellantPain } from "../shared/flagellant-definitions.mjs";
import {
  flagellantLevel,
  flagellantAvailable,
  payFlagellantPrice,
  createFlagellantState,
  endFlagellantTechnique,
  flagellantTechniques,
  syncFlagellant
} from "./flagellant.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { sourceTokenForActor } from "../shared/zones.mjs";
import {
  activeBenefits,
  benefitData,
  inFeet,
  canReact,
  recordModuleReaction,
  turnKey
} from "../shared/combat-benefits.mjs";
import { encounterForScene, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";

const gm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
const object = doc => doc.object ?? { actor: doc.actor, document: doc };
export function flagellantExpense(activity, { activation = "special", use = false, hitDie = null } = {}) {
  if (!flagellantAvailable(activity.actor, activity.item)) throw Error("Способность Самобичевателя недоступна.");
  if (use && itemUses(activity.item).remaining < 1) throw Error("Нет использований до отдыха.");
  return {
    activation: { type: activation, value: activation === "special" ? 0 : 1, override: true },
    consumption: {
      targets: [
        ...(use ? [{ type: "itemUses", target: "", value: "1" }] : []),
        ...(hitDie ? [{ type: "hitDice", target: hitDie, value: "1" }] : [])
      ],
      spellSlot: false,
      scaling: { allowed: false, max: "" }
    }
  };
}
export async function rollFlagellantPain(actor, count = 1, side = flagellantDie(flagellantLevel(actor))) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > Math.max(2, Number(actor.system.attributes.prof)) ||
    ![4, 6, 8, 10, 12].includes(side)
  )
    throw Error("Недопустимые кости боли.");
  const roll = await new Roll(`${count}d${side}`).evaluate(),
    values = (roll.dice ?? roll.terms ?? [])
      .filter(die => die.faces === side)
      .flatMap(die =>
        (die.results ?? []).filter(r => r.active !== false && r.discarded !== true).map(r => Number(r.result))
      );
  if (
    values.length !== count ||
    !values.every(v => v >= 1 && v <= side) ||
    values.reduce((a, b) => a + b, 0) !== Number(roll.total)
  )
    throw Error("Не удалось подтвердить исходные отдельные кости боли.");
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Кости боли: исходная сумма определяет цену и силу эффекта"
  });
  return { amount: Number(roll.total), values, side };
}
export async function nativeFlagellantHeal(activity, target, amount) {
  const row = activity.toObject();
  Object.assign(row, {
    type: "heal",
    activation: { type: "special", value: 0, override: true },
    consumption: { targets: [], spellSlot: false },
    healing: areaDamagePart({ formula: String(amount), type: "healing" }),
    range: { units: "any", value: null, override: true },
    target: { template: { type: "" }, affects: { type: "creature", count: "1" }, override: true, prompt: false }
  });
  delete row.roll;
  row.flags = {
    ...row.flags,
    [MODULE_ID]: { action: "", moduleAction: "", leaderResolved: true, flagellantResolved: true }
  };
  const item = activity.item.clone({ system: { activities: { [activity.id]: row } } }, { keepId: true });
  return MidiQOL.completeActivityUse(
    item.system.activities.get(activity.id),
    {
      consume: { resources: false, spellSlot: false, action: false },
      create: { measuredTemplate: false },
      midiOptions: {
        targetUuids: [target.uuid],
        workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
      }
    },
    { configure: false }
  );
}
async function fixedDamage(source, item, target, amount, type, key) {
  return useAuraPulse({
    scene: source.parent,
    sourceToken: object(source),
    sourceItem: item,
    targets: [object(target)],
    eventKey: key,
    event: { damage: [{ formula: String(amount), type }], onSave: "none" }
  });
}
export async function grantFlagellantTechnique(source, target, item, kind, dice, { borrowed = false } = {}) {
  await endFlagellantTechnique(target.actor);
  const effect = await createFlagellantState(source, target, item, kind, {
    expiry: borrowed && kind === "endurance" ? "targetStart" : "sourceStart",
    technique: {
      kind,
      ...dice,
      borrowed,
      ...(kind === "onslaught"
        ? { excludedApplications: (target.actor.getFlag(MODULE_ID, "flagellantApplications") ?? []).map(e => e.id) }
        : {})
    }
  });
  if (borrowed && kind === "onslaught") {
    const original = findFeature(source.actor, "flagellant-onslaught").toObject(),
      id = foundry.utils.randomID();
    delete original._stats;
    original._id = id;
    original.name = "Жестокий урок: переданный Натиск";
    original.folder = null;
    original.system.identifier = `flagellant-borrowed-${id}`;
    original.system.description.value = `<p>Переданный Натиск уже оплачен вашими хитами при получении. При следующем подходящем уроне используется сохранённая сумма без повторной цены.</p>${original.system.description.value}`;
    original.flags = {
      [MODULE_ID]: { schemaVersion: 1, flagellantFeature: true, flagellantBorrowed: effect.uuid, minimumLevel: 0 }
    };
    await target.actor.createEmbeddedDocuments("Item", [original]);
  }
  await syncFlagellant(target.actor);
  return effect;
}
export async function useFlagellantTechnique(actor, activity, source, kind, requestId, { confirmed = false } = {}) {
  const reaction = kind === "endurance";
  if (reaction && !canReact(actor)) return false;
  if (
    reaction &&
    !confirmed &&
    !(await confirmOwner(
      gm(actor),
      activity.item.name,
      "По вам проводится атака; её результат ещё не объявлен? Нативную реакцию применить сейчас, а не после подтверждённого попадания?"
    ))
  )
    return false;
  const expense = flagellantExpense(activity, { activation: reaction ? "reaction" : "bonus" });
  return applyNativeOnce(
    actor,
    { requestId, action: `flagellant-${kind}`, activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: expense }),
    async () => {
      if (reaction) await recordModuleReaction(actor, source.parent);
      const dice = await rollFlagellantPain(actor, reaction ? 2 : 1),
        price = await payFlagellantPrice(actor, dice.amount, { id: requestId, sourceItem: activity.item });
      if (price.status !== "success") return { status: "needs-review" };
      if (!price.ok) {
        notify("Цена силы не оставила допустимых хитов: эффект не возник, действие/реакция не возвращены.", "warn");
        return true;
      }
      await grantFlagellantTechnique(source, source, activity.item, kind, dice);
      return true;
    }
  );
}
async function useLesson(actor, activity, source, requestId) {
  if (
    !(await confirmOwner(
      actor,
      activity.item.name,
      "Вы совершаете действие Атака и заменяете ровно одну его атаку касанием? Эта кнопка не предоставляет дополнительную атаку."
    ))
  )
    return false;
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: "Получатель Жестокого урока",
    min: 1,
    max: 1,
    exclude: [source.uuid],
    relation: t => t.actor.uuid !== actor.uuid && inFeet(source, t, 5, source.parent)
  });
  if (!targets?.length) return false;
  const target = targets[0];
  if (
    !(await confirmOwner(
      target.actor,
      "Жестокий урок",
      "Согласиться на приём и полную потерю ваших реальных HP/максимума по броскам дарителя?"
    ))
  )
    return false;
  const kind = await askOwner(actor, {
    title: "Передаваемый приём",
    choices: [
      ["onslaught", "Натиск"],
      ["endurance", "Стойкость"],
      ["surge", "Порыв"]
    ]
  });
  if (!["onslaught", "endurance", "surge"].includes(kind)) return false;
  if (!inFeet(source, target, 5, source.parent)) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "flagellant-lesson", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: flagellantExpense(activity) }),
    async () => {
      const dice = await rollFlagellantPain(actor, kind === "endurance" ? 2 : 1),
        price = await payFlagellantPrice(target.actor, dice.amount, { id: requestId, sourceItem: activity.item });
      if (price.status !== "success") return { status: "needs-review" };
      if (price.ok) await grantFlagellantTechnique(source, target, activity.item, kind, dice, { borrowed: true });
      return true;
    }
  );
}
async function useBloodGift(actor, activity, source, requestId) {
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: "Союзник для Дара крови",
    min: 1,
    max: 1,
    exclude: [source.uuid],
    relation: t => t.actor.uuid !== actor.uuid && inFeet(source, t, 30, source.parent)
  });
  if (!targets?.length) return false;
  if (!(await confirmOwner(gm(actor), activity.item.name, "Это видимый союзник в 30 футах, не сам даритель?")))
    return false;
  const count = await askOwner(actor, {
    kind: "number",
    title: "Количество костей боли",
    min: 1,
    max: Number(actor.system.attributes.prof),
    defaultValue: 1
  });
  if (!Number.isInteger(count) || count < 1 || count > Number(actor.system.attributes.prof)) return false;
  if (targets[0].parent.id !== source.parent.id || !inFeet(source, targets[0], 30, source.parent)) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "flagellant-blood-gift", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: flagellantExpense(activity, { activation: "action" }) }),
    async () => {
      const dice = await rollFlagellantPain(actor, count),
        price = await payFlagellantPrice(actor, dice.amount, { id: requestId, sourceItem: activity.item });
      if (price.status !== "success") return { status: "needs-review" };
      if (!price.ok) return true;
      const native = await nativeFlagellantHeal(activity, targets[0], dice.amount);
      return native !== false && !native?.aborted && native != null ? true : { status: "needs-review" };
    }
  );
}
async function useForce(actor, activity, requestId) {
  if (
    !(await confirmOwner(
      gm(actor),
      activity.item.name,
      "Подтверждён конкретный проваленный спасбросок? После цены и использования прибавьте число именно к нему, при необходимости пересчитайте исход Midi."
    ))
  )
    return false;
  await syncFlagellant(actor);
  return applyNativeOnce(
    actor,
    { requestId, action: "flagellant-force", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: flagellantExpense(activity, { use: true }) }),
    async () => {
      const dice = await rollFlagellantPain(actor),
        price = await payFlagellantPrice(actor, dice.amount, { id: requestId, sourceItem: activity.item });
      if (price.status !== "success") return { status: "needs-review" };
      if (!price.ok) return true;
      notify(`Через силу: +${dice.amount} к исходному проваленному спасброску, без переброска к20.`);
      return (await confirmOwner(
        gm(actor),
        "Через силу (GM)",
        "Правка исходного спасброска и возможная смена провала/успеха подтверждены?"
      ))
        ? true
        : { status: "needs-review" };
    }
  );
}
export function flagellantHitDice(actor) {
  return [
    ...new Set(
      [...(actor.items ?? [])]
        .filter(
          i =>
            i.type === "class" &&
            Number(
              i.system.hd?.value ?? Number(i.system.levels) - Number(i.system.hd?.spent ?? i.system.hitDiceUsed ?? 0)
            ) > 0
        )
        .map(i => i.system.hd?.denomination ?? i.system.hitDice)
        .filter(d => /^d(?:6|8|10|12)$/.test(d))
    )
  ];
}
async function useOnslaught(actor, activity, source, requestId) {
  const combat = encounterForScene(source.parent, source),
    snapshot = combat && combatTurnSnapshot(combat);
  if (snapshot?.current.token?.uuid !== source.uuid) {
    notify("Натиск требует нанесения урона в ваш ход.", "warn");
    return false;
  }
  const prepared = flagellantTechniques(actor).find(e => {
      const state = benefitData(e).flagellantTechnique;
      return state.kind === "onslaught" && !state.claimedBy;
    }),
    own = flagellantLevel(actor) > 0 && findFeature(actor, "flagellant-onslaught");
  if (!prepared && !own) return false;
  let entries = (actor.getFlag(MODULE_ID, "flagellantApplications") ?? []).filter(
    e => e.turn === turnKey(combat) && e.sourceUuid === source.uuid && !e.used && e.targets?.length
  );
  if (prepared)
    entries = entries
      .filter(e => !benefitData(prepared).flagellantTechnique.excludedApplications?.includes(e.id))
      .slice(0, 1);
  const key = await askOwner(actor, {
      title: "Подтверждённое применение урона",
      choices: entries.map(e => [e.id, e.name])
    }),
    entry = entries.find(e => e.id === key);
  if (!entry) return false;
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: "Одна реально получившая урон цель",
    min: 1,
    max: 1,
    relation: t => entry.targets.some(row => row.uuid === t.uuid)
  });
  if (!targets?.length) return false;
  const target = targets[0],
    types = entry.targets.find(row => row.uuid === target.uuid).types;
  const type =
    types.length === 1
      ? types[0]
      : await askOwner(actor, { title: "Исходный тип урона", choices: types.map(t => [t, t]) });
  if (!types.includes(type)) return false;
  if (combatTurnSnapshot(combat).current.token?.uuid !== source.uuid || turnKey(combat) !== entry.turn) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "flagellant-onslaught", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: flagellantExpense(activity) }),
    async () => {
      const pending = actor.getFlag(MODULE_ID, "flagellantApplications") ?? [],
        current = pending.find(e => e.id === entry.id);
      if (!current || current.used) return { status: "needs-review" };
      current.used = true;
      await actor.setFlag(MODULE_ID, "flagellantApplications", pending);
      let dice,
        paid = true;
      if (prepared) dice = benefitData(prepared).flagellantTechnique;
      else {
        dice = await rollFlagellantPain(actor);
        const price = await payFlagellantPrice(actor, dice.amount, { id: requestId, sourceItem: activity.item });
        if (price.status !== "success") return { status: "needs-review" };
        paid = price.ok;
      }
      if (!paid) return true;
      if (!prepared) await endFlagellantTechnique(actor);
      let amount = dice.amount;
      if (flagellantPain(actor).taste) {
        const sizes = flagellantHitDice(actor);
        if (sizes.length) {
          const selected = await askOwner(actor, {
            title: "Вкус боли: добавить свою Кость хитов без лечения?",
            choices: [["none", "Не тратить"], ...sizes.map(d => [d, d])]
          });
          if (sizes.includes(selected)) {
            const extra = await applyNativeOnce(
              actor,
              { requestId: `${requestId}:hd`, action: "flagellant-hit-die", activityUuid: activity.uuid },
              () => useNativeUtility(activity, { dataPatch: flagellantExpense(activity, { hitDie: selected }) }),
              async () => true
            );
            if (extra.status === "success") {
              const roll = await new Roll(`1${selected}`).evaluate();
              await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: "Натиск: Кость хитов только для урона, без лечения"
              });
              amount += Number(roll.total);
            } else if (extra.status !== "cancelled") return { status: "needs-review" };
          }
        }
      }
      if (prepared) {
        const state = benefitData(prepared);
        await prepared.setFlag(MODULE_ID, "combatBenefit", {
          ...state,
          flagellantTechnique: { ...state.flagellantTechnique, claimedBy: requestId }
        });
      }
      const result = await fixedDamage(source, activity.item, target, amount, type, `${requestId}:damage`);
      if (result === false || result?.aborted || result == null) return { status: "needs-review" };
      // Keep the owned source document resolvable throughout the native workflow;
      // deleting its button beforehand breaks Midi's damage-event UUID lookup.
      if (prepared) await prepared.delete();
      return true;
    }
  );
}
registerGmRequest("flagellant-action", (actor, data, { requestId }) =>
  serialMutation(`flagellant-action:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority()) return false;
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const activity = await fromUuid(data.activityUuid),
      source = await fromUuid(data.sourceUuid);
    if (activity?.actor?.uuid !== actor.uuid || !flagellantAvailable(actor, activity.item)) return false;
    const operation = automationData(activity).flagellantOperation;
    if (operation === "end-technique") {
      await endFlagellantTechnique(actor);
      return true;
    }
    if (operation === "end-state") {
      for (const effect of activeStates(actor))
        if (benefitData(effect).sourceItemUuid === activity.item.uuid) await effect.delete();
      return true;
    }
    if (source?.actor?.uuid !== actor.uuid || canvas.scene?.id !== source.parent.id || !canvas.ready) return false;
    if (operation === "surge" || operation === "endurance")
      return useFlagellantTechnique(actor, activity, source, operation, requestId);
    if (operation === "lesson") return useLesson(actor, activity, source, requestId);
    if (operation === "blood-gift") return useBloodGift(actor, activity, source, requestId);
    if (operation === "force") return useForce(actor, activity, requestId);
    if (operation === "onslaught") return useOnslaught(actor, activity, source, requestId);
    if (["retribution", "feast"].includes(operation))
      return applyNativeOnce(
        actor,
        { requestId, action: `flagellant-${operation}`, activityUuid: activity.uuid },
        () =>
          useNativeUtility(activity, { dataPatch: flagellantExpense(activity, { activation: "bonus", use: true }) }),
        async () => {
          for (const effect of activeStates(actor))
            if (benefitData(effect).kind === `flagellant-${operation}`) await effect.delete();
          await createFlagellantState(source, source, activity.item, operation, { accumulated: 0, lossClaims: [] });
          return true;
        }
      );
    return false;
  })
);
export function activeStates(actor) {
  return activeBenefits(actor).filter(e =>
    ["flagellant-retribution", "flagellant-feast"].includes(benefitData(e).kind)
  );
}
const calls = new Map();
export function controlFlagellant(actor, activity) {
  const key = `${actor.uuid}:${activity.id}`;
  if (calls.has(key)) return calls.get(key);
  const operation = automationData(activity).flagellantOperation,
    type = operation === "sacrifice" ? "flagellant-sacrifice" : "flagellant-action";
  const task = requestGm(
    type,
    actor,
    {
      itemUuid: activity.item.uuid,
      activityUuid: activity.uuid,
      sourceUuid: sourceTokenForActor(actor)?.document.uuid
    },
    { timeoutMs: 120000 }
  );
  calls.set(key, task);
  void task.finally(() => calls.delete(key)).catch(() => {});
  return task;
}
