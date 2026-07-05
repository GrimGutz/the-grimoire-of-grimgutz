import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  activityItem,
  automationData,
  findFeature,
  hasFeature,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { abilityMod, clamp } from "../shared/dnd5e.mjs";

const BLOOD_MAGIC_USES = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 };
const KNOWN_BLOOD_SPELLS = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 };
const BLOOD_SPELL_SLOTS = {
  1: { 1: 2, 2: 3, 3: 4, 4: 4, 5: 4 },
  2: { 1: 0, 2: 0, 3: 2, 4: 3, 5: 3 },
  3: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 }
};

const SANGUINIST_ACTIONS = new Set([
  "sync-sanguinist-resources",
  "gain-sanguinist-blood-point",
  "gain-sanguinist-blood-points-others",
  "spend-sanguinist-blood-points",
  "use-hematurgy",
  "show-sanguinist-spellcasting",
  "cast-blood-reading",
  "mark-sanguinist-blood-spell",
  "sanguine-power-hit-die",
  "sanguine-power-blood-point",
  "show-vital-restoration",
  "show-blood-compatibility",
  "use-my-own-blood-recovery",
  "show-ritual-sacrifice",
  "use-arterial-puppetry",
  "use-blood-backlash",
  "use-bloodletting",
  "use-contusion",
  "use-crimson-fury",
  "use-sanguine-storm",
  "use-transfusion",
  "use-vampirism"
]);

const ACTION_LEVELS = {
  "sync-sanguinist-resources": 1,
  "gain-sanguinist-blood-point": 1,
  "gain-sanguinist-blood-points-others": 3,
  "spend-sanguinist-blood-points": 1,
  "use-hematurgy": 1,
  "show-sanguinist-spellcasting": 1,
  "cast-blood-reading": 1,
  "mark-sanguinist-blood-spell": 1,
  "sanguine-power-hit-die": 2,
  "sanguine-power-blood-point": 2,
  "show-vital-restoration": 2,
  "show-blood-compatibility": 3,
  "use-my-own-blood-recovery": 3,
  "show-ritual-sacrifice": 4,
  "use-arterial-puppetry": 5,
  "use-blood-backlash": 5,
  "use-bloodletting": 5,
  "use-contusion": 5,
  "use-crimson-fury": 5,
  "use-sanguine-storm": 5,
  "use-transfusion": 5,
  "use-vampirism": 5
};

const sanguinistSyncs = new Set();

export function sanguinistClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "sanguinist");
}

export function sanguinistLevel(actor) {
  return Number(sanguinistClass(actor)?.system?.levels ?? 0);
}

function totalCharacterLevel(actor) {
  return actor?.items
    ?.filter(item => item.type === "class")
    .reduce((sum, item) => sum + Number(item.system?.levels ?? 0), 0) ?? 0;
}

function spellSlotMax(actor, level) {
  const slot = actor?.system?.spells?.[`spell${level}`];
  return Math.max(Number(slot?.max ?? 0), Number(slot?.override ?? 0), Number(slot?.value ?? 0));
}

function pactSlotExists(actor) {
  const pact = actor?.system?.spells?.pact;
  return Number(pact?.level ?? 0) > 0 || Math.max(Number(pact?.max ?? 0), Number(pact?.value ?? 0)) > 0;
}

function hasSpellSlots(actor) {
  return pactSlotExists(actor) || [1, 2, 3, 4, 5, 6, 7, 8, 9].some(level => spellSlotMax(actor, level) > 0);
}

function hasMentalAbility(actor) {
  return ["int", "wis", "cha"].some(ability => Number(actor?.system?.abilities?.[ability]?.value ?? 0) >= 15);
}

function itemSearchText(item) {
  return [
    item?.name,
    item?.system?.identifier,
    item?.system?.description?.value
  ].filter(Boolean).join(" ").toLocaleLowerCase("en");
}

