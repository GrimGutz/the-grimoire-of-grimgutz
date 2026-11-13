import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  activityItem,
  automationData,
  findFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod, clamp } from "../shared/dnd5e.mjs";
import { selectFormDialog, slotLevelDialog } from "../shared/dialogs.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";

const oracleSyncs = new Set();
const oraclePassiveSyncs = new Set();

export const ORACLE_ACTIONS = new Set([
  "sync-oracle-resources",
  "oracle-fate-miss",
  "oracle-mysterious-guidance",
  "oracle-balancing-ritual",
  "oracle-free-scrying",
  "oracle-read-threads",
  "oracle-remove-dissonance-slot",
  "oracle-restore-slot-dissonance",
  "oracle-danger",
  "oracle-astral-projection",
  "oracle-exchange-fates",
  "oracle-fate-scissors"
]);

const INFLUENCE_ACTIONS = new Set([
  "oracle-fate-miss",
  "oracle-mysterious-guidance",
  "oracle-read-threads",
  "oracle-danger",
  "oracle-exchange-fates",
  "oracle-fate-scissors"
]);

const ACTION_LEVELS = {
  "sync-oracle-resources": 1,
  "oracle-fate-miss": 1,
  "oracle-mysterious-guidance": 1,
  "oracle-balancing-ritual": 1,
  "oracle-free-scrying": 2,
  "oracle-read-threads": 2,
  "oracle-remove-dissonance-slot": 3,
  "oracle-restore-slot-dissonance": 3,
  "oracle-danger": 4,
  "oracle-astral-projection": 5,
  "oracle-exchange-fates": 5,
  "oracle-fate-scissors": 5
};

function change(key, type, value, phase = "initial", priority = 20) {
  return { key, type, value: String(value), phase, priority };
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula, actor.getRollData(), { flavor }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

function classLevel(actor, identifier) {
  return Number(
    actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === identifier)?.system?.levels ?? 0
  );
}

export function oracleClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "oracle");
}

export function oracleLevel(actor) {
  return Number(oracleClass(actor)?.system?.levels ?? 0);
}

export function oracleMaxDissonance(actor) {
  return [0, 2, 3, 4, 5, 6][clamp(oracleLevel(actor), 0, 5)] ?? 0;
}

export function oracleFateBalance(actor) {
  return [0, 4, 4, 3, 3, 2][clamp(oracleLevel(actor), 0, 5)] ?? 0;
}

export function oracleDissonance(actor) {
  const stored = Number(actor?.getFlag?.(MODULE_ID, FLAGS.ORACLE_DISSONANCE) ?? 0);
  return clamp(Number.isFinite(stored) ? stored : 0, 0, oracleMaxDissonance(actor));
}

function oracleSaveDC(actor) {
  return 8 + Number(actor?.system?.attributes?.prof ?? 0) + abilityMod(actor, "wis");
}

function hasHighDivinationSpell(actor) {
  return (
    actor?.items?.some(item => {
      if (item.type !== "spell") return false;
      if (Number(item.system?.level ?? 0) < 6) return false;
      const school = String(item.system?.school?.value ?? item.system?.school ?? "").toLowerCase();
      const name = String(item.name ?? "").toLowerCase();
      const description = String(item.system?.description?.value ?? "").toLowerCase();
      return (
        school === "div" ||
        school.includes("divination") ||
        school.includes("прориц") ||
        name.includes("прориц") ||
        description.includes("школы прорицания") ||
        description.includes("divination")
      );
    }) ?? false
  );
}

export function oraclePrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.wis?.value ?? 0) < 18) failures.push("Мудрость 18");
  if (Number(actor?.system?.abilities?.int?.value ?? 0) < 18) failures.push("Интеллект 18");
  if (Number(actor?.system?.details?.level ?? 0) < 12) failures.push("12-й уровень персонажа");
  if (!hasHighDivinationSpell(actor)) failures.push("заклинание Прорицания 6-го круга или выше");
  return failures;
}

