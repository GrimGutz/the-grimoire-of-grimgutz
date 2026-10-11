import { automationData, findFeature, isAutomationAuthority, notify } from "../shared/helpers.mjs";
import { clamp } from "../shared/dnd5e.mjs";
import { ownedAreaActivity, useAreaActivity } from "../shared/area-activities.mjs";
import {askOwner, confirmOwner} from "../shared/owner-prompts.mjs";
import {registerGmRequest, requestGm} from "../shared/gm-requests.mjs";
import {useNativeUtility} from "../shared/native-actions.mjs";
import {applyNativeOnce, nativeApplicationReply} from "../shared/native-applications.mjs";
import {enabled, automationAction} from "../shared/helpers.mjs";
import {
  createWeaponBuff,
  postWeaponBuffMessage
} from "../shared/weapon-buffs.mjs";
import { witchBladeClass, witchBladeLevel } from "../shared/selectors.mjs";

const witchBladeRageSyncs = new Set();

function witchHunterFeature(actor) {
  return findFeature(actor, "witch-hunter");
}

function witchBladeRageMaximum(actor) {
  return [0, 3, 4, 5, 6, 7][clamp(witchBladeLevel(actor), 0, 5)] ?? 0;
}

export function witchBladeRagePoints(actor) {
  const feature = witchHunterFeature(actor);
  const maximum = witchBladeRageMaximum(actor);
  const spent = Number(feature?.system?.uses?.spent ?? 0);
  return {
    feature,
    maximum,
    spent: Number.isFinite(spent) ? spent : 0,
    remaining: Math.max(0, maximum - (Number.isFinite(spent) ? spent : 0))
  };
}

export async function syncWitchBladeRage(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || witchBladeRageSyncs.has(actor.uuid)) return;
  witchBladeRageSyncs.add(actor.uuid);
  try {
    const rage = witchBladeRagePoints(actor);
    if (!rage.feature || !witchBladeClass(actor)) return;
    const update = {};
    const maximum = String(rage.maximum);
    if (String(rage.feature.system?.uses?.max ?? "") !== maximum) {
      update["system.uses.max"] = maximum;
    }
    if (rage.spent > rage.maximum) {
      update["system.uses.spent"] = rage.maximum;
    }
    if (Object.keys(update).length) await rage.feature.update(update);
    if (notifyResult) notify(`${actor.name}: Очки Гнева Ведьминого клинка синхронизированы (${rage.maximum}).`);
  } finally {
    witchBladeRageSyncs.delete(actor.uuid);
  }
}

export async function useWitchBladeRage(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  const data = automationData(activity);
  const cost = Math.max(1, Number(data.witchBladeRageCost ?? 1));
  const rage = witchBladeRagePoints(actor);
  if (!rage.feature) {
    notify("Для траты Очков Гнева требуется особенность «Охотник на ведьм».", "warn");
    return false;
  }
  if (rage.remaining < cost) {
    notify(`Недостаточно Очков Гнева: требуется ${cost}, доступно ${rage.remaining}.`, "warn");
    return false;
  }
  await rage.feature.update({
    "system.uses.max": String(rage.maximum),
    "system.uses.spent": rage.spent + cost
  });
  notify(`${actor.name}: потрачено ${cost} Очк. Гнева, осталось ${rage.remaining - cost}.`);
  return true;
}

export function validateWitchBladeRageUse(actor, activity) {
  const rage = witchBladeRagePoints(actor);
  const required = Math.max(1, Number(automationData(activity).witchBladeRageCost ?? 1));
  if (actor && witchBladeClass(actor) && rage.feature && rage.remaining >= required) return true;
  notify(`Недостаточно Очков Гнева: требуется ${required}, доступно ${rage.remaining}.`, "warn");
  return false;
}

export async function activateWitchHunterEmpower(actor, activity) {
  if (!actor || !witchBladeClass(actor)) {
    notify("Эта активность требует класс «Ведьмин клинок».", "warn");
    return false;
  }
  if (!await useWitchBladeRage(actor, activity)) return false;
  const feature = findFeature(actor, "witch-hunter");
  await createWeaponBuff(actor, {
    key: "witch-hunter-empower",
    name: "Вспыхивающее оружие",
    sourceItem: feature,
    img: feature?.img,
    duration: { seconds: 60 },
    data: {
      advantageAgainstSpellcasters: true,
      advantageLabel: "Вспыхивающее оружие: цель имеет ячейки заклинаний"
    },
    description: "<p>Пока эффект активен, weapon attacks получают преимущество против целей, у которых есть ячейки заклинаний. Проверка цели выполняется по выбранным target токенам.</p>"
  });
  await postWeaponBuffMessage(actor, "Вспыхивающее оружие", "Оружейный бафф активен на 1 минуту. Weapon attacks получают преимущество против выбранных целей с ячейками заклинаний.");
  return true;
}

export async function activateWitchCrystallization(actor, activity = null) {
  return useChosenWitchBuff(actor, "activate-witch-crystallization", activity);
}

