import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import { automationData, findFeature, isAutomationAuthority, itemIdentifier, notify } from "../shared/helpers.mjs";
import { abilityMod } from "../shared/dnd5e.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";

const gamblerSyncs = new Set();

const CARDS = {
  1: { name: "Весы", formula: "4d8", damage: "колющий" },
  2: { name: "Ствол" },
  3: { name: "Стрела", formula: "5d4", damage: "силой" },
  4: { name: "Копьё", formula: "2d10", damage: "рубящий" },
  5: { name: "Кувшин", formula: "5d4", damage: "силой" },
  6: { name: "Шпиль", formula: "2d6", damage: "колющий" }
};

export function gamblerClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "gambler");
}

export function gamblerLevel(actor) {
  return Number(gamblerClass(actor)?.system?.levels ?? 0);
}

export function gamblerPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.dex?.value ?? 0) < 13) failures.push("Ловкость 13");
  if (Number(actor?.system?.abilities?.int?.value ?? 0) < 13) failures.push("Интеллект 13");
  return failures;
}

export function validateGamblerPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "gambler") return true;
  const failures = gamblerPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Харроуер». Не выполнено: ${failures.join(", ")}. Сюжетное обучение картам подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateGamblerFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.gamblerFeature !== true || options?.isAdvancement) return true;
  const level = gamblerLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Харроуер».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Харроуера.`, "error");
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

export async function syncGamblerResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || gamblerSyncs.has(actor.uuid)) return false;
  if (!gamblerClass(actor)) return false;

  gamblerSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "deal-them"), Math.max(1, 1 + abilityMod(actor, "dex"))),
      await syncUses(findFeature(actor, "rogues-are-lucky"), 1),
      await syncUses(findFeature(actor, "up-the-sleeve"), Math.max(1, abilityMod(actor, "int")))
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Харроуера синхронизированы.`);
    return changed;
  } finally {
    gamblerSyncs.delete(actor.uuid);
  }
}

function effectByFlag(actor, flag) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, flag));
}

function heldCardEffect(actor) {
  return effectByFlag(actor, FLAGS.GAMBLER_HELD_CARD_EFFECT);
}

function sleevedCardEffect(actor) {
  return effectByFlag(actor, FLAGS.GAMBLER_SLEEVED_CARD_EFFECT);
}

function acesCooldownEffect(actor) {
  const effect = effectByFlag(actor, FLAGS.GAMBLER_ACES_COOLDOWN_EFFECT);
  return isEffectActive(effect) ? effect : null;
}

function cardFromEffect(effect) {
  return Number(effect?.getFlag(MODULE_ID, FLAGS.GAMBLER_CARD_VALUE) ?? 0);
}