export function validateOraclePrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "oracle") return true;
  const failures = oraclePrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Оракул». Не выполнено: ${failures.join(", ")}. Значимое пророчество подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateOracleFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.oracleFeature !== true || options?.isAdvancement) return true;
  const level = oracleLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Оракул».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Оракула.`, "error");
    return false;
  }
  return true;
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(1, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (String(feature.system?.uses?.max ?? "") !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

function oracleDissonanceEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.ORACLE_DISSONANCE_EFFECT));
}

function dissonanceEffectData(actor, dissonance) {
  const feature = findFeature(actor, "influence-fates");
  const penalty = -Math.abs(dissonance);
  return {
    name: "Оракул: Диссонанс",
    img: feature?.img ?? "icons/magic/control/debuff-energy-hold-levitate-blue-yellow.webp",
    type: "base",
    description: `Штраф ${penalty} к проверкам, спасброскам и броскам атаки от текущего Диссонанса.`,
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.ORACLE_DISSONANCE_EFFECT]: true
      }
    },
    duration: {
      value: null,
      units: "seconds",
      expiry: null,
      expired: false
    },
    system: {
      changes: [
        change("system.bonuses.abilities.check", "add", penalty),
        change("system.bonuses.abilities.save", "add", penalty),
        change("system.bonuses.mwak.attack", "add", penalty),
        change("system.bonuses.rwak.attack", "add", penalty),
        change("system.bonuses.msak.attack", "add", penalty),
        change("system.bonuses.rsak.attack", "add", penalty)
      ]
    }
  };
}

async function syncOracleDissonanceEffect(actor) {
  const current = oracleDissonanceEffect(actor);
  const dissonance = oracleDissonance(actor);
  if (!oracleClass(actor) || dissonance <= 0) {
    if (current) await actor.deleteEmbeddedDocuments("ActiveEffect", [current.id]);
    return false;
  }
  const data = dissonanceEffectData(actor, dissonance);
  if (current) {
    await current.update(data);
  } else {
    await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  }
  return true;
}

async function setOracleDissonance(actor, value, { notifyResult = true } = {}) {
  const maximum = oracleMaxDissonance(actor);
  const next = clamp(Number(value ?? 0), 0, maximum);
  await actor.setFlag(MODULE_ID, FLAGS.ORACLE_DISSONANCE, next);
  await syncOracleDissonanceEffect(actor);
  if (notifyResult) {
    notify(`${actor.name}: Диссонанс ${next}/${maximum}.`);
    if (maximum && next >= maximum) {
      await chat(
        actor,
        `<p><strong>${actor.name}: Диссонанс достиг максимума.</strong> Вы не можете использовать «Воздействие на судьбы», пока не уменьшите Диссонанс. Получите уровень истощения; он снимается только уменьшением Диссонанса.</p>`
      );
    }
  }
  return next;
}

function oraclePassiveDefinitions(actor) {
  const definitions = [];
  if (oracleLevel(actor) < 5) return definitions;
  const feature = findFeature(actor, "sense-fate");
  if (!feature) return definitions;
  definitions.push(
    flaggedPassiveEffectData(MODULE_ID, FLAGS.ORACLE_PASSIVE, {
      key: "sense-fate-truesight",
      feature,
      name: "Чувство судьбы: истинное зрение",
      img: feature.img,
      changes: [change("system.attributes.senses.ranges.truesight", "upgrade", "30", "final")]
    })
  );
  return definitions;
}

export async function syncOraclePassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(
    actor,
    oraclePassiveSyncs,
    MODULE_ID,
    FLAGS.ORACLE_PASSIVE,
    oraclePassiveDefinitions
  );
}

export async function syncOracleResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || oracleSyncs.has(actor.uuid)) return false;
  oracleSyncs.add(actor.uuid);
  try {
    if (!oracleClass(actor)) {
      await syncOracleDissonanceEffect(actor);
      await syncOraclePassiveEffects(actor);
      return false;
    }
    const changed = await syncUses(findFeature(actor, "influence-fates"), Math.max(1, abilityMod(actor, "wis")));
    const stored = Number(actor.getFlag(MODULE_ID, FLAGS.ORACLE_DISSONANCE) ?? 0);
    const maximum = oracleMaxDissonance(actor);
    if (Number.isFinite(stored) && stored > maximum) await actor.setFlag(MODULE_ID, FLAGS.ORACLE_DISSONANCE, maximum);
    await syncOracleDissonanceEffect(actor);
    await syncOraclePassiveEffects(actor);
    if (notifyResult && changed) notify(`${actor.name}: ресурс «Воздействие на судьбы» синхронизирован.`);
    return changed;
  } finally {
    oracleSyncs.delete(actor.uuid);
  }
}

function activityDissonanceCost(activity) {
  return Number(automationData(activity).oracleDissonanceCost ?? 0);
}

async function spendInfluenceUse(actor) {
  const feature = findFeature(actor, "influence-fates");
  const uses = itemUses(feature);
  if (!feature || uses.remaining <= 0) {
    notify(`${actor.name}: нет доступных использований «Воздействия на судьбы».`, "warn");
    return false;
  }
  await feature.update({ "system.uses.spent": uses.spent + 1 });
  return true;
}

async function addActivityDissonance(actor, activity) {
  const cost = activityDissonanceCost(activity);
  if (cost <= 0) return oracleDissonance(actor);
  return setOracleDissonance(actor, oracleDissonance(actor) + cost);
}

async function useInfluence(actor, activity, content) {
  if (!(await spendInfluenceUse(actor))) return false;
  await addActivityDissonance(actor, activity);
  await chat(actor, content);
  return true;
}

function influenceBalanceText(actor, type) {
  const balance = oracleFateBalance(actor);
  if (type === "miss") return `Баланс судьбы: цель получает бонус <strong>+${balance}</strong> к этому броску.`;
  if (type === "guidance") return `Баланс судьбы: цель получает штраф <strong>−${balance}</strong> к этому броску.`;
  return "";
}

async function handleFateMiss(actor, activity) {
  const cost = activityDissonanceCost(activity);
  const text =
    cost > 0
      ? `Вы накладываете помеху на проверку, спасбросок или атаку цели и принимаете <strong>${cost}</strong> Диссонанс вместо Баланса судьбы.`
      : `Вы накладываете помеху на проверку, спасбросок или атаку цели. ${influenceBalanceText(actor, "miss")}`;
  return useInfluence(actor, activity, `<p><strong>${actor.name}: Промах.</strong> ${text}</p>`);
}

async function handleMysteriousGuidance(actor, activity) {
  const cost = activityDissonanceCost(activity);
  const text =
    cost > 0
      ? `Вы даёте цели преимущество и принимаете <strong>${cost}</strong> Диссонанс вместо Баланса судьбы.`
      : `Вы даёте цели преимущество. ${influenceBalanceText(actor, "guidance")}`;
  return useInfluence(actor, activity, `<p><strong>${actor.name}: Загадочное руководство.</strong> ${text}</p>`);
}

async function chooseBalancingRitual(actor) {
  const current = oracleDissonance(actor);
  return selectFormDialog({
    title: "Балансирующий ритуал Оракула",
    width: 520,
    fields: [
      {
        name: "points",
        label: "Сколько Диссонанса снять",
        choices: Array.from({ length: current }, (_entry, index) => {
          const value = index + 1;
          return [value, String(value)];
        })
      },
      {
        name: "cost",
        label: "Цена ритуала",
        choices: [
          ["doomed-thread", "2к10 психического урона за пункт"],
          ["hp-maximum", "−3 текущих и максимальных хита за пункт до длительного отдыха"],
          ["sensory", "слепота или глухота на 2 часа за пункт"],
          ["vulnerability", "уязвимость к дробящему/колющему/рубящему на 2 часа за пункт"]
        ]
      }
    ]
  });
}

async function handleBalancingRitual(actor) {
  const current = oracleDissonance(actor);
  if (current <= 0) {
    notify(`${actor.name}: нет Диссонанса для балансирующего ритуала.`, "warn");
    return false;
  }
  const selected = await chooseBalancingRitual(actor);
  if (!selected?.points) return false;
  const points = clamp(selected.points, 1, current);
  await setOracleDissonance(actor, current - points);
  if (selected.cost === "doomed-thread") {
    await rollToChat(
      actor,
      `${points * 2}d10`,
      `Балансирующий ритуал: психический урон за снятие ${points} Диссонанса`
    );
  }
  const suffix =
    selected.cost === "hp-maximum"
      ? `Потеряйте <strong>${points * 3}</strong> текущих и максимальных хитов до длительного отдыха.`
      : selected.cost === "sensory"
        ? `Получите слепоту или глухоту на <strong>${points * 2}</strong> часа.`
        : selected.cost === "vulnerability"
          ? `Получите уязвимость к дробящему, колющему или рубящему урону на <strong>${points * 2}</strong> часа.`
          : `Получите психический урон по броску выше.`;
  await chat(
    actor,
    `<p><strong>${actor.name}: Балансирующий ритуал.</strong> Снято ${points} Диссонанса. ${suffix}</p>`
  );
  return true;
}

async function handleFreeScrying(actor) {
  await chat(
    actor,
    `<p><strong>${actor.name}: Наблюдение.</strong> Вы используете <em>Наблюдение</em> без траты ячейки заклинания. Компоненты не требуются.</p>`
  );
  return true;
}

async function handleReadThreads(actor, activity) {
  if (!(await spendInfluenceUse(actor))) return false;
  await rollToChat(actor, "4d8", "Читать нити: Баланс судьбы, психический урон");
  await chat(
    actor,
    `<p><strong>${actor.name}: Читать нити.</strong> Для <em>Наблюдения</em> спасбросок Мудрости цели увеличивается на уровень Оракула (${oracleLevel(actor)}). Для другого Прорицания шанс провала уменьшается на 25%. Если заклинание всё же провалилось, вместо 4к8 примените 8к8 психического урона.</p>`
  );
  return true;
}

async function handleRemoveDissonanceBySlot(actor) {
  const slot = await slotLevelDialog({
    title: "Переплетение связей: снять Диссонанс",
    minimum: 3
  });
  if (!slot) return false;
  const current = oracleDissonance(actor);
  const removed = Math.min(current, Math.floor(slot / 3));
  await setOracleDissonance(actor, current - removed);
  await chat(
    actor,
    `<p><strong>${actor.name}: Переплетение связей.</strong> Потратьте ячейку ${slot}-го круга вручную. Снято ${removed} Диссонанса.</p>`
  );
  return true;
}

async function handleRestoreSlotByDissonance(actor) {
  const slot = await slotLevelDialog({
    title: "Переплетение связей: восстановить ячейку",
    minimum: 1
  });
  if (!slot) return false;
  const gained = slot * 2;
  const before = oracleDissonance(actor);
  const after = await setOracleDissonance(actor, before + gained);
  const maxed = after >= oracleMaxDissonance(actor);
  await chat(
    actor,
    `<p><strong>${actor.name}: Переплетение связей.</strong> Восстановите ячейку ${slot}-го круга вручную и получите ${gained} Диссонанса. ${maxed ? "Так как Диссонанс достиг максимума, совершите спасбросок Мудрости СЛ 22; при провале вы ошеломлены до начала следующего хода." : ""}</p>`
  );
  return true;
}

async function handleDanger(actor, activity) {
  if (!(await spendInfluenceUse(actor))) return false;
  const balance = oracleFateBalance(actor);
  await rollToChat(actor, `${balance}d6`, "Опасность: Баланс судьбы, дополнительный исходный урон");
  await chat(
    actor,
    `<p><strong>${actor.name}: Опасность.</strong> Получите преимущество на спасбросок Ловкости против ловушки, заклинания или эффекта, если вы не ослеплены, не ошеломлены и не недееспособны. Баланс судьбы увеличивает исходный урон эффекта на ${balance}к6; бросок сделан выше.</p>`
  );
  return true;
}

async function handleAstralProjection(actor) {
  await chat(
    actor,
    `<p><strong>${actor.name}: Проекция в астрал.</strong> Вы используете <em>Проекцию в астрал</em> без траты ячейки и компонентов.</p>`
  );
  return true;
}

async function handleExchangeFates(actor, activity) {
  const cost = activityDissonanceCost(activity);
  const text =
    cost > 0
      ? `Вы отдаёте все текущие хиты союзнику, падаете до 0 хитов и принимаете <strong>${cost}</strong> Диссонанс вместо Баланса судьбы. Избыток хитов союзник получает как временные хиты.`
      : `Вы отдаёте все текущие хиты союзнику, падаете до 0 хитов, а избыток становится временными хитами союзника. Баланс судьбы: автоматически провалите один спасбросок от смерти и получите помеху на следующие спасброски от смерти в количестве ${oracleFateBalance(actor)}.`;
  return useInfluence(actor, activity, `<p><strong>${actor.name}: Обменяться судьбами.</strong> ${text}</p>`);
}

async function handleFateScissors(actor, activity) {
  if (!(await spendInfluenceUse(actor))) return false;
  await addActivityDissonance(actor, activity);
  const roll = await rollToChat(actor, "10d10", "Ножницы судьбы: психический урон");
  const cost = activityDissonanceCost(activity);
  const balance =
    cost > 0
      ? "Баланс судьбы отменён ценой 3 Диссонанса."
      : "Баланс судьбы: ваш максимум хитов уменьшается на половину нанесённого урона до длительного отдыха. Если цель погибла, максимум уменьшается на количество хитов цели перед смертью.";
  await chat(
    actor,
    `<p><strong>${actor.name}: Ножницы судьбы.</strong> Цель совершает спасбросок Мудрости против СЛ <strong>${oracleSaveDC(actor)}</strong> или получает ${roll.total} психического урона. Если урон снижает хиты цели до 0, она немедленно умирает. ${balance}</p>`
  );
  return true;
}

export async function handleOracleAction(actor, activity, action) {
  switch (action) {
    case "sync-oracle-resources":
      return syncOracleResources(actor, { notifyResult: true });
    case "oracle-fate-miss":
      return handleFateMiss(actor, activity);
    case "oracle-mysterious-guidance":
      return handleMysteriousGuidance(actor, activity);
    case "oracle-balancing-ritual":
      return handleBalancingRitual(actor);
    case "oracle-free-scrying":
      return handleFreeScrying(actor);
    case "oracle-read-threads":
      return handleReadThreads(actor, activity);
    case "oracle-remove-dissonance-slot":
      return handleRemoveDissonanceBySlot(actor);
    case "oracle-restore-slot-dissonance":
      return handleRestoreSlotByDissonance(actor);
    case "oracle-danger":
      return handleDanger(actor, activity);
    case "oracle-astral-projection":
      return handleAstralProjection(actor);
    case "oracle-exchange-fates":
      return handleExchangeFates(actor, activity);
    case "oracle-fate-scissors":
      return handleFateScissors(actor, activity);
    default:
      return false;
  }
}

export function isOracleAction(action) {
  return ORACLE_ACTIONS.has(action);
}

export function validateOracleActivityUse(actor, activity, action) {
  if (!actor || !oracleClass(actor)) {
    notify("Эта активность требует класс «Оракул».", "warn");
    return false;
  }
  const level = oracleLevel(actor);
  const requiredLevel = ACTION_LEVELS[action] ?? 0;
  if (requiredLevel && level < requiredLevel) {
    notify(`Эта активность требует ${requiredLevel}-й уровень Оракула.`, "warn");
    return false;
  }

  if (INFLUENCE_ACTIONS.has(action)) {
    const maximum = oracleMaxDissonance(actor);
    if (maximum && oracleDissonance(actor) >= maximum) {
      notify(`${actor.name}: Диссонанс на максимуме, «Воздействие на судьбы» недоступно.`, "warn");
      return false;
    }
    const uses = itemUses(findFeature(actor, "influence-fates"));
    if (uses.remaining <= 0) {
      notify(`${actor.name}: нет доступных использований «Воздействия на судьбы».`, "warn");
      return false;
    }
  }

  if (action === "oracle-balancing-ritual" && oracleDissonance(actor) <= 0) {
    notify(`${actor.name}: нет Диссонанса для балансирующего ритуала.`, "warn");
    return false;
  }

  if (action === "oracle-remove-dissonance-slot" && oracleDissonance(actor) <= 0) {
    notify(`${actor.name}: нет Диссонанса для снятия.`, "warn");
    return false;
  }

  if (action === "oracle-restore-slot-dissonance" && oracleDissonance(actor) >= oracleMaxDissonance(actor)) {
    notify(`${actor.name}: Диссонанс уже на максимуме.`, "warn");
    return false;
  }

  if (
    [
      "oracle-free-scrying",
      "oracle-remove-dissonance-slot",
      "oracle-restore-slot-dissonance",
      "oracle-astral-projection"
    ].includes(action)
  ) {
    const uses = itemUses(activityItem(activity));
    if (uses.maximum > 0 && uses.remaining <= 0) {
      notify(`${actor.name}: нет доступных использований этой особенности.`, "warn");
      return false;
    }
  }

  return true;
}
