const MODULE_ID = "the-grimoire-of-grimgutz";

const INTERNAL_ALIASES = {
  crusher: ["Сокрушителя", "Сокрушителю", "Сокрушителем"],
  leader: ["Лидера", "Лидеру", "Лидером"],
  "death-knight": ["Рыцаря смерти", "Рыцарю смерти", "Рыцарем смерти"],
  heretic: ["Еретика", "Еретику", "Еретиком"],
  cleaving: ["Раскалывания", "Раскалыванием"],
  crushing: ["Сокрушения", "Сокрушением"],
  "giant-killer": ["Убийцы гигантов", "Убийцу гигантов"],
  "steel-will": ["Стальной воли", "Стальную волю", "Стальной волей"],
  "steel-giant": ["Стального гиганта", "Стальному гиганту"],
  "powerful-crushing": ["Мощного сокрушения", "Мощным сокрушением"],
  "powerful-cleaving": ["Мощного раскалывания", "Мощным раскалыванием"],
  indestructibility: ["Несокрушимости", "Несокрушимостью"],
  "leader-command-stratagems": [
    "Стратагем командования",
    "Стратагему командования",
    "Стратагемой командования",
    "стратагемы командования",
    "стратагему командования"
  ],
  "moment-of-glory": ["Мгновения славы", "Мгновением славы"],
  "glimpse-of-genius": ["Проблеска гения", "Проблеском гения"],
  "leadership-expertise": ["Экспертности лидерства", "Экспертностью лидерства"],
  "perfect-coordination": ["Идеальной координации", "Идеальной координацией"],
  "frontline-commander": ["Командира на передовой", "Командиром на передовой"],
  "leader-presence": ["Присутствия лидера", "Присутствием лидера"],
  "mystical-power": ["Мистической силы", "Мистической силой"],
  "undead-nature": ["особенности «Нежить»"],
  "death-knight-magic-resistance": ["Сопротивления магии", "Сопротивлением магии"],
  "strong-undead": ["Сильной нежити"],
  "battle-undead": ["Боевой нежити"],
  "occult-gifts": ["Оккультных даров", "Оккультными дарами"],
  "marked-by-corruption": ["Отмеченного порчей", "Отмеченным порчей"],
  "vile-powers": ["Гнусных сил", "Гнусными силами", "гнусной силы", "гнусные силы"],
  "forbidden-talent": ["Запретного таланта", "Запретным талантом", "запретных талантов"],
  "distorted-body": ["Искажённого тела", "Искажённым телом"],
  "vile-unholy-power": ["Нечестивой силы", "Нечестивой силой"],
  "vile-unholy-smite": ["Нечестивой кары", "Нечестивой карой"],
  "vile-unholy-vigor": ["Нечестивой мощи", "Нечестивой мощью"],
  "forest-lord": ["Лесного владыки", "Лесному владыке", "Лесным владыкой"],
  "tree-kindred": ["Древесного родича", "Древесным родичем"],
  "nature-magic": ["Магии природы", "Магией природы"],
  "nature-sense": ["Чувства природы", "Чувством природы"],
  "forest-barkskin": ["Коракожи", "Коракожей"],
  "oak-strength": ["Силы дуба", "Силой дуба"],
  "spruce-growth": ["Роста ели", "Ростом ели"],
  "oak-heart": ["Сердца дуба", "Сердцем дуба"],
  "forest-might": ["Лесной мощи", "Лесной мощью"],
  "take-root": ["Пустить корни", "Пускания корней"],
  aberrant: ["Абберанта", "Абберанту", "Абберантом"],
  "deadly-precision": ["Смертельной точности", "Смертельную точность", "Смертельной точностью"],
  "monster-reflexes": ["Рефлексов чудовища", "Рефлексами чудовища"],
  "arcane-sense": ["Чувства арканы", "Чувством арканы"],
  "toxic-blood": ["Токсичной крови", "Токсичной кровью"],
  "vigorous-nature": ["Энергичной природы", "Энергичной природой"],
  "final-changes": ["Финальных изменений", "Финальными изменениями"],
  "unnatural-traits": ["Неестественных черт", "Неестественными чертами"],
  "murderspawn-transformation": ["Порождения убийств", "Порождением убийств"],
  "hollow-transformation": ["Полого", "Полым"],
  "magic-eradicator": ["Истребителя магии", "Истребителем магии"],
  "negative-body": ["Негативного тела", "Негативным телом"],
  "hollow-soul": ["Полой души", "Полой душой"],
  "masking-aura": ["Ауры маскировки", "Аурой маскировки"],
  "negative-gaze": ["Негативного взгляда", "Негативным взглядом"],
  "fortified-soul": ["Укреплённой души", "Укреплённой душой"],
  "wound-in-magic": ["Раны в магии", "Раной в магии"]
};

