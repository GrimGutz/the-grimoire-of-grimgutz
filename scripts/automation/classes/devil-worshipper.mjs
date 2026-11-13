import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  enabled,
  findFeature,
  hasFeature,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { choiceDialog } from "../shared/dialogs.mjs";
import { grantSoulAuraTemporaryHp } from "../shared/aura-events.mjs";
import { createSummonedCreature } from "../shared/summons.mjs";
import { impFamiliarSummon } from "../shared/summon-templates.mjs";

const DEVIL_ABILITIES = {
  int: "Интеллект",
  wis: "Мудрость",
  cha: "Харизма"
};

export function devilWorshipperClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "devil-worshipper");
}

export function devilWorshipperLevel(actor) {
  return Number(devilWorshipperClass(actor)?.system?.levels ?? 0);
}

function spellSlotMax(actor, level) {
  const slot = actor?.system?.spells?.[`spell${level}`];
  return Math.max(Number(slot?.max ?? 0), Number(slot?.override ?? 0), Number(slot?.value ?? 0));
}

function pactSlotCanCastThirdLevel(actor) {
  const pact = actor?.system?.spells?.pact;
  return Number(pact?.level ?? 0) >= 3 && Math.max(Number(pact?.max ?? 0), Number(pact?.value ?? 0)) > 0;
}

function hasThirdLevelSpellSlot(actor) {
  return pactSlotCanCastThirdLevel(actor) || [3, 4, 5, 6, 7, 8, 9].some(level => spellSlotMax(actor, level) > 0);
}

function canCastSpellItem(item) {
  if (item?.type !== "spell" || Number(item?.system?.level ?? 0) < 3) return false;
  const preparation = item.system?.preparation;
  if (!preparation) return true;
  if (preparation.prepared === true) return true;
  return ["always", "atwill", "innate", "pact"].includes(String(preparation.mode ?? ""));
}

function canCastThirdLevelSpell(actor) {
  return hasThirdLevelSpellSlot(actor) || (actor?.items?.some(canCastSpellItem) ?? false);
}

function hasArcanaOrReligion(actor) {
  const arcana = actor?.system?.skills?.arc;
  const religion = actor?.system?.skills?.rel;
  return (
    Number(arcana?.value ?? arcana?.proficient ?? 0) > 0 || Number(religion?.value ?? religion?.proficient ?? 0) > 0
  );
}

export function devilWorshipperPrerequisiteFailures(actor) {
  const failures = [];
  if (!canCastThirdLevelSpell(actor)) failures.push("способность накладывать заклинание 3-го круга или выше");
  if (!hasArcanaOrReligion(actor)) failures.push("владение навыком Магия или Религия");
  return failures;
}

