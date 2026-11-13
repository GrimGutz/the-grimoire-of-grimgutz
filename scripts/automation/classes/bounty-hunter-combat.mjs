import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationData, findFeature, notify } from "../shared/helpers.mjs";
import {
  hunterLevel,
  hunterDC,
  hunterConfig,
  hunterPool,
  selectedHunterTrophy,
  selectedHunterTrophies,
  hunterPassiveActive,
  hunterFeet
} from "./bounty-hunter.mjs";
import { hunterDie } from "../shared/bounty-hunter-definitions.mjs";
import { isAuraIncapacitated, isAuraDefeated } from "../shared/aura-conditions.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { nativeApplicationReply, applyNativeOnce } from "../shared/native-applications.mjs";
import {
  onPrepareAttack,
  addCombatBenefit,
  activeBenefits,
  benefitData,
  tokenRef,
  inFeet,
  turnKey,
  canReact,
  recordModuleReaction
} from "../shared/combat-benefits.mjs";
import { combatTurnSnapshot, encounterForScene } from "../shared/combat-flow.mjs";
import { addSaveAdvantage } from "../midi/save-modifiers.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { useHunterCost, useHunterNative } from "./bounty-hunter-cost.mjs";
import { hunterCondition, hunterSave } from "./bounty-hunter-actions.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { effectKey } from "../shared/system-paths.mjs";

