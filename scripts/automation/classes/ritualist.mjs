import { MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { numberDialog } from "../shared/dialogs.mjs";
import { createSummonedCreature } from "../shared/summons.mjs";

const ritualistSyncs = new Set();

export function ritualistClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "ritualist");
}

export function ritualistLevel(actor) {
  return Number(ritualistClass(actor)?.system?.levels ?? 0);
}

export function ritualistPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 13) failures.push("Телосложение 13");
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 13) failures.push("Мудрость 13");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  return failures;
}

export function validateRitualistPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "ritualist") return true;
  const failures = ritualistPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Ритуалист». Не выполнено: ${failures.join(", ")}. Сюжетный ритуал контроля духа подтверждает Мастер.`, "error");
    return false;
  }
  return true;
}

export function validateRitualistFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.ritualistFeature !== true || options?.isAdvancement) return true;
  const level = ritualistLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Ритуалист».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Ритуалиста.`, "error");
    return false;
  }
  return true;
}

export function ritualistRitualPoints(actor) {
  const level = ritualistLevel(actor);
  if (level >= 5) return 5;
  if (level >= 4) return 4;
  if (level >= 2) return 3;
  if (level >= 1) return 2;
  return 0;
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

export async function syncRitualistResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || ritualistSyncs.has(actor.uuid)) return false;
  if (!ritualistClass(actor)) return false;

  ritualistSyncs.add(actor.uuid);
  try {
    const changed = await syncUses(findFeature(actor, "binding-ritual"), ritualistRitualPoints(actor));
    if (notifyResult && changed) notify(`${actor.name}: ритуальные очки Ритуалиста синхронизированы.`);
    return changed;
  } finally {
    ritualistSyncs.delete(actor.uuid);
  }
}

function bindingRitualResource(actor) {
  const feature = findFeature(actor, "binding-ritual");
  return {
    feature,
    ...itemUses(feature)
  };
}

function fixedRitualistRitualPointCost(activity) {
  const fixed = Number(automationData(activity).ritualistRitualPointCost);
  return Number.isFinite(fixed) && fixed > 0 ? Math.floor(fixed) : null;
}

async function chooseRitualistRitualPointCost(actor, activity, { title = "Ритуал привязки" } = {}) {
  const fixed = fixedRitualistRitualPointCost(activity);
  if (fixed) return fixed;
  const resource = bindingRitualResource(actor);
  const maximum = Math.min(3, resource.remaining);
  if (maximum < 1) return null;
  return numberDialog({
    title,
    label: "Сколько духов призвать / очков потратить",
    min: 1,
    max: maximum,
    defaultValue: 1,
    hint: `Доступно ритуальных очков: ${resource.remaining}. За раз можно потратить максимум 3.`,
    confirmLabel: "Применить",
    confirmIcon: "fa-solid fa-ghost"
  });
}

export function validateRitualistRitualPointUse(actor, activity) {
  const data = automationData(activity);
  const cost = Math.max(1, fixedRitualistRitualPointCost(activity) ?? 1);
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  if (cost > 3) {
    notify("Ритуал привязки может призвать максимум 3 духов за раз.", "warn");
    return false;
  }
  const resource = bindingRitualResource(actor);
  if (!resource.feature) {
    notify("Для расхода ритуальных очков требуется особенность «Ритуал привязки».", "warn");
    return false;
  }
  if (resource.remaining < cost) {
    notify(`${actor.name}: недостаточно ритуальных очков, требуется ${cost}, доступно ${resource.remaining}.`, "warn");
    return false;
  }
  return true;
}

async function spendRitualistRitualPoints(actor, cost) {
  const resource = bindingRitualResource(actor);
  await resource.feature.update({
    "system.uses.max": String(resource.maximum),
    "system.uses.spent": resource.spent + cost
  });
  notify(`${actor.name}: потрачено ${cost} ритуальных очков, осталось ${Math.max(0, resource.remaining - cost)}.`);
}

export async function useRitualistRitualPoints(actor, activity) {
  if (!validateRitualistRitualPointUse(actor, activity)) return false;
  const cost = await chooseRitualistRitualPointCost(actor, activity);
  if (!cost || !validateRitualistRitualPointUse(actor, {
    ...activity,
    flags: {
      ...(activity.flags ?? {}),
      [MODULE_ID]: {
        ...automationData(activity),
        ritualistRitualPointCost: cost
      }
    }
  })) return false;
  await spendRitualistRitualPoints(actor, cost);
  return true;
}

export function ritualistSpiritSaveDC(actor) {
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + abilityMod(actor, "wis");
}

async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

export async function showRitualistSpiritDC(actor) {
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  await chat(actor, `<p><strong>${actor.name}: СЛ способностей духа.</strong> ${ritualistSpiritSaveDC(actor)} = 8 + бонус мастерства + модификатор Мудрости.</p>`);
  return true;
}