export function validateDevilWorshipperPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "devil-worshipper") return true;
  const failures = devilWorshipperPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Дьяволопоклонник». Не выполнено: ${failures.join(", ")}. Контракт с дьяволом подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateDevilWorshipperFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.devilWorshipperFeature !== true || options?.isAdvancement) return true;
  const level = devilWorshipperLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Дьяволопоклонник».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Дьяволопоклонника.`, "error");
    return false;
  }
  return true;
}

export function devilWorshipperAbility(actor) {
  const stored = actor?.getFlag(MODULE_ID, FLAGS.DEVIL_WORSHIPPER_ABILITY);
  if (stored in DEVIL_ABILITIES) return stored;
  return Object.keys(DEVIL_ABILITIES).reduce((best, ability) => {
    const value = Number(actor?.system?.abilities?.[ability]?.value ?? 0);
    const bestValue = Number(actor?.system?.abilities?.[best]?.value ?? 0);
    return value > bestValue ? ability : best;
  }, "cha");
}

function devilModifier(actor) {
  return abilityMod(actor, devilWorshipperAbility(actor));
}

export async function chooseDevilWorshipperAbility(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  const current = devilWorshipperAbility(actor);
  const selected = await choiceDialog({
    title: "Характеристика Дьяволопоклонника",
    label: "Характеристика",
    choices: Object.entries(DEVIL_ABILITIES).map(([key, label]) => ({ value: key, label, selected: key === current })),
    defaultValue: current,
    confirmIcon: "fa-solid fa-file-signature"
  });
  if (!(selected in DEVIL_ABILITIES)) return false;
  await actor.setFlag(MODULE_ID, FLAGS.DEVIL_WORSHIPPER_ABILITY, selected);
  notify(`${actor.name}: характеристика Дьяволопоклонника — ${DEVIL_ABILITIES[selected]}.`);
  return true;
}

function appendRollPart(roll, part) {
  if (!roll || !part) return;
  roll.parts ??= [];
  roll.parts.push(String(part));
}

function signedDamagePart(value, type) {
  return value >= 0 ? `${value}[${type}]` : `- ${Math.abs(value)}[${type}]`;
}

function damageMentionsFire(config, item) {
  const text = JSON.stringify([
    item?.system?.damage,
    config?.rolls?.map(roll => ({
      parts: roll?.parts,
      options: roll?.options
    }))
  ]).toLocaleLowerCase("en");
  return text.includes("fire");
}

export function applyHellfireDamageAutomation(config) {
  if (!enabled()) return;
  const activity = config?.subject;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (!actor || !item || item.type !== "spell" || !hasFeature(actor, "hellfire")) return;
  if (!damageMentionsFire(config, item)) return;
  const modifier = devilModifier(actor);
  if (!modifier) return;
  appendRollPart(config.rolls?.[0], signedDamagePart(modifier, "fire"));
}

function traitValues(actor, trait) {
  const value = actor?.system?.traits?.[trait]?.value;
  if (value instanceof Set) return [...value].map(String);
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/[,;]/).map(part => part.trim());
  return [];
}

function traitHas(actor, trait, damageType) {
  const values = traitValues(actor, trait).map(value => value.toLocaleLowerCase("en"));
  const custom = String(actor?.system?.traits?.[trait]?.custom ?? "").toLocaleLowerCase("ru");
  return values.includes(damageType) || custom.includes(damageType) || custom.includes("огонь");
}

function rawDamageDetails(damageItem) {
  const selector = damageItem?.damageSelector ?? "combinedDamage";
  const rawKey = `raw${selector}`;
  return foundry.utils.deepClone(damageItem?.damageDetails?.[rawKey] ?? damageItem?.rawDamageDetail ?? []);
}

function damageValue(detail) {
  return Math.max(0, Number(detail?.value ?? detail?.damage ?? 0));
}

export async function applyHellfireFury(
  token,
  { workflow, damageItem },
  { automationEnabled = true, recalculateDamageItem } = {}
) {
  const actor = workflow?.actor;
  if (!automationEnabled || !actor || !token?.actor || workflow?.item?.type !== "spell") return;
  if (!hasFeature(actor, "hellfire-fury")) return;

  const rawDamage = rawDamageDetails(damageItem);
  const fireDamage = rawDamage
    .filter(detail => String(detail?.type ?? "").toLocaleLowerCase("en") === "fire")
    .reduce((sum, detail) => sum + damageValue(detail), 0);
  if (fireDamage <= 0) return;

  const target = token.actor;
  const immune = traitHas(target, "di", "fire");
  const resistant = traitHas(target, "dr", "fire");
  if (!immune && !resistant) return;

  const bonus = immune ? Math.floor(fireDamage / 2) : Math.ceil(fireDamage / 2);
  if (bonus <= 0) return;

  rawDamage.push({
    type: "midi-none",
    value: bonus,
    damage: bonus,
    active: {},
    properties: new Set(),
    source: "Ярость адского огня",
    multiplier: 1
  });
  recalculateDamageItem(token, damageItem, rawDamage);
  damageItem.details ??= [];
  damageItem.details.push(
    immune
      ? "Ярость адского огня: иммунитет к огню получает половину урона"
      : "Ярость адского огня: сопротивление огню игнорируется"
  );
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

export async function showDarkLuck(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  await chat(
    actor,
    `<p><strong>${actor.name}: Тёмная удача.</strong> Один раз за ход при натуральной 1 на атаке, проверке характеристики или спасброске можно перебросить кубик и использовать второй результат. Ситуационную помощь дьявола подтверждает Мастер.</p>`
  );
  return true;
}

export async function showEmpoweredCharms(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  const count = Math.max(1, devilModifier(actor));
  await chat(
    actor,
    `<p><strong>${actor.name}: Усиленные чары.</strong> Можно перебросить ${count} к. урона заклинания и использовать новые результаты. Характеристика: ${DEVIL_ABILITIES[devilWorshipperAbility(actor)]}.</p>`
  );
  return true;
}

function devilGlaiveEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.DEVIL_GLAIVE_EFFECT));
}

export function validateDevilWorshipperActivityUse(actor, activity, action) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  if (action === "summon-devil-glaive") {
    const uses = itemUses(activityItem(activity));
    if (uses.remaining <= 0) {
      notify(`${actor.name}: гвизарму можно призвать после короткого или продолжительного отдыха.`, "warn");
      return false;
    }
  }
  return true;
}

export async function summonImpFamiliar(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  if (!findFeature(actor, "imp-familiar")) {
    notify("Для призыва нужен «Бесовский фамильяр».", "warn");
    return false;
  }
  return createSummonedCreature(actor, impFamiliarSummon(actor));
}

export async function summonDevilGlaive(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  const feature = findFeature(actor, "devilish-glaive");
  if (!feature) {
    notify("Для призыва нужна особенность «Дьявольская гвизарма».", "warn");
    return false;
  }
  const data = {
    name: "Дьявольская гвизарма",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.DEVIL_GLAIVE_EFFECT]: true
      }
    },
    duration: {
      seconds: 60,
      startTime: game.time?.worldTime ?? 0
    },
    system: { changes: [] }
  };
  const current = devilGlaiveEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: Дьявольская гвизарма призвана на 1 минуту.`);
  return true;
}