async function drawCard(actor, flavor = "Колода Астральных Тайн") {
  const roll = await new Roll("1d6", actor.getRollData()).evaluate();
  const card = Number(roll.total ?? 0);
  const cardName = CARDS[card]?.name ?? `карта ${card}`;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${flavor}: вытянута карта «${cardName}»`
  });
  return card;
}

function cardEffectData({ actor, feature, card, flag, namePrefix }) {
  const cardName = CARDS[card]?.name ?? `карта ${card}`;
  return {
    name: `${namePrefix}: ${cardName}`,
    img: feature?.img ?? "icons/svg/card-joker.svg",
    origin: feature?.uuid ?? null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [flag]: true,
        [FLAGS.GAMBLER_CARD_VALUE]: card
      }
    },
    system: {
      changes: []
    }
  };
}

async function createCardEffect(actor, { feature, card, flag, namePrefix }) {
  await actor.createEmbeddedDocuments("ActiveEffect", [cardEffectData({ actor, feature, card, flag, namePrefix })]);
}

async function rollDamage(actor, formula, flavor) {
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

export async function playGamblerCard(actor, card, source = "Колода Астральных Тайн") {
  const definition = CARDS[card];
  if (!definition) {
    notify("Неизвестная карта Харроуера.", "warn");
    return false;
  }
  const label = `${source}: ${definition.name}`;
  switch (card) {
    case 1:
      await rollDamage(
        actor,
        definition.formula,
        `${label}: 4к8 колющего урона цели и враждебным существам в пределах 5 футов`
      );
      break;
    case 2:
      await chat(
        actor,
        `<p><strong>${label}.</strong> Цель заключена в 5-футовую клетку зелёной силы на 1 минуту или пока клетка не разрушена. КД клетки 15, хиты 25.</p>`
      );
      break;
    case 3:
      await rollDamage(actor, definition.formula, `${label}: 5к4 урона силой`);
      await chat(
        actor,
        `<p><strong>${label}.</strong> Харроуер получает дополнительное бонусное действие в этом ходу.</p>`
      );
      break;
    case 4:
      await rollDamage(
        actor,
        definition.formula,
        `${label}: 2к10 рубящего урона. Если дальнобойная атака заклинанием была критической, удвойте кости урона по правилам критического попадания.`
      );
      break;
    case 5:
      await rollDamage(actor, definition.formula, `${label}: 5к4 урона силой`);
      await chat(
        actor,
        `<p><strong>${label}.</strong> Восстановите недостающий классовый ресурс. Если восстанавливается ячейка заклинания, за каждую выпавшую 4 ячейка может быть на один уровень выше.</p>`
      );
      break;
    case 6: {
      const roll = await rollDamage(actor, definition.formula, `${label}: 2к6 колющего урона`);
      const jumps = roll.dice?.some(die => die.results?.some(result => Number(result.result ?? 0) === 6));
      if (jumps) {
        await chat(
          actor,
          `<p><strong>${label}.</strong> На кости выпала 6: карта перескакивает на другого врага в пределах 10 футов.</p>`
        );
      }
      break;
    }
  }
  return true;
}

export async function drawAstralCard(actor) {
  if (!actor || !gamblerClass(actor)) {
    notify("Эта активность требует класс «Харроуер».", "warn");
    return false;
  }
  if (heldCardEffect(actor)) {
    notify(
      `${actor.name}: у вас уже есть удержанная карта. Используйте или сбросьте её перед новым вытягиванием.`,
      "warn"
    );
    return false;
  }
  const feature = findFeature(actor, "astral-deck");
  if (!feature) {
    notify("Для вытягивания требуется особенность «Колода Астральных Тайн».", "warn");
    return false;
  }
  const card = await drawCard(actor);
  await createCardEffect(actor, {
    feature,
    card,
    flag: FLAGS.GAMBLER_HELD_CARD_EFFECT,
    namePrefix: "Удержанная карта"
  });
  notify(`${actor.name}: удерживает карту «${CARDS[card].name}».`);
  return true;
}

export async function useHeldAstralCard(actor) {
  const effect = heldCardEffect(actor);
  if (!effect || !actor?.isOwner) {
    notify(`${actor?.name ?? "Персонаж"}: удержанной карты нет.`, "warn");
    return false;
  }
  const card = cardFromEffect(effect);
  const played = await playGamblerCard(actor, card, "Удержанная карта");
  if (played) await effect.delete();
  return played;
}

export async function discardHeldAstralCard(actor) {
  const effect = heldCardEffect(actor);
  if (!effect || !actor?.isOwner) {
    notify(`${actor?.name ?? "Персонаж"}: удержанной карты нет.`, "info");
    return false;
  }
  await effect.delete();
  notify(`${actor.name}: удержанная карта сброшена.`);
  return true;
}

export async function dealThem(actor) {
  if (!actor || !findFeature(actor, "deal-them")) {
    notify("Для действия требуется особенность «Сдавай Их».", "warn");
    return false;
  }
  for (let index = 1; index <= 3; index += 1) {
    const card = await drawCard(actor, `Сдавай Их: карта ${index}`);
    await playGamblerCard(actor, card, `Сдавай Их — карта ${index}`);
  }
  return true;
}

export async function rollRoguesAreLucky(actor) {
  if (!actor || !findFeature(actor, "rogues-are-lucky")) {
    notify("Для броска требуется особенность «Плутам везёт».", "warn");
    return false;
  }
  const roll = await new Roll("1d100", actor.getRollData()).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Плутам везёт: бросок Харроуера против броска Мастера"
  });
  await chat(
    actor,
    `<p><strong>Плутам везёт.</strong> Мастер бросает к100. Если результат Харроуера выше, он подсматривает верхнюю карту колоды; порядок этой карты до использования отслеживает Мастер.</p>`
  );
  return true;
}

export async function storeSleevedCard(actor) {
  if (!actor || !gamblerClass(actor)) {
    notify("Эта активность требует класс «Харроуер».", "warn");
    return false;
  }
  if (sleevedCardEffect(actor)) {
    notify(`${actor.name}: во внепространственном измерении уже хранится карта.`, "warn");
    return false;
  }
  const feature = findFeature(actor, "up-the-sleeve");
  if (!feature) {
    notify("Для припрятывания требуется особенность «В Рукаве».", "warn");
    return false;
  }
  const card = await drawCard(actor, "В Рукаве");
  await createCardEffect(actor, {
    feature,
    card,
    flag: FLAGS.GAMBLER_SLEEVED_CARD_EFFECT,
    namePrefix: "Карта в рукаве"
  });
  notify(`${actor.name}: карта «${CARDS[card].name}» припрятана.`);
  return true;
}

export async function useSleevedCard(actor) {
  const effect = sleevedCardEffect(actor);
  if (!effect || !actor?.isOwner) {
    notify(`${actor?.name ?? "Персонаж"}: припрятанной карты нет.`, "warn");
    return false;
  }
  const card = cardFromEffect(effect);
  const played = await playGamblerCard(actor, card, "Карта в рукаве");
  if (played) await effect.delete();
  return played;
}

export async function acesBeat(actor) {
  if (!actor || !findFeature(actor, "aces-beat")) {
    notify("Для действия требуется особенность «Тузы бьют».", "warn");
    return false;
  }
  if (acesCooldownEffect(actor)) {
    notify(`${actor.name}: «Тузы бьют» уже использованы и недоступны 24 часа.`, "warn");
    return false;
  }
  const cardEffect = heldCardEffect(actor) ?? sleevedCardEffect(actor);
  if (!cardEffect) {
    notify(`${actor.name}: для «Тузы бьют» нужна удержанная или припрятанная карта.`, "warn");
    return false;
  }
  await cardEffect.delete();
  const exhaustion = Number(actor.system?.attributes?.exhaustion ?? 0);
  await actor.update({ "system.attributes.exhaustion": exhaustion + 1 });
  const feature = findFeature(actor, "aces-beat");
  await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Тузы бьют: перезарядка 24 часа",
      img: feature?.img ?? "icons/svg/card-joker.svg",
      origin: feature?.uuid ?? null,
      transfer: false,
      disabled: false,
      showIcon: 1,
      statuses: [],
      duration: {
        seconds: 86400,
        startTime: game.time?.worldTime ?? 0
      },
      flags: {
        [MODULE_ID]: {
          [FLAGS.GAMBLER_ACES_COOLDOWN_EFFECT]: true
        }
      },
      system: {
        changes: []
      }
    }
  ]);
  await chat(
    actor,
    `<p><strong>${actor.name}: Тузы бьют.</strong> Карта сожжена. Выполните телепортацию как заклинанием <em>Телепортация</em>. Истощение увеличено на 1; способность недоступна 24 часа.</p>`
  );
  return true;
}