function hasBloodMagicPrerequisite(actor) {
  return actor?.items?.some(item => {
    const identifier = itemIdentifier(item);
    if (["blood-mage", "hematurgy", "blood-rites", "pact-of-the-blood"].includes(identifier)) return true;
    const text = itemSearchText(item);
    return text.includes("hematurgy")
      || text.includes("blood rites")
      || text.includes("pact of the blood")
      || text.includes("blood mage")
      || text.includes("гематург")
      || text.includes("кровав");
  }) ?? false;
}

export function sanguinistPrerequisiteFailures(actor) {
  const failures = [];
  if (!hasMentalAbility(actor)) failures.push("Интеллект, Мудрость или Харизма 15");
  if (totalCharacterLevel(actor) < 11) failures.push("11-й уровень персонажа");
  if (!hasSpellSlots(actor)) failures.push("Накладывание заклинаний или Договор магии с ячейками");
  if (!hasBloodMagicPrerequisite(actor)) failures.push("Hematurgy, Blood Rites, Pact of the Blood или черта Blood Mage");
  return failures;
}

export function validateSanguinistPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "sanguinist") return true;
  const failures = sanguinistPrerequisiteFailures(actor);
  if (failures.length) {
    notify(`Нельзя добавить класс «Сангвинист». Не выполнено: ${failures.join(", ")}.`, "error");
    return false;
  }
  return true;
}