async function damageRollToChat(actor, formula, type, flavor) {
  const RollClass = CONFIG.Dice?.DamageRoll ?? Roll;
  const roll = await new RollClass(formula, actor.getRollData(), {
    type,
    flavor
  }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

function signed(number) {
  return number >= 0 ? `+ ${number}` : `- ${Math.abs(number)}`;
}

export async function rollDevilGlaiveDamage(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  if (!isEffectActive(devilGlaiveEffect(actor))) {
    notify("Сначала призовите Дьявольскую гвизарму.", "warn");
    return false;
  }
  const modifier = devilModifier(actor);
  await damageRollToChat(
    actor,
    `2d12 ${signed(modifier)}`,
    "slashing",
    `Дьявольская гвизарма: режущий магический урон (${DEVIL_ABILITIES[devilWorshipperAbility(actor)]})`
  );
  return true;
}

export async function rollDevilGlaiveGrappleDamage(actor) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  if (!isEffectActive(devilGlaiveEffect(actor))) {
    notify("Сначала призовите Дьявольскую гвизарму.", "warn");
    return false;
  }
  await damageRollToChat(actor, "1d12", "slashing", "Дьявольская гвизарма: урон схваченной цели");
  return true;
}

export async function gainDevilSoulAuraTempHp(actor, activity) {
  if (!actor || !devilWorshipperClass(actor)) {
    notify("Эта активность требует класс «Дьяволопоклонник».", "warn");
    return false;
  }
  const amount = Math.max(0, Number(automationData(activity).devilSoulAuraTempHp ?? 0));
  if (!amount) return false;
  const current = Number(actor.system?.attributes?.hp?.temp ?? 0);
  await grantSoulAuraTemporaryHp(actor, amount, activityItem(activity));
  notify(`${actor.name}: Аура опустошённых душ — временные хиты ${Math.max(current, amount)}.`);
  return true;
}
