import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import {
  flaggedPassiveEffectData,
  syncFlaggedPassiveEffects
} from "../effects/passive-helpers.mjs";

const insectLordSyncs = new Set();
const insectLordPassiveSyncs = new Set();

export function insectLordClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "insect-lord");
}

export function insectLordLevel(actor) {
  return Number(insectLordClass(actor)?.system?.levels ?? 0);
}

function hasSkillProficiency(actor, key) {
  const skill = actor?.system?.skills?.[key];
  const value = Number(skill?.value ?? skill?.proficient ?? 0);
  return value > 0 || skill?.proficient === true;
}

export function insectLordPrerequisiteFailures(actor) {
  const failures = [];
  if (!hasSkillProficiency(actor, "nat")) failures.push("владение навыком Природа");
  if (!hasSkillProficiency(actor, "ste")) failures.push("владение навыком Скрытность");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateInsectLordPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "insect-lord") return true;
  const failures = insectLordPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Владыка насекомых». Не выполнено: ${failures.join(", ")}. Посвящение разумным насекомоподобным существом подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateInsectLordFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.insectLordFeature !== true || options?.isAdvancement) return true;
  const level = insectLordLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Владыка насекомых».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Владыки насекомых.`, "error");
    return false;
  }
  return true;
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(0, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export async function syncInsectLordResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || insectLordSyncs.has(actor.uuid)) return false;
  if (!insectLordClass(actor)) return false;

  insectLordSyncs.add(actor.uuid);
  try {
    const constitutionUses = Math.max(1, abilityMod(actor, "con"));
    const updates = [
      await syncUses(findFeature(actor, "crawling-armor"), 1),
      await syncUses(findFeature(actor, "spew-insects"), constitutionUses)
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Владыки насекомых синхронизированы.`);
    return changed;
  } finally {
    insectLordSyncs.delete(actor.uuid);
  }
}

function equippedArmor(actor) {
  return actor?.items?.some(item => {
    if (item.type !== "equipment" || item.system?.equipped !== true) return false;
    const type = String(
      item.system?.type?.value
      ?? item.system?.armor?.type
      ?? item.system?.type
      ?? ""
    ).toLowerCase();
    return ["light", "medium", "heavy", "lgt", "med", "hvy"].includes(type);
  }) ?? false;
}

function insectLordPassiveDefinitions(actor) {
  if (!insectLordClass(actor)) return [];
  const definitions = [];
  const carapace = findFeature(actor, "chitinous-carapace");
  if (carapace && !equippedArmor(actor)) {
    definitions.push(flaggedPassiveEffectData(MODULE_ID, FLAGS.INSECT_LORD_PASSIVE, {
      key: "chitinous-carapace",
      feature: carapace,
      changes: [{
        key: "system.attributes.ac.bonus",
        type: "add",
        value: String(insectLordLevel(actor) >= 5 ? 5 : 3),
        phase: "final",
        priority: 20
      }]
    }));
  }
  return definitions;
}

export async function syncInsectLordPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(actor, insectLordPassiveSyncs, MODULE_ID, FLAGS.INSECT_LORD_PASSIVE, insectLordPassiveDefinitions);
}

function bestPhysicalModifier(actor) {
  return Math.max(abilityMod(actor, "str"), abilityMod(actor, "dex"));
}

function signed(number) {
  return number >= 0 ? `+ ${number}` : `- ${Math.abs(number)}`;
}

function insectLordSaveDc(actor) {
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + abilityMod(actor, "con");
}

async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

export async function rollInsectTailSting(actor) {
  if (!actor || !findFeature(actor, "insect-natural-weapons")) {
    notify("Для броска требуется особенность «Природное оружие» Владыки насекомых.", "warn");
    return false;
  }
  const modifier = bestPhysicalModifier(actor);
  await rollToChat(actor, `1d4 ${signed(modifier)}`, "Хвост с жалом: колющий урон");
  await rollToChat(actor, "2d6", `Хвост с жалом: урон ядом; спасбросок Телосложения Сл ${insectLordSaveDc(actor)}, половина при успехе`);
  return true;
}

export async function rollInsectBoneBlades(actor) {
  if (!actor || !findFeature(actor, "insect-natural-weapons")) {
    notify("Для броска требуется особенность «Природное оружие» Владыки насекомых.", "warn");
    return false;
  }
  const modifier = bestPhysicalModifier(actor);
  await rollToChat(actor, `1d8 ${signed(modifier)}`, "Костяные клинки: режущий урон");
  return true;
}

export async function rollInsectBite(actor) {
  if (!actor || !findFeature(actor, "blood-drain")) {
    notify("Для броска требуется особенность «Высасывание крови».", "warn");
    return false;
  }
  await rollToChat(actor, "1d4", "Жвалы: колющий урон");
  return true;
}

export async function rollInsectBloodDrain(actor) {
  if (!actor || !findFeature(actor, "blood-drain")) {
    notify("Для броска требуется особенность «Высасывание крови».", "warn");
    return false;
  }
  const roll = await rollToChat(actor, "2d6", "Высасывание крови: урон; исцеление равно половине фактически нанесённого урона");
  notify(`${actor.name}: рекомендуемое исцеление до сопротивлений/иммунитетов цели — ${Math.floor(Number(roll.total ?? 0) / 2)} хитов.`);
  return true;
}

export async function useCrawlingArmor(actor) {
  if (!actor || !findFeature(actor, "crawling-armor")) {
    notify("Для реакции требуется особенность «Шевелящаяся броня».", "warn");
    return false;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><strong>${actor.name}: Шевелящаяся броня.</strong> Рой перехватывает атаку: выберите +5 КД против одной атаки или преимущество на один спасбросок против разрушительного заклинания. После перехвата рой погибает.</p>`
  });
  return true;
}

export async function rollInsectSpew(actor) {
  if (!actor || !findFeature(actor, "spew-insects")) {
    notify("Для броска требуется особенность «Изрыгание насекомых».", "warn");
    return false;
  }
  await rollToChat(actor, "4d12 + 3d12", `Изрыгание насекомых: 4к12 колющий + 3к12 яд; спасбросок Ловкости Сл ${insectLordSaveDc(actor)}, половина при успехе и без отравления`);
  return true;
}

function crawlingEyeEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.CREEPING_EYE_EFFECT));
}

export async function detachCrawlingEye(actor) {
  if (!actor || !findFeature(actor, "crawling-eye")) {
    notify("Для отделения глаза требуется особенность «Ползучий глаз».", "warn");
    return false;
  }
  const feature = findFeature(actor, "crawling-eye");
  const data = {
    name: "Ползучий глаз отделён",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.CREEPING_EYE_EFFECT]: true
      }
    },
    system: {
      changes: [{
        key: "system.attributes.hp.max",
        type: "add",
        value: "-2",
        phase: "final",
        priority: 20
      }]
    }
  };
  const current = crawlingEyeEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: Ползучий глаз отделён, максимум хитов снижен на 2.`);
  return true;
}

export async function returnCrawlingEye(actor) {
  const effect = crawlingEyeEffect(actor);
  if (!effect || !actor?.isOwner) {
    notify(`${actor?.name ?? "Персонаж"}: активного эффекта «Ползучий глаз» нет.`, "info");
    return false;
  }
  await effect.delete();
  notify(`${actor.name}: Ползучий глаз возвращён.`);
  return true;
}