const gm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
const has = (actor, key, level = 1) => hunterLevel(actor) >= level && findFeature(actor, `hunter-${key}`);
const object = doc => doc.object ?? { actor: doc.actor, document: doc };
export function hunterIsolation(token) {
  if (!token?.parent || !token.disposition) return "unknown";
  let unknown = false;
  for (const other of token.parent.tokens ?? []) {
    if (
      other.uuid === token.uuid ||
      !other.actor ||
      isAuraIncapacitated(other.actor) ||
      isAuraDefeated(other) ||
      !inFeet(token, other, 10, token.parent)
    )
      continue;
    if (other.disposition === token.disposition) return "no";
    if (!other.disposition) unknown = true;
  }
  return unknown ? "unknown" : "yes";
}
export function hunterHostile(source, target) {
  if (!source?.disposition || !target?.disposition) return null;
  return source.disposition !== target.disposition;
}
async function isolatedTarget(actor, source, target) {
  const hostile = hunterHostile(source, target),
    isolation = hunterIsolation(target);
  if (hostile === false || isolation === "no") return false;
  if (hostile === null || isolation === "unknown")
    return confirmOwner(
      gm(actor),
      "Одинокая цель (GM)",
      "Цель враждебна охотнику и в 10 футах от неё нет её дееспособных союзников? Нейтральные/особые отношения не определяются по предположению."
    );
  return true;
}
async function duel(actor, source, target) {
  if (!has(actor, "duel", 2) || hunterIsolation(source) === "no" || !(await isolatedTarget(actor, source, target)))
    return false;
  return (
    hunterIsolation(source) === "yes" ||
    (await confirmOwner(gm(actor), "Один на один (GM)", "В 10 футах от охотника нет его дееспособных союзников?"))
  );
}
const contextRows = actor => actor.getFlag(MODULE_ID, "hunterRollContexts") ?? {};
async function saveContext(actor, key, value) {
  const rows = { ...contextRows(actor), [key]: value };
  await actor.setFlag(MODULE_ID, "hunterRollContexts", Object.fromEntries(Object.entries(rows).slice(-100)));
  return value;
}
registerGmRequest("hunter-roll-context", (actor, data) =>
  serialMutation(`hunter-context:${actor.uuid}`, async () => {
    const source = await fromUuid(data.sourceUuid),
      target = await fromUuid(data.targetUuid),
      activity = await fromUuid(data.activityUuid);
    if (
      source?.actor?.uuid !== actor.uuid ||
      activity?.actor?.uuid !== actor.uuid ||
      target?.parent?.id !== source.parent.id
    )
      return false;
    const key = `${data.kind}:${data.workflowId}:${target.uuid}`,
      previous = contextRows(actor)[key];
    if (previous) return { status: "success", ...previous };
    const result = { duel: await duel(actor, source, target), advantage: false };
    if (data.kind === "save") {
      const definition = activity.item.system.identifier,
        statuses = new Set([...(activity.item.effects ?? [])].flatMap(effect => [...(effect.statuses ?? [])]));
      if (definition === "hunter-dragon-minor") statuses.add("frightened");
      if (definition === "hunter-fey-major") statuses.add("charmed");
      if (definition === "hunter-fiend-major" || definition === "hunter-plant-medium") statuses.add("restrained");
      const victim = target.actor;
      result.advantage = Boolean(
        (statuses.has("poisoned") && hunterPassiveActive(victim, "hunter-construct-minor")) ||
        (statuses.has("charmed") && hunterPassiveActive(victim, "hunter-fey-minor")) ||
        (["grappled", "restrained"].some(s => statuses.has(s)) &&
          hunterPassiveActive(victim, "hunter-monstrosity-minor")) ||
        (statuses.has("frightened") && victim.getFlag?.(MODULE_ID, "hunterUndeadTemp")?.remaining > 0)
      );
      if (result.duel) result.penalty = Number((await new Roll("1d4").evaluate()).total);
    }
    await saveContext(actor, key, result);
    return { status: "success", ...result };
  })
);
export async function prepareHunterAttack(workflow) {
  if (enabled() && automationData(workflow?.activity).hunterRetry)
    workflow.attackRollModifierTracker?.advantage?.add?.(`${MODULE_ID}.hunter-retry`, "Великий трофей конструкта");
  if (
    !enabled() ||
    !has(workflow?.actor, "duel", 2) ||
    workflow.targets?.size !== 1 ||
    workflow.grimgutzHunterAttack ||
    automationData(workflow.activity).auraPulse
  )
    return;
  const source = tokenRef(workflow.token),
    target = tokenRef([...workflow.targets][0]);
  if (!source) return;
  const state = (workflow.grimgutzHunterAttack = { bonus: false });
  const reply = await requestGm(
    "hunter-roll-context",
    workflow.actor,
    {
      kind: "attack",
      workflowId: workflow.id,
      sourceUuid: source.uuid,
      targetUuid: target.uuid,
      activityUuid: workflow.activity.uuid
    },
    { requestId: `hunter-attack:${workflow.id}:${target.uuid}`, timeoutMs: 120000 }
  );
  state.bonus = reply.status === "success" && reply.duel;
}
export function applyHunterAttack(config) {
  if (!config.workflow?.grimgutzHunterAttack?.bonus || config.grimgutzHunterAttack) return;
  for (const roll of config.rolls ?? []) {
    roll.parts ??= [];
    roll.parts.push("1d4");
  }
  config.grimgutzHunterAttack = true;
}
export async function prepareHunterSave(target, workflow, details) {
  if (
    !enabled() ||
    !workflow?.actor ||
    !workflow.token ||
    details.grimgutzHunterSave ||
    (details.rollType && details.rollType !== "save")
  )
    return;
  if (!has(workflow.actor, "duel", 2) && !hunterLevel(target?.actor)) return;
  details.grimgutzHunterSave = true;
  const reply = await requestGm(
    "hunter-roll-context",
    workflow.actor,
    {
      kind: "save",
      workflowId: workflow.id,
      sourceUuid: tokenRef(workflow.token).uuid,
      targetUuid: tokenRef(target).uuid,
      activityUuid: workflow.activity.uuid
    },
    { requestId: `hunter-save:${workflow.id}:${tokenRef(target).uuid}`, timeoutMs: 120000 }
  );
  if (reply.status !== "success") return;
  if (reply.advantage) addSaveAdvantage(details, `${MODULE_ID}.hunter-trophy`, "Трофей Охотника");
  if (reply.duel && Number.isFinite(reply.penalty)) {
    // Midi 14 has no additive field in SaveDetails. Raising THIS target's DC by
    // the evaluated d4 is exactly equivalent to subtracting it from its save.
    details.rollDC += reply.penalty;
    details.hunterPenalty = reply.penalty;
  }
}
const hitsState = actor => actor.getFlag(MODULE_ID, "hunterHitUses") ?? { offers: [], turns: {} };
async function writeHits(actor, state) {
  await actor.setFlag(MODULE_ID, "hunterHitUses", {
    offers: state.offers.slice(-40),
    turns: Object.fromEntries(Object.entries(state.turns).slice(-60))
  });
}
const availableTurn = (state, key, turn) => Boolean(turn) && !state.turns[`${key}:${turn}`];
const sourceTurn = source => {
  const combat = encounterForScene(source.parent, source),
    snapshot = combat && combatTurnSnapshot(combat);
  return { turn: turnKey(combat), own: snapshot?.current.token?.uuid === source.uuid };
};
const workflowKey = workflow =>
  workflow.id && workflow.id !== workflow.activity.uuid
    ? String(workflow.id)
    : `${workflow.activity.uuid}:${foundry.utils.randomID()}`;