export function validateSanguinistFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.sanguinistFeature !== true || options?.isAdvancement) return true;
  const level = sanguinistLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Сангвинист».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Сангвиниста.`, "error");
    return false;
  }
  return true;
}

function maxBloodMagicUses(actor) {
  return BLOOD_MAGIC_USES[clamp(sanguinistLevel(actor), 0, 5)] ?? 0;
}

function bloodMagicFeature(actor) {
  return findFeature(actor, "sanguinist-blood-magic");
}

export function sanguinistBloodPoints(actor) {
  return Math.max(0, Number(actor?.getFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_POINTS) ?? 0));
}

async function setSanguinistBloodPoints(actor, value) {
  const next = Math.max(0, Number(value) || 0);
  await actor.setFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_POINTS, next);
  return next;
}

function proficiency(actor) {
  return Number(actor?.system?.attributes?.prof ?? actor?.system?.prof ?? 0);
}

function sanguinistAbility(actor) {
  return ["int", "wis", "cha"].reduce((best, ability) => {
    const value = Number(actor?.system?.abilities?.[ability]?.value ?? 0);
    const bestValue = Number(actor?.system?.abilities?.[best]?.value ?? 0);
    return value > bestValue ? ability : best;
  }, "cha");
}

function sanguinistSpellModifier(actor) {
  return abilityMod(actor, sanguinistAbility(actor));
}

function sanguinistSpellDC(actor) {
  return 8 + proficiency(actor) + sanguinistSpellModifier(actor);
}

function sanguinistSpellAttack(actor) {
  return proficiency(actor) + sanguinistSpellModifier(actor);
}

async function chat(actor, content) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

function signed(value) {
  return value >= 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
}

async function promptNumber({
  title,
  label,
  min = 1,
  max = 1,
  defaultValue = min
}) {
  const safeMin = Math.max(0, Math.floor(Number(min) || 0));
  const safeMax = Math.max(safeMin, Math.floor(Number(max) || safeMin));
  const value = clamp(Math.floor(Number(defaultValue) || safeMin), safeMin, safeMax);
  const options = Array.from({ length: safeMax - safeMin + 1 }, (_, index) => {
    const option = safeMin + index;
    return `<option value="${option}"${option === value ? " selected" : ""}>${option}</option>`;
  }).join("");
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title },
    position: { width: 420 },
    content: `
      <div class="form-group">
        <label>${foundry.utils.escapeHTML(label)}</label>
        <div class="form-fields"><select name="value">${options}</select></div>
      </div>
    `,
    buttons: [
      {
        action: "choose",
        label: "Выбрать",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, _button, dialog) => Number(dialog.element.querySelector('select[name="value"]')?.value ?? 0)
      },
      {
        action: "cancel",
        label: "Отмена",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  });
  if (!Number.isFinite(selected)) return null;
  return clamp(selected, safeMin, safeMax);
}

async function rollToChat(actor, formula, flavor) {
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor
  });
  return roll;
}

async function applyDirectDamage(actor, amount) {
  const hp = actor?.system?.attributes?.hp ?? {};
  const current = Math.max(0, Number(hp.value ?? 0));
  await actor.update({ "system.attributes.hp.value": Math.max(0, current - Math.max(0, amount)) });
}

async function healActor(actor, amount) {
  const hp = actor?.system?.attributes?.hp ?? {};
  const current = Math.max(0, Number(hp.value ?? 0));
  const maximum = Math.max(current, Number(hp.max ?? 0) + Number(hp.tempmax ?? 0));
  await actor.update({ "system.attributes.hp.value": Math.min(maximum, current + Math.max(0, amount)) });
}

async function selfBloodDamage(actor, formula, flavor) {
  const useLower = hasFeature(actor, "my-own-blood");
  const first = await new Roll(formula, actor.getRollData()).evaluate();
  let total = Math.max(0, Number(first.total ?? 0));
  let detail = `${first.total}`;
  if (useLower) {
    const second = await new Roll(formula, actor.getRollData()).evaluate();
    total = Math.min(total, Math.max(0, Number(second.total ?? 0)));
    detail = `${first.total} и ${second.total}; выбран меньший результат ${total}`;
  }
  await applyDirectDamage(actor, total);
  await chat(actor, `<p><strong>${actor.name}: ${flavor}.</strong> Самоповреждение <strong>${total}</strong> некротическим уроном (${formula}; ${detail}). Урон игнорирует сопротивление/иммунитет и не вызывает спасбросков концентрации.</p>`);
  return total;
}

export async function syncSanguinistResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || sanguinistSyncs.has(actor.uuid)) return false;
  sanguinistSyncs.add(actor.uuid);
  try {
    const feature = bloodMagicFeature(actor);
    const maximum = maxBloodMagicUses(actor);
    if (!feature || !maximum) {
      if (notifyResult) notify(`${actor?.name ?? "Актёр"}: для синхронизации нужен класс и особенность «Кровавая магия» Сангвиниста.`, "warn");
      return false;
    }
    const updates = {};
    let changed = false;
    if (String(feature.system?.uses?.max ?? "") !== String(maximum)) {
      updates["system.uses.max"] = String(maximum);
      changed = true;
    }
    if (!feature.system?.uses?.recovery?.some(entry => entry.period === "lr")) {
      updates["system.uses.recovery"] = [{ period: "lr", type: "recoverAll" }];
      changed = true;
    }
    const spent = Number(feature.system?.uses?.spent ?? 0);
    if (spent > maximum) {
      updates["system.uses.spent"] = maximum;
      changed = true;
    }
    if (changed) await feature.update(updates);
    if (notifyResult) {
      notify(`${actor.name}: Кровавая магия Сангвиниста синхронизирована (${maximum} использований, ${sanguinistBloodPoints(actor)} ед. крови).`);
    }
    return changed;
  } finally {
    sanguinistSyncs.delete(actor.uuid);
  }
}

async function spendBloodMagicUses(actor, amount) {
  const feature = bloodMagicFeature(actor);
  const uses = itemUses(feature);
  if (!feature || uses.remaining < amount) return false;
  await feature.update({ "system.uses.spent": uses.spent + amount });
  return true;
}

async function gainBloodPoints(actor, amount) {
  const before = sanguinistBloodPoints(actor);
  const after = await setSanguinistBloodPoints(actor, before + amount);
  notify(`${actor.name}: единицы крови ${before} → ${after}.`);
  return after;
}

async function spendBloodPoints(actor, amount) {
  const current = sanguinistBloodPoints(actor);
  if (current < amount) {
    notify(`${actor.name}: недостаточно единиц крови (${current}/${amount}).`, "warn");
    return false;
  }
  await setSanguinistBloodPoints(actor, current - amount);
  return true;
}

async function handleGainBloodPoint(actor) {
  await gainBloodPoints(actor, 1);
  await chat(actor, `<p><strong>${actor.name}: Кровавая магия.</strong> Получена 1 единица крови. Текущий запас: <strong>${sanguinistBloodPoints(actor)}</strong>.</p>`);
  return true;
}

async function handleGainBloodOfOthers(actor) {
  if (!hasFeature(actor, "blood-of-others")) {
    notify("Для этого действия нужна «Кровь других».", "warn");
    return false;
  }
  if (!await spendBloodMagicUses(actor, 2)) {
    notify(`${actor.name}: нужно 2 оставшихся использования Кровавой магии.`, "warn");
    return false;
  }
  await gainBloodPoints(actor, 2);
  await chat(actor, `<p><strong>${actor.name}: Кровь других.</strong> Потрачены 2 использования Кровавой магии, получены 2 единицы крови. Текущий запас: <strong>${sanguinistBloodPoints(actor)}</strong>.</p>`);
  return true;
}

async function handleSpendBloodPoints(actor) {
  const current = sanguinistBloodPoints(actor);
  if (current <= 0) {
    notify(`${actor.name}: нет единиц крови для траты.`, "warn");
    return false;
  }
  const amount = await promptNumber({
    title: "Кровавая магия",
    label: "Сколько единиц крови потратить",
    min: 1,
    max: Math.min(5, current)
  });
  if (!amount) return false;
  if (!await spendBloodPoints(actor, amount)) return false;
  await chat(actor, `<p><strong>${actor.name}: Кровавая магия.</strong> Потрачено ${amount} ед. крови. Следующее заклинание ${amount}-го уровня или ниже не тратит ячейку и считается Кровавым. Если это не некромантия, лечение заменяется временными хитами в половинном размере.</p>`);
  return true;
}

async function handleHematurgy(actor) {
  const level = sanguinistLevel(actor);
  const spent = Number(actor.getFlag(MODULE_ID, FLAGS.SANGUINIST_HEMATURGY_SPENT) ?? 0);
  const remainingLimit = Math.max(0, level * 2 - spent);
  if (remainingLimit <= 0) {
    notify(`${actor.name}: лимит костей хитов Гематургии до продолжительного отдыха уже исчерпан.`, "warn");
    return false;
  }
  const dice = await promptNumber({
    title: "Гематургия",
    label: "Сколько костей хитов потратить",
    min: 1,
    max: Math.min(5, remainingLimit)
  });
  if (!dice) return false;
  await selfBloodDamage(actor, `${dice}d8`, "Гематургия");
  await actor.setFlag(MODULE_ID, FLAGS.SANGUINIST_HEMATURGY_SPENT, spent + dice);
  await chat(actor, `<p><strong>${actor.name}: Гематургия.</strong> До продолжительного отдыха потрачено ${spent + dice}/${level * 2} костей хитов на Гематургию. Следующее заклинание в этом ходу считается Кровавым и может быть наложено без ячейки, если его уровень не выше ${dice}. Фактические кости хитов на листе спишите вручную.</p>`);
  return true;
}

async function showSpellcasting(actor) {
  const level = sanguinistLevel(actor);
  const ability = sanguinistAbility(actor);
  await chat(actor, `<p><strong>${actor.name}: заклинания Сангвиниста.</strong> Характеристика: <strong>${ability.toUpperCase()}</strong>, СЛ <strong>${sanguinistSpellDC(actor)}</strong>, атака заклинанием <strong>${signed(sanguinistSpellAttack(actor))}</strong>. Известно кровавых заклинаний: ${KNOWN_BLOOD_SPELLS[level] ?? 0}. Ячейки: 1-й круг ${BLOOD_SPELL_SLOTS[1][level] ?? 0}, 2-й круг ${BLOOD_SPELL_SLOTS[2][level] ?? 0}, 3-й круг ${BLOOD_SPELL_SLOTS[3][level] ?? 0}.</p>`);
  return true;
}

async function handleBloodReading(actor) {
  const used = Number(actor.getFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_READING_USED) ?? 0);
  const maximum = sanguinistLevel(actor);
  if (used >= maximum) {
    notify(`${actor.name}: «Чтение крови» уже использовано ${used}/${maximum} раз до продолжительного отдыха.`, "warn");
    return false;
  }
  await actor.setFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_READING_USED, used + 1);
  await chat(actor, `<p><strong>${actor.name}: Чтение крови.</strong> Вы накладываете <em>Чтение крови</em> без ячейки. Использований до продолжительного отдыха: ${used + 1}/${maximum}.</p>`);
  return true;
}

async function handleMarkBloodSpell(actor) {
  const used = Number(actor.getFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_SPELL_USED) ?? 0);
  const maximum = Math.max(1, proficiency(actor));
  if (used >= maximum) {
    notify(`${actor.name}: изменение заклинания в Кровавое уже использовано ${used}/${maximum} раз до продолжительного отдыха.`, "warn");
    return false;
  }
  await actor.setFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_SPELL_USED, used + 1);
  await chat(actor, `<p><strong>${actor.name}: Ученик крови.</strong> Следующее/текущее заклинание считается Кровавым в дополнение к другим школам. Использований до продолжительного отдыха: ${used + 1}/${maximum}.</p>`);
  return true;
}

async function chooseSpellLevel(title) {
  return promptNumber({ title, label: "Уровень заклинания", min: 0, max: 9, defaultValue: 1 });
}

async function handleSanguinePowerHitDie(actor) {
  const spellLevel = await chooseSpellLevel("Багровая сила: кость хитов");
  if (spellLevel == null) return false;
  await rollToChat(actor, "1d8", "Багровая сила: бонусный урон от потраченной кости хитов");
  await applyDirectDamage(actor, 1 + spellLevel);
  await chat(actor, `<p><strong>${actor.name}: Багровая сила.</strong> Получено ${1 + spellLevel} некротического самоповреждения. Добавьте результат 1к8 к одному броску урона заклинания. Фактическую кость хитов спишите вручную.</p>`);
  return true;
}

async function handleSanguinePowerBloodPoint(actor) {
  const spellLevel = await chooseSpellLevel("Багровая сила: единица крови");
  if (spellLevel == null) return false;
  if (!await spendBloodPoints(actor, 1)) return false;
  await rollToChat(actor, "1d8", "Багровая сила: бонусный урон от 1 единицы крови");
  await applyDirectDamage(actor, 1 + spellLevel);
  await chat(actor, `<p><strong>${actor.name}: Багровая сила.</strong> Потрачена 1 ед. крови, получено ${1 + spellLevel} некротического самоповреждения. Добавьте результат 1к8 к одному броску урона заклинания.</p>`);
  return true;
}

function classHitDiceUpdates(actor, amount) {
  let remaining = Math.max(0, amount);
  const updates = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "class" || remaining <= 0) continue;
    const used = Number(item.system?.hitDiceUsed ?? 0);
    if (used <= 0) continue;
    const restored = Math.min(used, remaining);
    updates.push({ _id: item.id, "system.hitDiceUsed": used - restored });
    remaining -= restored;
  }
  return updates;
}

async function restoreHitDice(actor, amount) {
  let remaining = Math.max(0, amount);
  let restoredTotal = 0;
  const updates = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "class" || remaining <= 0) continue;
    const used = Number(item.system?.hitDiceUsed ?? 0);
    if (used <= 0) continue;
    const restored = Math.min(used, remaining);
    updates.push({ _id: item.id, "system.hitDiceUsed": used - restored });
    restoredTotal += restored;
    remaining -= restored;
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return restoredTotal;
}

async function clearAllHitDiceUsed(actor) {
  const updates = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "class") continue;
    if (Number(item.system?.hitDiceUsed ?? 0) > 0) updates.push({ _id: item.id, "system.hitDiceUsed": 0 });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

async function handleVitalRestoration(actor) {
  await chat(actor, `<p><strong>${actor.name}: Жизненное восстановление.</strong> После продолжительного отдыха модуль восстановит все недостающие кости хитов, а не только половину.</p>`);
  return true;
}

async function handleBloodCompatibility(actor) {
  await chat(actor, `<p><strong>${actor.name}: Кровавая совместимость.</strong> Выберите через Advancement одну опцию: <em>Моя собственная кровь</em> или <em>Кровь других</em>. Выбор можно заменить при получении уровня Сангвиниста или уровня с Улучшением характеристик.</p>`);
  return true;
}

async function handleMyOwnBloodRecovery(actor) {
  if (!hasFeature(actor, "my-own-blood")) {
    notify("Для этого действия нужна «Моя собственная кровь».", "warn");
    return false;
  }
  const feature = bloodMagicFeature(actor);
  const uses = itemUses(feature);
  if (!feature || uses.remaining <= 0) {
    notify(`${actor.name}: нет оставшихся использований Кровавой магии для восстановления костей хитов.`, "warn");
    return false;
  }
  await feature.update({ "system.uses.spent": uses.maximum });
  await actor.updateEmbeddedDocuments("Item", classHitDiceUpdates(actor, uses.remaining));
  await chat(actor, `<p><strong>${actor.name}: Моя собственная кровь.</strong> Потрачено ${uses.remaining} оставшихся использований Кровавой магии для восстановления до ${uses.remaining} костей хитов после короткого отдыха.</p>`);
  return true;
}

async function handleRitualSacrifice(actor) {
  await chat(actor, `<p><strong>${actor.name}: Ритуальное жертвоприношение.</strong> После успешного часового ритуала выберите усиление следующего немедленно накладываемого заклинания: увеличенная длительность, увеличенная дистанция, увеличенная область, неумолимость или особые цели. Успех ритуала и ценность крови подтверждает Мастер.</p>`);
  return true;
}

async function spendFixedBlood(actor, amount, label) {
  if (!await spendBloodPoints(actor, amount)) return false;
  await chat(actor, `<p><strong>${actor.name}: ${label}.</strong> Потрачено ${amount} ед. крови. Осталось: <strong>${sanguinistBloodPoints(actor)}</strong>. СЛ Сангвиниста: <strong>${sanguinistSpellDC(actor)}</strong>.</p>`);
  return true;
}

async function handleArterialPuppetry(actor) {
  if (!await spendFixedBlood(actor, 3, "Артериальная марионетка")) return false;
  await chat(actor, `<p>Цель с кровью совершает спасбросок Телосложения против СЛ <strong>${sanguinistSpellDC(actor)}</strong>. При провале вы направляете её перемещение в следующий ход, а её действие тратится на атаку выбранной вами цели с помехой.</p>`);
  return true;
}

async function handleBloodBacklash(actor) {
  const current = sanguinistBloodPoints(actor);
  const amount = await promptNumber({
    title: "Кровавая обратная связь",
    label: "Сколько единиц крови потратить",
    min: 1,
    max: Math.min(5, current)
  });
  if (!amount || !await spendBloodPoints(actor, amount)) return false;
  await rollToChat(actor, `${amount * 2}d8 ${signed(sanguinistSpellModifier(actor))}`, "Кровавая обратная связь: урон силой + некротический модификатор");
  await chat(actor, `<p><strong>${actor.name}: Кровавая обратная связь.</strong> Атака заклинанием <strong>${signed(sanguinistSpellAttack(actor))}</strong>, дистанция 150 футов. При попадании примените урон выше.</p>`);
  return true;
}

async function handleBloodletting(actor) {
  if (!await spendFixedBlood(actor, 2, "Кровопускание")) return false;
  await rollToChat(actor, "2d8", "Кровопускание: некротический урон при провале спасброска");
  await chat(actor, `<p>Цель повторяет спасбросок Телосложения в конце каждого своего хода, получая 2к8 некротического урона при провале и оканчивая эффект при успехе.</p>`);
  return true;
}

async function handleContusion(actor) {
  if (!await spendFixedBlood(actor, 2, "Ушиб")) return false;
  await chat(actor, `<p>При провале спасброска Телосложения цель 1 минуту не может поддерживать концентрацию или реакции, совершает проверки характеристик и атаки с помехой, а её скорость и грузоподъёмность уменьшены вдвое. Повторный спасбросок — в конце каждого её хода.</p>`);
  return true;
}

function crimsonFuryEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.SANGUINIST_CRIMSON_FURY_EFFECT));
}

async function handleCrimsonFury(actor) {
  if (!await spendBloodPoints(actor, 1)) return false;
  const currentTemp = Number(actor.system?.attributes?.hp?.temp ?? 0);
  if (currentTemp < 5) await actor.update({ "system.attributes.hp.temp": 5 });
  const feature = findFeature(actor, "crimson-fury");
  const data = {
    name: "Багровая ярость",
    img: feature?.img ?? "icons/magic/unholy/orb-hands-pink.webp",
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.SANGUINIST_CRIMSON_FURY_EFFECT]: true
      }
    },
    duration: {
      rounds: 1,
      startRound: game.combat?.round ?? 0,
      startTurn: game.combat?.turn ?? 0
    },
    system: { changes: [] }
  };
  const current = crimsonFuryEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  await chat(actor, `<p><strong>${actor.name}: Багровая ярость.</strong> Потрачена 1 ед. крови, временные хиты минимум 5. До начала следующего хода: преимущество на атаки оружием и спасброски от очарования/испуга; концентрацию поддерживать нельзя.</p>`);
  return true;
}

async function handleSanguineStorm(actor) {
  if (!await spendFixedBlood(actor, 3, "Багровая буря")) return false;
  await rollToChat(actor, "6d6", "Багровая буря: некротический урон в 10 футах");
  await chat(actor, `<p>Существа в 10 футах от цели совершают спасбросок Телосложения против СЛ <strong>${sanguinistSpellDC(actor)}</strong>. Цель, сниженная до 0 хитов, автоматически проваливает одну проверку смерти.</p>`);
  return true;
}

async function handleTransfusion(actor) {
  const current = sanguinistBloodPoints(actor);
  const amount = await promptNumber({
    title: "Переливание",
    label: "Сколько единиц крови потратить",
    min: 1,
    max: current
  });
  if (!amount || !await spendBloodPoints(actor, amount)) return false;
  const roll = await rollToChat(actor, `${amount * 2}d6`, "Переливание: временные хиты цели");
  const tempHp = Math.min(40, Math.max(0, Number(roll.total ?? 0)));
  await chat(actor, `<p><strong>${actor.name}: Переливание.</strong> Цель с кровью получает <strong>${tempHp}</strong> временных хитов на 1 минуту (максимум 40). Примените их к выбранной цели вручную.</p>`);
  return true;
}

async function handleVampirism(actor) {
  const current = sanguinistBloodPoints(actor);
  const amount = await promptNumber({
    title: "Вампиризм",
    label: "Сколько единиц крови потратить",
    min: 1,
    max: Math.min(5, current)
  });
  if (!amount || !await spendBloodPoints(actor, amount)) return false;
  const healing = amount * 5;
  await healActor(actor, healing);
  await chat(actor, `<p><strong>${actor.name}: Вампиризм.</strong> Потрачено ${amount} ед. крови, восстановлено <strong>${healing}</strong> хитов.</p>`);
  return true;
}

export async function handleSanguinistAction(actor, activity, action) {
  switch (action) {
    case "sync-sanguinist-resources":
      return syncSanguinistResources(actor, { notifyResult: true });
    case "gain-sanguinist-blood-point":
      return handleGainBloodPoint(actor);
    case "gain-sanguinist-blood-points-others":
      return handleGainBloodOfOthers(actor);
    case "spend-sanguinist-blood-points":
      return handleSpendBloodPoints(actor);
    case "use-hematurgy":
      return handleHematurgy(actor);
    case "show-sanguinist-spellcasting":
      return showSpellcasting(actor);
    case "cast-blood-reading":
      return handleBloodReading(actor);
    case "mark-sanguinist-blood-spell":
      return handleMarkBloodSpell(actor);
    case "sanguine-power-hit-die":
      return handleSanguinePowerHitDie(actor);
    case "sanguine-power-blood-point":
      return handleSanguinePowerBloodPoint(actor);
    case "show-vital-restoration":
      return handleVitalRestoration(actor);
    case "show-blood-compatibility":
      return handleBloodCompatibility(actor);
    case "use-my-own-blood-recovery":
      return handleMyOwnBloodRecovery(actor);
    case "show-ritual-sacrifice":
      return handleRitualSacrifice(actor);
    case "use-arterial-puppetry":
      return handleArterialPuppetry(actor);
    case "use-blood-backlash":
      return handleBloodBacklash(actor);
    case "use-bloodletting":
      return handleBloodletting(actor);
    case "use-contusion":
      return handleContusion(actor);
    case "use-crimson-fury":
      return handleCrimsonFury(actor);
    case "use-sanguine-storm":
      return handleSanguineStorm(actor);
    case "use-transfusion":
      return handleTransfusion(actor);
    case "use-vampirism":
      return handleVampirism(actor);
    default:
      return false;
  }
}

export function isSanguinistAction(action) {
  return SANGUINIST_ACTIONS.has(action);
}

export function validateSanguinistActivityUse(actor, activity, action) {
  if (!actor || !sanguinistClass(actor)) {
    notify("Эта активность требует класс «Сангвинист».", "warn");
    return false;
  }
  const requiredLevel = ACTION_LEVELS[action] ?? 0;
  const level = sanguinistLevel(actor);
  if (requiredLevel && level < requiredLevel) {
    notify(`Эта активность требует ${requiredLevel}-й уровень Сангвиниста.`, "warn");
    return false;
  }
  if (action === "gain-sanguinist-blood-point") {
    const uses = itemUses(activityItem(activity));
    if (uses.maximum > 0 && uses.remaining <= 0) {
      notify(`${actor.name}: нет оставшихся использований Кровавой магии.`, "warn");
      return false;
    }
  }
  if (action === "gain-sanguinist-blood-points-others") {
    const uses = itemUses(bloodMagicFeature(actor));
    if (uses.remaining < 2) {
      notify(`${actor.name}: для «Крови других» нужно 2 оставшихся использования Кровавой магии.`, "warn");
      return false;
    }
  }
  if ([
    "spend-sanguinist-blood-points",
    "sanguine-power-blood-point",
    "use-arterial-puppetry",
    "use-blood-backlash",
    "use-bloodletting",
    "use-contusion",
    "use-crimson-fury",
    "use-sanguine-storm",
    "use-transfusion",
    "use-vampirism"
  ].includes(action) && sanguinistBloodPoints(actor) <= 0) {
    notify(`${actor.name}: нет единиц крови.`, "warn");
    return false;
  }
  return true;
}

export async function clearSanguinistRestState(actor, result, { automationEnabled = true } = {}) {
  if (!automationEnabled || !actor?.isOwner || !sanguinistClass(actor)) return false;
  if (["short", "long"].includes(result?.type)) {
    await setSanguinistBloodPoints(actor, 0);
  }
  if (result?.type === "long") {
    await actor.unsetFlag(MODULE_ID, FLAGS.SANGUINIST_HEMATURGY_SPENT);
    await actor.unsetFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_READING_USED);
    await actor.unsetFlag(MODULE_ID, FLAGS.SANGUINIST_BLOOD_SPELL_USED);
    if (hasFeature(actor, "vital-restoration")) await clearAllHitDiceUsed(actor);
    await syncSanguinistResources(actor);
  }
  return true;
}