export function availableWitchSlots(actor) {
  return Object.entries(actor.system?.spells ?? {}).filter(([key, slot]) => /^(spell[1-9]|pact)$/.test(key) && Number(slot.value) > 0)
    .map(([key, slot]) => ({key, level: Number(slot.level ?? key.replace("spell", "")), remaining: Number(slot.value)}))
    .filter(slot => Number.isInteger(slot.level) && slot.level > 0);
}
const witchBuffRequests = new Map();
async function useChosenWitchBuff(actor, action, activity, requestId) {
  activity ??= [...(findFeature(actor, action === "activate-witch-crystallization" ? "witch-crystallization" : "ethereal-storm")?.system.activities?.values?.() ?? [])][0];
  if (!activity) return false;
  const key = `${actor.uuid}:${action}`;
  if (!witchBuffRequests.has(key)) {
    const operation = requestGm("witch-chosen-weapon-buff", actor, {activityUuid: activity.uuid, action}, requestId ? {requestId} : {});
    witchBuffRequests.set(key, operation);
    void operation.finally(() => witchBuffRequests.delete(key)).catch(() => {});
  }
  return witchBuffRequests.get(key);
}
registerGmRequest("witch-chosen-weapon-buff", async (actor, data, {requestId}) => {
  const activity = await fromUuid(data.activityUuid);
  if (activity?.actor?.uuid !== actor.uuid || automationAction(activity) !== data.action || !witchBladeClass(actor)) throw Error("Не найдена оружейная способность.");
  const previous = nativeApplicationReply(actor, requestId); if (previous) return previous;
  const crystal = data.action === "activate-witch-crystallization", feature = activity.item;
  const weapons = [...actor.items].filter(item => item.type === "weapon" && item.system.equipped !== false
    && [...(item.system.activities?.values?.() ?? [])].some(a => a.type === "attack" && a.attack?.type?.value === "melee"));
  const ids = [];
  for (let i = 0; i < (crystal ? 1 : 2); i++) {
    const uuid = await askOwner(actor, {title: feature.name, label: "Рукопашное оружие", choices: weapons.filter(w => !ids.includes(w.uuid)).map(w => [w.uuid, w.name])});
    if (!uuid) return false; ids.push(uuid);
  }
  if (!await confirmOwner(actor, feature.name, crystal ? "Держите выбранное оружие одной рукой и не держите другое оружие?" : "Сражаетесь выбранной парой оружий?")) return false;
  let slot;
  if (crystal) {
    const key = await askOwner(actor, {title: feature.name, label: "Доступная ячейка", choices: availableWitchSlots(actor).map(s => [s.key, `${s.level}-й круг (${s.remaining}), ${s.key === "pact" ? "договор" : "обычная"}`])});
    slot = availableWitchSlots(actor).find(s => s.key === key); if (!slot) return false;
  }
  const resource = witchHunterFeature(actor);
  if (!crystal && witchBladeRagePoints(actor).remaining < 1) return false;
  if (ids.some(uuid => ![...actor.items].some(w => w.uuid === uuid && w.system.equipped !== false && weapons.includes(w)))) return false;
  return applyNativeOnce(actor, {requestId, action: data.action, activityUuid: activity.uuid},
    () => useNativeUtility(activity, {dataPatch: {consumption: {spellSlot: false, scaling: {allowed: false, max: ""},
      targets: [crystal ? {type: "attribute", target: `spells.${slot.key}.value`, value: "1"} : {type: "itemUses", target: resource.id, value: "1"}]}}}),
    async () => {
      if (crystal && slot.level < 2) {await postWeaponBuffMessage(actor, feature.name, "Ячейка первого круга потрачена; по правилу критический порог не меняется. Пустой эффект не создан."); return true;}
      return createWeaponBuff(actor, {key: crystal ? "witch-crystallization" : "ethereal-storm", name: feature.name, sourceItem: feature,
        duration: {seconds: 60}, data: {weaponUuids: ids, ...(crystal ? {criticalThresholdReduction: Math.floor(slot.level / 2), slotLevel: slot.level} : {reach: 30})},
        description: "<p>Действует только на выбранное оружие. Срок 1 минута — домашнее правило мира.</p>"});
    });
});

export function installWitchBladeHooks() {
  const intercept = (activity, workflow) => {
    if (!enabled() || automationData(activity).leaderResolved || !["activate-witch-crystallization", "activate-ethereal-storm"].includes(automationAction(activity))) return;
    void useChosenWitchBuff(activity.actor, automationAction(activity), activity, workflow?.uuid ? `witch:${workflow.uuid}` : undefined).catch(error => notify(error.message, "warn")); return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({workflow}) => intercept(workflow?.activity, workflow));
  Hooks.on("dnd5e.preUseActivity", activity => intercept(activity));
}

export async function activateEtherealStorm(actor, activity) {
  return useChosenWitchBuff(actor, "activate-ethereal-storm", activity);
}
export async function openImmaterialWhirlwind(actor, activity) {
  const chosen = activity?.item ? activity : ownedAreaActivity(actor, "immaterial-whirlwind", "open-immaterial-whirlwind");
  if (!chosen) { notify("Не найдена активность Нематериального вихря на персонаже.", "warn"); return false; }
  return Boolean(await useAreaActivity(chosen, { validate: () => validateWitchBladeRageUse(actor, chosen) }));
}

export async function useWitchBladeSealEvil(actor, activity) {
  const chosen = activity?.item ? activity : ownedAreaActivity(actor, "witch-blade-seal", "use-witch-blade-seal-evil");
  if (!chosen) { notify("Не найдена злая Печать Ведьминого клинка на персонаже.", "warn"); return false; }
  return Boolean(await useAreaActivity(chosen, { validate: () => validateWitchBladeRageUse(actor, chosen) }));
}