registerGmRequest("hunter-hit-offer", (actor, data) =>
  serialMutation(`hunter-hit:${actor.uuid}`, async () => {
    const source = await fromUuid(data.sourceUuid),
      target = await fromUuid(data.targetUuid),
      activity = await fromUuid(data.activityUuid);
    if (
      source?.actor?.uuid !== actor.uuid ||
      activity?.actor?.uuid !== actor.uuid ||
      activity.item.type !== "weapon" ||
      activity.type !== "attack" ||
      target?.parent?.id !== source.parent.id ||
      !hunterLevel(actor)
    )
      return false;
    const state = hitsState(actor),
      previous = state.offers.find(e => e.id === data.id);
    if (previous) return { status: "success", offered: true };
    const timing = sourceTurn(source);
    if (!timing.turn || timing.turn !== data.turn) return false;
    const lonely = await isolatedTarget(actor, source, target),
      offer = {
        id: data.id,
        sourceUuid: source.uuid,
        targetUuid: target.uuid,
        activityUuid: activity.uuid,
        turn: timing.turn,
        breakdown: null,
        bonuses: [],
        status: "offered"
      };
    if (lonely && has(actor, "breakdown") && availableTurn(state, "breakdown", timing.turn)) {
      const choice = await askOwner(actor, {
        title: "Разбор: одна брешь",
        choices: [
          ["none", "Не применять"],
          ["wound", "Глубокая рана"],
          ["slow", "Сбитый темп"],
          ["reaction", "Сорванный ответ"]
        ]
      });
      if (choice && choice !== "none") offer.breakdown = choice;
    }
    const ready = actor.getFlag(MODULE_ID, "hunterReady");
    if (
      lonely &&
      timing.own &&
      has(actor, "combination", 3) &&
      ready?.turn === timing.turn &&
      ready.sourceUuid === source.uuid &&
      ready.targetUuid === target.uuid &&
      availableTurn(state, "combination", timing.turn) &&
      (ready.type !== "cut" || activity.attack?.type?.value === "melee")
    )
      offer.combo = ready;
    let budget = Number(hunterPool(actor)?.system.uses.max ?? 0) - Number(hunterPool(actor)?.system.uses.spent ?? 0);
    for (const entry of selectedHunterTrophies(actor)) {
      if (!["charge-hit", "fire-hit", "giant-hit", "undead-hit", "grapple-hit", "passive-hit"].includes(entry.mode))
        continue;
      if (entry.key === "hunter-monstrosity-major" && !lonely) continue;
      if (
        entry.passive &&
        (!timing.own || !availableTurn(state, entry.key, timing.turn) || !hunterPassiveActive(actor, entry.key))
      )
        continue;
      if (
        entry.mode === "charge-hit" &&
        (!availableTurn(state, entry.key, timing.turn) ||
          !(await confirmOwner(
            actor,
            entry.name,
            "В этот ход вы перед попаданием переместились по прямой к цели не менее 20 футов?"
          )))
      )
        continue;
      if (!entry.passive && budget < entry.cost) continue;
      if (
        !(await confirmOwner(
          actor,
          entry.name,
          entry.passive
            ? "Применить дополнительный урон этого попадания? Раз в свой ход."
            : `Применить к этому попаданию за ${entry.cost} использования общего запаса?`
        ))
      )
        continue;
      offer.bonuses.push({
        key: entry.key,
        itemUuid: entry.item.uuid,
        mode: entry.mode,
        passive: entry.passive,
        damageType: entry.snapshot.damageType
      });
      if (!entry.passive) budget -= entry.cost;
    }
    state.offers.push(offer);
    await writeHits(actor, state);
    return { status: "success", offered: true };
  })
);
const plain = value => JSON.parse(JSON.stringify(value));
const ACTIVATE = item =>
  [...(item.system.activities?.values?.() ?? [])].find(a => automationData(a).hunterOperation === "activate");