function ritualistSpiritSummon(actor, index, total) {
  const suffix = total > 1 ? ` ${index + 1}` : "";
  return {
    kind: "ritualist-spirit",
    unique: false,
    name: `${actor.name}: Призванный дух${suffix}`,
    img: "icons/magic/death/undead-ghost-scream-teal.webp",
    source: "binding-ritual",
    size: "med",
    type: "undead",
    ac: 11,
    hp: 28,
    hpFormula: "5d8 + 5",
    abilities: { str: 7, dex: 13, con: 10, int: 10, wis: 12, cha: 15 },
    movement: { walk: 0, fly: 30, hover: true },
    senses: { darkvision: 60 },
    dr: { value: ["thunder", "acid", "fire", "lightning", "bludgeoning", "piercing", "slashing"], custom: "дробящий, колющий и рубящий урон только от немагических атак" },
    di: { value: ["necrotic", "cold", "poison"] },
    ci: { value: ["grappled", "frightened", "exhaustion", "petrified", "restrained", "poisoned", "charmed", "paralyzed", "prone"] },
    description: `
      <p><strong>Призванный дух Ритуалиста.</strong> Существует до 10 минут, пока Ритуалист концентрируется, или пока его хиты не упадут до 0.</p>
      <ul>
        <li><strong>КД:</strong> 11; <strong>хиты:</strong> 28 (5к8 + 5); <strong>скорость:</strong> полёт 30 фт. (парит).</li>
        <li><strong>Эфирное зрение:</strong> дух видит на 60 фт. на Эфирный План с Материального и наоборот.</li>
        <li><strong>Бестелесное перемещение:</strong> может проходить сквозь существ и предметы как через труднопроходимую местность; получает 1к10 урона силовым полем, если заканчивает ход внутри предмета.</li>
        <li><strong>СЛ способностей духа:</strong> ${ritualistSpiritSaveDC(actor)}.</li>
      </ul>
      <p>Вариант духа выберите по карточке «Ритуал привязки». Броски способностей духа есть отдельными активностями на этой карточке.</p>
    `,
    features: [{
      name: "Варианты духов",
      description: "<p>Выберите вариант: Дух агонии, Кровавой песни, Разрушения, Великих возможностей, Жизни, Защиты или Скорбной песни. Автоматические броски находятся на карточке Ритуалиста.</p>"
    }],
    note: "Если концентрация Ритуалиста нарушена, дух не исчезает автоматически: отметьте потерю контроля вручную."
  };
}

export async function summonRitualistSpirits(actor, activity) {
  if (!validateRitualistRitualPointUse(actor, activity)) return false;
  const cost = await chooseRitualistRitualPointCost(actor, activity, { title: "Призвать духов Ритуалиста" });
  if (!cost) return false;
  const resource = bindingRitualResource(actor);
  if (cost > resource.remaining || cost > 3) {
    notify(`${actor.name}: недостаточно ритуальных очков или превышен максимум 3 духов за раз.`, "warn");
    return false;
  }
  const created = [];
  for (let index = 0; index < cost; index += 1) {
    const result = await createSummonedCreature(actor, ritualistSpiritSummon(actor, index, cost));
    if (!result) return false;
    created.push(result);
  }
  await spendRitualistRitualPoints(actor, cost);
  return created.length > 0;
}

export async function rollRitualistSpiritAgony(actor) {
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  const level = Math.max(1, ritualistLevel(actor));
  await rollToChat(actor, `${level}d6`, `Дух агонии: психический урон при провале спасброска Мудрости. СЛ ${ritualistSpiritSaveDC(actor)}.`);
  return true;
}

export async function rollRitualistSpiritLife(actor) {
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  const level = Math.max(1, ritualistLevel(actor));
  await rollToChat(actor, `${level}d6`, "Дух жизни: лечение цели. Дух перед этим получает 14 урона силовым полем.");
  return true;
}

export async function rollRitualistSpiritProtection(actor) {
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  await rollToChat(actor, "1d10", "Дух защиты: снижение урона союзнику. Дух получает столько же урона силовым полем.");
  return true;
}

export async function rollRitualistSpiritSorrow(actor) {
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  await rollToChat(actor, "1d4", `Дух скорбной песни: урон силовым полем при провале спасброска Телосложения. СЛ ${ritualistSpiritSaveDC(actor)}. Длительность слепоты/глухоты: ${Math.max(1, abilityMod(actor, "wis"))} раунд.`);
  return true;
}

export async function rollRitualistSpiritDestructionDie(actor) {
  if (!actor || !ritualistClass(actor)) {
    notify("Эта активность требует класс «Ритуалист».", "warn");
    return false;
  }
  await rollToChat(actor, "1d6", `Дух разрушения: урон за 1 раунд жизни духа, максимум 8к6. Спасбросок Мудрости, СЛ ${ritualistSpiritSaveDC(actor)}, при успехе половина.`);
  return true;
}

export async function showRitualistSpiritChannel(actor) {
  if (!actor || !findFeature(actor, "spirit-channel")) {
    notify("Для этой активности требуется особенность «Канал духов».", "warn");
    return false;
  }
  await chat(actor, `
    <p><strong>${actor.name}: Канал духов.</strong> При изгнании духа создайте пул очков, равный текущим хитам духа.</p>
    <ul>
      <li><strong>Дух к плоти:</strong> 1 очко = 1 хит лечения, максимум до половины максимума хитов цели; не действует на нежить и конструктов.</li>
      <li><strong>Духовная передача:</strong> 1 очко = 1 хит лечения духа.</li>
      <li><strong>Призрачный удар:</strong> каждые 7 очков = +1к6 урона к атаке или заклинанию.</li>
      <li><strong>Общение:</strong> 28 очков = 1 ритуальное очко; излишки сверх максимума теряются после отдыха.</li>
    </ul>
  `);
  return true;
}