Object.assign(INTERNAL_ALIASES, {
  "school-of-steel": ["Школы стали", "Школе стали", "Школой стали"],
  "steel-battle-training": ["Боевой тренировки", "Боевой тренировкой", "Боевую тренировку"],
  "steel-crippling-strikes": ["Калечащих ударов", "Калечащими ударами"],
  "steel-master-of-metal": ["Мастера металла", "Мастером металла"],
  "steel-signature-technique": ["Фирменного приёма", "Фирменным приёмом", "фирменный приём"],
  "steel-storm": ["Стального шторма", "Стальным штормом"],
  "steel-imperial-reach": ["Имперской досягаемости", "Имперской досягаемостью"],
  "steel-metalist": ["Металлиста", "Металлистом"]
});

const EXTERNAL_LINKS = [
  {
    uuid: "Compendium.dnd5e.spells.Item.ATo0Eb63TDtnu6iA",
    aliases: ["Оживление предметов", "оживление предметов", "Оживление вещей", "оживление вещей"]
  },
  {
    uuid: "Compendium.dnd5e.classes.Item.gZiUvbXWLs0pOp0c",
    aliases: ["Паладин", "Паладина", "Паладину", "Паладином"]
  },
  {
    uuid: "Compendium.dnd5e.classfeatures.Item.OdrvL3afwLOPeuYZ",
    aliases: ["Наложение рук", "Наложения рук", "Наложением рук"]
  },
  {
    uuid: "Compendium.dnd5e.classfeatures.Item.XogoBnFWmCAHXppo",
    aliases: ["Дополнительная атака", "Дополнительной атакой"]
  },
  {
    uuid: "Compendium.dnd5e.classfeatures.Item.s0Cc2zcX0JzIgam5",
    aliases: ["Улучшение характеристик"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.MUO1uYN7JR1hm4dR",
    aliases: ["Чудотворство", "чудотворство"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.ghXTfe7sgCbgf1Q8",
    aliases: ["Обнаружение магии", "обнаружение магии"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.3OZnNhunvRtPOQmH",
    aliases: ["Опознание", "опознание"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.JGT5bNqu9REL7Fuz",
    aliases: ["Призыв фамильяра", "призыв фамильяра"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.ccduLIvutyNqvkgv",
    aliases: ["Невидимый слуга", "невидимого слугу"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.BrBZdCCrJRIVg7YX",
    aliases: ["Тихий образ", "тихий образ"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.A3q2gTNqG6fvNGrv",
    aliases: ["Изменение облика", "изменение облика"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.ZrTc23tToJ0JpH2h",
    aliases: ["Прыжок", "прыжок"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.GJ2WYm3SQFR0winH",
    aliases: ["Антипатия/симпатия", "антипатии/симпатии"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.SLxA9QhrggTz0taU",
    aliases: ["Освящение", "освящение", "освящения"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.3Lo9boi7P2ro6QV4",
    aliases: ["Удержание личности", "удержания личности"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.fVbCxFRaORalHB20",
    aliases: ["Наблюдение", "наблюдение", "наблюдения"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.CylBa7jR8DSbo8Z3",
    aliases: ["Зона правды", "зоны правды"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.arzCrMRgcNiQuh43",
    aliases: ["Приказ", "приказ"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.zMAWdyc8UVb37BK4",
    aliases: ["Внушение", "внушение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.pRMvmknwLf2tdMTj",
    aliases: ["Бесследное передвижение", "бесследное передвижение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.1N8dDMMgZ1h1YJ3B",
    aliases: ["Невидимость", "невидимость"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.aU62xVUBYkAQWIHv",
    aliases: ["Необнаружимость", "необнаружимость"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.IBJmWjzbQGu7M4UX",
    aliases: ["Туманное облако", "туманное облако"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.S7VbUetIfVT7B6Eq",
    aliases: ["Тьма", "тьму"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.4dSvfvTy2ZIJ3K4k",
    aliases: ["Понимание языков", "понимание языков"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.5VhqFROQYjr1P9lp",
    aliases: ["Тишина", "тишину"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.pO4zGe5LmFIYqJiL",
    aliases: ["Наложение проклятия", "наложение проклятия"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.XZhdgVK3cLoxNCQl",
    aliases: ["Снятие проклятия", "снятие проклятия"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.UDUnlfPsOAbq2RSE",
    aliases: ["Размытость", "размытость"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.X4c8xCkmF8U9HUMz",
    aliases: ["Зеркальное отражение", "зеркальное отражение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.2IWiZAJtOGDoKjiz",
    aliases: ["Газообразная форма", "газообразную форму"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.oyE5nVppa5mde5gT",
    aliases: ["Оживление мертвеца", "оживление мертвеца"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.XXUDGFELgoskdOD0",
    aliases: ["Страх", "страх"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.ppWAAEul0QHtm4er",
    aliases: ["Обнаружение мыслей", "обнаружение мыслей"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.B0pnIcc52O6G8hi8",
    aliases: ["Длинный шаг", "длинный шаг"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.Szvk5FEVQW3uhJi5",
    aliases: ["Ускорение", "ускорение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.y8A4HfTwd93ypdEz",
    aliases: ["Магический круг", "магический круг"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.E4NXux0RHvME1XgP",
    aliases: ["Создание нежити", "создание нежити"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.KhwiSi9fwVfUPtku",
    aliases: ["Сон", "сон"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.kSPRpeIx3w3nihrF",
    aliases: ["Сновидение", "сновидение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.4v2H3hHb3Ph9XLNd",
    aliases: ["Предсказание", "предсказание"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.cg50KpBkBdPK6vPL",
    aliases: ["Ясновидение", "ясновидение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.W4Qx5z0id6da0vqg",
    aliases: ["Знание легенд", "знание легенд"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.nslx2nT3p4lNkmdp",
    aliases: ["Иллюзорная сцена", "иллюзорную сцену"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.sTIkQK7KuQNOyY0C",
    aliases: ["Иллюзорная местность", "иллюзорную местность"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.lnaGnxMzpYnbw1uU",
    aliases: ["Создание", "создание"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.JQyigMNPiDnGI18b",
    aliases: ["Геас", "геас"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.42O2aNBW7vK90gTL",
    aliases: ["Планарные узы", "планарные узы"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.eEpy1ONlXumKS1mp",
    aliases: ["Подчинение чудовища", "подчинение чудовища"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.eS7XnnApoxRxYXPs",
    aliases: ["Очарование личности", "очарование личности"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.91Sw6vOIaO7U8DvM",
    aliases: ["Подчинение личности", "подчинение личности"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.tEpDmYZNGc9f5OhJ",
    aliases: ["Большая невидимость", "большую невидимость"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.ATo0Eb63TDtnu6iA",
    aliases: ["Оживление предметов", "оживление предметов"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.kozNy29b0X6exFhY",
    aliases: ["Превращение в камень", "превращение в камень"]
  },
  {
    uuid: "Compendium.dnd5e.classes.Item.ygVYgPbJkaH0tH1N",
    aliases: ["Друид", "Друида", "Друиду", "Друидом"]
  },
  {
    uuid: "Compendium.dnd5e.classes.Item.VkRQ7glQvTWWiOCS",
    aliases: ["Следопыт", "Следопыта", "Следопыту", "Следопытом"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.WahI41a3goVUg0x1",
    aliases: ["Увеличение/Уменьшение"]
  },
  {
    uuid: "Compendium.dnd5e.spells.Item.eS7XnnApoxRxYXPs",
    aliases: ["Очарование личности", "Очарования личности"]
  }
];

const UNLINKED_PHRASES = [
  "Затемнение",
  "Завеса чар",
  "Парящий диск Тензера",
  "Крошечный слуга",
  "Призыв духа",
  "Причинение страха",
  "Танцевальная макабра",
  "Создание абоминации",
  "Кошачий сон",
  "Сон песочного человека",
  "Окаменение"
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function internalUuid(packName, document) {
  return `Compendium.${MODULE_ID}.${packName}.Item.${document._id}`;
}

function buildTargets(packs) {
  const targets = [];
  for (const pack of packs) {
    if (!["classes", "features", "transformations", "spells", "equipment"].includes(pack.name)) continue;
    for (const document of pack.documents) {
      const identifier = document.system?.identifier;
      targets.push({
        uuid: internalUuid(pack.name, document),
        documentId: document._id,
        // Short technique names such as "Натиск"/"Стойкость" also occur as
        // ordinary words or unrelated rules. Outside this class require an
        // explicit authored UUID instead of inventing a cross-class reference.
        scope: document.flags?.[MODULE_ID]?.transformation === "dullahan" ? "dullahan" : document.flags?.[MODULE_ID]?.flagellantFeature ? "flagellant" : document.flags?.[MODULE_ID]?.doomedFeature ? "doomed" : document.flags?.[MODULE_ID]?.nightmareFeature ? "nightmare" : document.flags?.[MODULE_ID]?.empathFeature || document.flags?.[MODULE_ID]?.empathSpell ? "empath" : document.flags?.[MODULE_ID]?.transformation === "arkane" ? "arkane" : document.flags?.[MODULE_ID]?.transformation === "automaton" ? "automaton" : document.flags?.[MODULE_ID]?.transformation === "broodmother" ? "broodmother" : document.flags?.[MODULE_ID]?.transformation === "chimera" ? "chimera" : document.flags?.[MODULE_ID]?.transformation === "deathknight" ? "deathknight" : null,
        aliases: [document.name, ...(INTERNAL_ALIASES[identifier] ?? [])]
      });
    }
  }
  targets.push(...EXTERNAL_LINKS.map(target => ({ ...target, documentId: null })));
  return targets;
}

function linkText(text, targets, currentDocumentId) {
  const aliases = new Map();
  for (const target of targets) {
    if (target.documentId === currentDocumentId) continue;
    for (const alias of target.aliases) {
      const normalized = alias?.toLocaleLowerCase("ru");
      if (!normalized || aliases.has(normalized)) continue;
      aliases.set(normalized, {
        alias,
        uuid: target.uuid
      });
    }
  }
  if (!aliases.size) return text;

  const pattern = [...aliases.values()]
    .map(entry => entry.alias)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const regexp = new RegExp(`(?<![\\p{L}\\p{N}_])(${pattern})(?![\\p{L}\\p{N}_])`, "giu");
  return text.replace(regexp, match => {
    const target = aliases.get(match.toLocaleLowerCase("ru"));
    return target ? `@UUID[${target.uuid}]{${match}}` : match;
  });
}

function linkHtml(html, targets, currentDocumentId) {
  const protectedPhrases = [];
  const protectedPattern = UNLINKED_PHRASES
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const masked = String(html).replace(new RegExp(protectedPattern, "giu"), match => {
    const index = protectedPhrases.push(match) - 1;
    return `\uE000${index}\uE001`;
  });
  return masked
    .split(/(@UUID\[[^\]]+\]\{[^}]*\}|<[^>]+>)/g)
    .map(part => {
      if (!part || part.startsWith("<") || part.startsWith("@UUID[")) return part;
      return linkText(part, targets, currentDocumentId);
    })
    .join("")
    .replace(/\uE000(\d+)\uE001/g, (_match, index) => protectedPhrases[Number(index)] ?? "");
}

export function linkDocumentDescriptions(packs) {
  const targets = buildTargets(packs);
  let linksAdded = 0;

  for (const pack of packs) {
    if (!["classes", "features", "spells"].includes(pack.name)) continue;
    for (const document of pack.documents) {
      const current = document.system?.description?.value;
      if (!current) continue;
      const ownFlagellant = document.flags?.[MODULE_ID]?.flagellantFeature || document.flags?.[MODULE_ID]?.prestigeClass === "flagellant";
      const ownDoomed = document.flags?.[MODULE_ID]?.doomedFeature || document.flags?.[MODULE_ID]?.prestigeClass === "doomed";
      const ownNightmare = document.flags?.[MODULE_ID]?.nightmareFeature || document.flags?.[MODULE_ID]?.prestigeClass === "nightmare";
      const ownEmpath = document.flags?.[MODULE_ID]?.empathFeature || document.flags?.[MODULE_ID]?.empathSpell || document.flags?.[MODULE_ID]?.prestigeClass === "empath";
      const ownArkane = document.flags?.[MODULE_ID]?.transformation === "arkane";
      const ownAutomaton = document.flags?.[MODULE_ID]?.transformation === "automaton";
      const ownDeathknight = document.flags?.[MODULE_ID]?.transformation === "deathknight";
      const ownDullahan = document.flags?.[MODULE_ID]?.transformation === "dullahan";
      const ownChimera = document.flags?.[MODULE_ID]?.transformation === "chimera";
      const ownBroodmother = document.flags?.[MODULE_ID]?.transformation === "broodmother";
      const scopedTargets = targets.filter(target => !target.scope || target.scope === "flagellant" && ownFlagellant || target.scope === "doomed" && ownDoomed || target.scope === "nightmare" && ownNightmare || target.scope === "empath" && ownEmpath || target.scope === "arkane" && ownArkane || target.scope === "automaton" && ownAutomaton || target.scope === "broodmother" && ownBroodmother || target.scope === "chimera" && ownChimera || target.scope === "deathknight" && ownDeathknight || target.scope === "dullahan" && ownDullahan);
      const linked = linkHtml(current, scopedTargets, document._id);
      linksAdded += (linked.match(/@UUID\[/g)?.length ?? 0) - (current.match(/@UUID\[/g)?.length ?? 0);
      document.system.description.value = linked;
    }
  }

  return linksAdded;
}