async function bonusRoll(formula, type, critical) {
  return plain(
    await new CONFIG.Dice.DamageRoll(
      formula,
      {},
      { type, types: [type], isCritical: critical?.isCritical === true, critical: critical?.critical ?? {} }
    ).evaluate()
  );
}
async function hitSave(actor, item, source, target, key, ability = "str") {
  return hunterSave(actor, item, source, target, ability, key);
}
registerGmRequest("hunter-hit-complete", (actor, data) =>
  serialMutation(`hunter-hit:${actor.uuid}`, async () => {
    const state = hitsState(actor),
      offer = state.offers.find(e => e.id === data.id);
    if (!offer) return false;
    const source = await fromUuid(offer.sourceUuid),
      target = await fromUuid(offer.targetUuid),
      activity = await fromUuid(offer.activityUuid);
    if (source?.actor?.uuid !== actor.uuid || !target?.actor || activity?.actor?.uuid !== actor.uuid) return false;
    const signature = JSON.stringify(data.rolls?.map(r => [r.formula, r.total, r.terms]));
    if (offer.status === "applied")
      return offer.signature === signature ? { status: "success", rolls: offer.rolls } : { status: "needs-review" };
    if (offer.status === "needs-review") return { status: "needs-review" };
    if (!data.rolls?.length || !data.rolls.every(r => r.evaluated && Number.isFinite(r.total))) return false;
    if (canvas.scene?.id !== source.parent.id || !canvas.ready) return false;
    const rolls = [...data.rolls],
      critical = rolls[0].options,
      type = data.weaponType;
    if (!CONFIG.DND5E.damageTypes?.[type]) return false;
    offer.status = "needs-review";
    offer.signature = signature;
    await writeHits(actor, state);
    if (offer.breakdown && availableTurn(state, "breakdown", offer.turn)) {
      const item = findFeature(actor, "hunter-breakdown");
      state.turns[`breakdown:${offer.turn}`] = offer.id;
      await writeHits(actor, state);
      if (offer.breakdown === "wound")
        rolls.push(await bonusRoll(`1d${hunterDie(hunterLevel(actor))}`, type, critical));
      if (offer.breakdown === "slow")
        await addCombatBenefit(source, target, item, {
          kind: "hunter-slow",
          expiry: "sourceStart",
          changes: ["walk", "fly", "swim", "climb", "burrow"].map(m => ({
            key: effectKey(`system.attributes.movement.${m}`),
            value: `max(0, @attributes.movement.${m} - ${hunterFeet(10, target.actor.system.attributes.movement.units)})`,
            type: "override",
            phase: "final",
            priority: 30
          }))
        });
      if (offer.breakdown === "reaction")
        await addCombatBenefit(source, target, item, {
          kind: "hunter-reactions-only",
          expiry: "sourceStart",
          against: [source.uuid]
        });
    }
    if (offer.combo && availableTurn(state, "combination", offer.turn)) {
      const item = findFeature(actor, "hunter-combination");
      state.turns[`combination:${offer.turn}`] = offer.id;
      await writeHits(actor, state);
      if (offer.combo.type === "concentration")
        notify(
          "Комбинация: спасбросок концентрации именно от урона этой атаки проводится с помехой. Подтвердите её в нативном диалоге; обычные спасброски Телосложения не изменены."
        );
      else {
        const result = await hitSave(actor, item, source, target, `${offer.id}:combo`);
        if (result?.status !== "success") return { status: "needs-review" };
        if (result.failedSaves.includes(target.uuid)) {
          if (offer.combo.type === "cut")
            await addCombatBenefit(source, target, item, {
              kind: "hunter-cut",
              expiry: "sourceStart",
              changes: ["walk", "fly", "swim", "climb", "burrow"].map(m => ({
                key: effectKey(`system.attributes.movement.${m}`),
                value: "0",
                type: "override",
                phase: "final",
                priority: 30
              }))
            });
          else
            notify(
              "Выбить: цель роняет выбранный удерживаемый предмет в своём пространстве. Перенос/поднятие предмета выполните вручную."
            );
        }
      }
      if (actor.getFlag(MODULE_ID, "hunterReady")?.nonce === offer.combo.nonce)
        await actor.unsetFlag(MODULE_ID, "hunterReady");
    }
    for (const chosen of offer.bonuses) {
      const entry = selectedHunterTrophy(actor, chosen.key);
      if (!entry || entry.item.uuid !== chosen.itemUuid) continue;
      if ((entry.passive || entry.mode === "charge-hit") && !availableTurn(state, entry.key, offer.turn)) continue;
      if (!entry.passive) {
        const result = await applyNativeOnce(
          actor,
          {
            requestId: `${offer.id}:${entry.item.id}`,
            action: "hunter-hit-trophy",
            activityUuid: ACTIVATE(entry.item).uuid
          },
          () => useHunterCost(ACTIVATE(entry.item)),
          async () => true
        );
        if (result.status === "cancelled") continue;
        if (result.status !== "success") return { status: "needs-review" };
      }
      if (entry.passive || entry.mode === "charge-hit") {
        state.turns[`${entry.key}:${offer.turn}`] = offer.id;
        await writeHits(actor, state);
      }
      const formula =
        entry.mode === "fire-hit"
          ? "3d6"
          : entry.mode === "charge-hit"
            ? "8d6"
            : ["giant-hit", "undead-hit"].includes(entry.mode)
              ? "6d8"
              : entry.key === "hunter-elemental-medium"
                ? "1d6"
                : entry.key === "hunter-monstrosity-major"
                  ? "1d8"
                  : null;
      const damageType =
        entry.mode === "fire-hit"
          ? "fire"
          : entry.mode === "giant-hit"
            ? "bludgeoning"
            : entry.mode === "undead-hit"
              ? "necrotic"
              : entry.key === "hunter-elemental-medium"
                ? entry.snapshot.damageType
                : type;
      if (formula) rolls.push(await bonusRoll(formula, damageType, critical));
      if (entry.mode === "undead-hit")
        await hunterCondition(actor, entry.item, source, target, {
          flags: {
            hunterHealingBlocked: true,
            repeatSave: {
              ability: "con",
              dc: hunterDC(actor),
              damage: [],
              event: "turnEnd",
              sourceTokenUuid: source.uuid,
              sourceItemUuid: entry.item.uuid,
              targetTokenUuid: target.uuid
            }
          }
        });
      if (
        entry.mode === "giant-hit" ||
        (entry.mode === "charge-hit" && ["tiny", "sm", "med", "lg", "huge"].includes(target.actor.system.traits.size))
      ) {
        const result = await hitSave(actor, entry.item, source, target, `${offer.id}:${entry.item.id}:prone`);
        if (result?.status !== "success") return { status: "needs-review" };
        if (result.failedSaves.includes(target.uuid)) {
          await target.actor.toggleStatusEffect("prone", { active: true });
          if (entry.mode === "giant-hit") notify("Переместите цель от охотника до 20 футов вручную.");
        }
      }
      if (entry.mode === "grapple-hit") {
        const check = await actor.rollSkill(
          { skill: "ath", ability: hunterConfig(actor).ability, advantage: true },
          { configure: false }
        );
        if (!check?.length) return { status: "needs-review" };
        notify(
          "Трофей чудовища: проверка проведена. Допустимый размер, встречная проверка и итог захвата/толчка подтверждаются GM; этот результат не является автоматическим успехом."
        );
      }
    }
    offer.status = "applied";
    offer.rolls = rolls;
    await writeHits(actor, state);
    return { status: "success", rolls };
  })
);
export async function offerHunterHit(workflow) {
  if (
    !enabled() ||
    !hunterLevel(workflow?.actor) ||
    workflow.item?.type !== "weapon" ||
    workflow.activity?.type !== "attack" ||
    workflow.aborted ||
    !workflow.attackRoll ||
    automationData(workflow.activity).auraPulse
  )
    return;
  const hits = [...(workflow.hitTargets ?? [])];
  if (hits.length !== 1 || workflow.grimgutzHunterHit) return;
  const source = tokenRef(workflow.token);
  if (!source?.parent) return;
  const timing = sourceTurn(source);
  if (!timing.turn) return;
  const state = (workflow.grimgutzHunterHit = { id: workflowKey(workflow), turn: timing.turn });
  const reply = await requestGm(
    "hunter-hit-offer",
    workflow.actor,
    {
      id: state.id,
      turn: timing.turn,
      sourceUuid: source.uuid,
      targetUuid: tokenRef(hits[0]).uuid,
      activityUuid: workflow.activity.uuid
    },
    { requestId: `hunter-offer:${state.id}`, timeoutMs: 120000 }
  );
  state.ready = reply.status === "success";
}
export async function finishHunterHit(workflow) {
  const state = workflow?.grimgutzHunterHit;
  if (!enabled() || !state?.ready || state.done || workflow.aborted || !workflow.damageRolls?.length) return;
  if (state.promise) return state.promise;
  const type = [...(workflow.item.system.damage?.base?.types ?? [])][0] ?? workflow.damageRolls[0].options.type;
  state.promise = (async () => {
    const reply = await requestGm(
      "hunter-hit-complete",
      workflow.actor,
      { id: state.id, weaponType: type, rolls: workflow.damageRolls.map(plain) },
      { requestId: `hunter-complete:${state.id}`, timeoutMs: 120000 }
    );
    if (reply.status === "success") {
      await workflow.setDamageRolls(reply.rolls.map(data => CONFIG.Dice.DamageRoll.fromData(data)));
      state.done = true;
    } else if (["needs-review", "pending", "failed"].includes(reply.status)) {
      workflow.aborted = true;
      notify("Разбор/трофеи: результат требует проверки GM; автоматическое применение урона остановлено.", "warn");
    }
  })();
  try {
    return await state.promise;
  } catch (error) {
    workflow.aborted = true;
    notify(error.message, "warn");
  } finally {
    state.promise = null;
  }
}
registerGmRequest("hunter-combination", async (actor, data, { requestId }) => {
  const item = await fromUuid(data.itemUuid),
    activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid);
  if (
    item?.actor?.uuid !== actor.uuid ||
    item.system.identifier !== "hunter-combination" ||
    !has(actor, "combination", 3) ||
    source?.actor?.uuid !== actor.uuid ||
    canvas.scene?.id !== source.parent.id ||
    !canvas.ready
  )
    return false;
  const timing = sourceTurn(source);
  if (!timing.own || !availableTurn(hitsState(actor), "combination", timing.turn)) return false;
  const type = await askOwner(actor, {
    title: "Комбинация: подготовка до атаки",
    choices: [
      ["cut", "Подрезать: прямой разбег 15 футов"],
      ["disarm", "Выбить: успешный толчок"],
      ["concentration", "Сорвать сосредоточение: изучить бонусным действием"]
    ]
  });
  if (!type) return false;
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: "Подготовленная цель",
    min: 1,
    max: 1,
    relation: t => t.uuid !== source.uuid && inFeet(source, t, 60, source.parent)
  });
  if (!targets?.length) return false;
  if (
    !(await confirmOwner(
      actor,
      item.name,
      type === "cut"
        ? "В этот ход непосредственно перед следующей атакой вы переместились прямо к цели на 15 футов своей скоростью?"
        : type === "disarm"
          ? "Вы успешно толкнули эту цель в этот же ход до следующей атаки?"
          : "Вы видите эту цель в 60 футах?"
    ))
  )
    return false;
  const apply = async () => {
    await actor.setFlag(MODULE_ID, "hunterReady", {
      type,
      targetUuid: targets[0].uuid,
      sourceUuid: source.uuid,
      turn: timing.turn,
      nonce: foundry.utils.randomID()
    });
    return true;
  };
  return type === "concentration"
    ? applyNativeOnce(
        actor,
        { requestId, action: "hunter-study", activityUuid: activity.uuid },
        () => useHunterCost(activity, { cost: 0, activation: "bonus" }),
        apply
      )
    : apply();
});
registerGmRequest("hunter-follow", async (actor, data, { requestId }) => {
  const item = await fromUuid(data.itemUuid),
    activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid);
  if (
    item?.actor?.uuid !== actor.uuid ||
    item.system.identifier !== "hunter-pursuit" ||
    !has(actor, "pursuit", 2) ||
    source?.actor?.uuid !== actor.uuid ||
    !canReact(actor) ||
    canvas.scene?.id !== source.parent.id ||
    !canvas.ready
  )
    return false;
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: "Переместившаяся добыча",
    min: 1,
    max: 1,
    relation: t => t.uuid !== source.uuid && inFeet(source, t, 60, source.parent)
  });
  if (!targets?.length || !(await isolatedTarget(actor, source, targets[0]))) return false;
  if (
    !(await confirmOwner(
      actor,
      item.name,
      "Одинокая видимая цель только что переместилась? Подойдите к ней вручную не дальше половины скорости, без атак возможности именно этого перемещения."
    ))
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "hunter-follow", activityUuid: activity.uuid },
    () => useHunterCost(activity, { cost: 0, activation: "reaction" }),
    async () => {
      await recordModuleReaction(actor, source.parent);
      return true;
    }
  );
});
export async function rememberHunterUse(workflow) {
  if (
    !enabled() ||
    !hunterLevel(workflow?.actor) ||
    workflow.aborted ||
    !workflow.attackRoll ||
    workflow.item.type !== "weapon" ||
    automationData(workflow.activity).auraPulse ||
    automationData(workflow.activity).hunterRetry
  )
    return;
  return requestGm(
    "hunter-remember",
    workflow.actor,
    {
      activityUuid: workflow.activity.uuid,
      sourceUuid: tokenRef(workflow.token).uuid,
      id: workflow.id,
      turn: workflow.grimgutzHunterOrigin?.turn ?? sourceTurn(tokenRef(workflow.token)).turn,
      hitUuids: [...(workflow.hitTargets ?? [])].map(t => tokenRef(t).uuid),
      targetUuids: [...(workflow.targets ?? [])].map(t => tokenRef(t).uuid)
    },
    { requestId: `hunter-remember:${workflow.id}` }
  );
}
registerGmRequest("hunter-remember", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid),
    source = await fromUuid(data.sourceUuid);
  if (activity?.actor?.uuid !== actor.uuid || source?.actor?.uuid !== actor.uuid) return false;
  await actor.setFlag(MODULE_ID, "hunterLastAttack", data);
  return true;
});
registerGmRequest("hunter-retry", (actor, data, { requestId }) =>
  serialMutation(`hunter-retry:${actor.uuid}`, async () => {
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const source = await fromUuid(data.sourceUuid),
      trophy = selectedHunterTrophy(actor, "hunter-construct-major"),
      feature = await fromUuid(data.itemUuid),
      last = actor.getFlag(MODULE_ID, "hunterLastAttack");
    if (
      !trophy ||
      feature?.id !== trophy.item.id ||
      source?.actor?.uuid !== actor.uuid ||
      !last ||
      last.sourceUuid !== source.uuid ||
      last.hitUuids.length ||
      last.targetUuids.length !== 1
    )
      return false;
    const timing = sourceTurn(source),
      used = actor.getFlag(MODULE_ID, "hunterRetryTurns") ?? [];
    if (
      !timing.own ||
      timing.turn !== last.turn ||
      used.includes(timing.turn) ||
      canvas.scene?.id !== source.parent.id ||
      !canvas.ready
    )
      return false;
    if (
      ![...(actor.effects ?? [])].some(
        e => isEffectActive(e) && e.getFlag?.(MODULE_ID, "hunterMissRetry")?.itemUuid === trophy.item.uuid
      )
    )
      return false;
    const attack = await fromUuid(last.activityUuid),
      target = await fromUuid(last.targetUuids[0]);
    if (
      attack?.actor?.uuid !== actor.uuid ||
      attack.item.type !== "weapon" ||
      !target?.actor ||
      target.parent.id !== source.parent.id
    )
      return false;
    if (
      !(await confirmOwner(
        actor,
        trophy.name,
        "Атаковать с преимуществом тем же оружием ту же цель после этого промаха? Раз в свой ход, без повторной активации трофея."
      ))
    )
      return false;
    const row = attack.toObject();
    row.activation = { type: "special", value: 0, override: true };
    row.flags = {
      ...row.flags,
      [MODULE_ID]: { action: "", moduleAction: "", leaderResolved: true, hunterRetry: true }
    };
    const item = attack.item.clone({ system: { activities: { [attack.id]: row } } }, { keepId: true });
    // Reserve the turn before the child workflow. Unknown outcomes cannot be
    // repeated under a fresh request ID; only a confirmed cancellation releases it.
    await actor.setFlag(MODULE_ID, "hunterRetryTurns", [...used, timing.turn].slice(-60));
    const result = await applyNativeOnce(
      actor,
      { requestId, action: "hunter-retry", activityUuid: attack.uuid },
      () =>
        MidiQOL.completeActivityUse(
          item.system.activities.get(attack.id),
          {
            midiOptions: {
              targetUuids: [target.uuid],
              workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
            }
          },
          { configure: false }
        ),
      async () => true
    );
    if (result.status === "cancelled")
      await actor.setFlag(
        MODULE_ID,
        "hunterRetryTurns",
        (actor.getFlag(MODULE_ID, "hunterRetryTurns") ?? []).filter(turn => turn !== timing.turn)
      );
    return result;
  })
);
registerGmRequest("hunter-reaction-guard", async (actor, data) => {
  const activity = await fromUuid(data.activityUuid);
  if (activity?.actor?.uuid !== actor.uuid) return false;
  const limits = activeBenefits(actor).filter(e => benefitData(e).kind === "hunter-reactions-only");
  if (!limits.length) return true;
  if (activity.type === "attack" && data.targets.length === 1)
    return limits.every(e => benefitData(e).against.includes(data.targets[0]));
  const key = `reaction:${data.id}`,
    old = contextRows(actor)[key];
  if (old) return old.allowed;
  const allowed = await confirmOwner(
    gm(actor),
    "Сорванный ответ (GM)",
    "Эта реакция совершается против охотника, вызвавшего ограничение? Для защитных/нецелевых реакций учитывается причина, не только выбранный токен."
  );
  await saveContext(actor, key, { allowed });
  return allowed;
});
export async function guardHunterReaction(workflow) {
  if (
    !enabled() ||
    workflow?.activity?.activation?.type !== "reaction" ||
    !activeBenefits(workflow.actor).some(e => benefitData(e).kind === "hunter-reactions-only")
  )
    return;
  const id = (workflow.grimgutzHunterReactionId ??= workflowKey(workflow));
  const reply = await requestGm(
    "hunter-reaction-guard",
    workflow.actor,
    { activityUuid: workflow.activity.uuid, id, targets: [...(workflow.targets ?? [])].map(t => tokenRef(t).uuid) },
    { requestId: `hunter-reaction:${id}`, timeoutMs: 120000 }
  );
  if (reply.status !== "success") {
    notify("Сорванный ответ: эта реакция недоступна против другой цели.", "warn");
    return false;
  }
}
onPrepareAttack(async ({ actor, attacker, target, data }) => {
  if (!data.opportunity) return [];
  const restriction = activeBenefits(actor).find(
    e => benefitData(e).kind === "hunter-reactions-only" && !benefitData(e).against.includes(target.uuid)
  );
  return restriction
    ? [
        {
          kind: "prevent-attack",
          effectUuid: restriction.uuid,
          name: "Сорванный ответ: реакция только против охотника"
        }
      ]
    : [];
});
export function applyHunterReach(workflow) {
  if (
    !enabled() ||
    !hunterPassiveActive(workflow?.actor, "hunter-giant-medium") ||
    workflow.item?.type !== "weapon" ||
    workflow.activity?.attack?.type?.value !== "melee" ||
    workflow.grimgutzHunterReach
  )
    return;
  const data = workflow.activity.toObject(),
    range = workflow.activity.range,
    units = range?.units || workflow.item.system.range?.units || "ft";
  const added = hunterFeet(5, units);
  data.range = {
    ...data.range,
    override: true,
    units,
    value: Number(range?.value ?? workflow.item.system.range?.reach ?? 5) + added
  };
  const item = workflow.item.clone({ system: { activities: { [workflow.activity.id]: data } } }, { keepId: true });
  workflow.item = item;
  workflow.activity = item.system.activities.get(workflow.activity.id);
  workflow.grimgutzHunterReach = true;
}
export function installHunterCombatHooks() {
  Hooks.on("midi-qol.preTargetingV2", async ({ workflow }) => {
    if (enabled() && hunterLevel(workflow?.actor) && workflow.token)
      workflow.grimgutzHunterOrigin ??= { turn: sourceTurn(tokenRef(workflow.token)).turn };
    applyHunterReach(workflow);
    return guardHunterReaction(workflow);
  });
  Hooks.on("midi-qol.preAttackRollConfig", prepareHunterAttack);
  Hooks.on("dnd5e.preRollAttack", applyHunterAttack);
  Hooks.on("midi-qol.preTargetSave", prepareHunterSave);
  Hooks.on("midi-qol.preDamageRoll", offerHunterHit);
  Hooks.on("midi-qol.DamageRollComplete", finishHunterHit);
  Hooks.on("midi-qol.RollComplete", workflow => {
    void rememberHunterUse(workflow).catch(error => notify(error.message, "warn"));
  });
}
