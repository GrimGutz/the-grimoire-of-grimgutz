import { activeEffect, feature, folder, idFor, utilityActivity } from "../common.mjs";

const SOURCE = "Престиж-класс: Еретик; предоставленный PDF PK_Heretic.pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:heretic-features");
const MARK_FOLDER = idFor("folder:heretic-corruption-marks");
const TALENT_FOLDER = idFor("folder:heretic-forbidden-talents");
const BODY_FOLDER = idFor("folder:heretic-distorted-body");
const POWER_FOLDER = idFor("folder:heretic-vile-powers");

export const hereticFolders = [
  folder({ key: "heretic-features", name: "Еретик: классовые особенности", sort: 900000 }),
  folder({ key: "heretic-corruption-marks", name: "Еретик: дары порчи", sort: 1000000 }),
  folder({ key: "heretic-forbidden-talents", name: "Еретик: запретные таланты", sort: 1100000 }),
  folder({ key: "heretic-distorted-body", name: "Еретик: искажённое тело", sort: 1200000 }),
  folder({ key: "heretic-vile-powers", name: "Еретик: гнусные силы", sort: 1300000 })
];

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function hereticFeature(options) {
  return feature({
    ...options,
    sourcePage: options.sourcePage ?? "1–4",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      hereticFeature: true,
      ...(options.automation ?? {})
    }
  });
}

function powerActivities(key, entries) {
  return Object.assign({}, ...entries.map((entry, index) => utilityActivity({
    key: `${key}-${index}`,
    name: entry.name,
    action: "use-occult-points",
    actionData: {
      occultCost: entry.cost,
      occultMin: entry.min,
      occultMax: entry.max,
      occultFormula: entry.formula,
      occultDamageType: entry.damageType,
      occultApplyTempHp: entry.applyTempHp === true,
      occultMessage: entry.message
    },
    activation: entry.activation ?? "action",
    rangeValue: entry.range ?? null,
    rangeUnits: entry.rangeUnits ?? "ft",
    targetType: entry.targetType ?? "",
    targetCount: entry.targetCount ?? "",
    targetChoice: entry.targetChoice ?? false,
    condition: entry.condition ?? ""
  })));
}

function vilePower({
  key,
  name,
  body,
  activities = [],
  minimumLevel = 1,
  img = "icons/magic/unholy/orb-glowing-purple.webp"
}) {
  return hereticFeature({
    key,
    name,
    img,
    level: minimumLevel,
    requirements: `Еретик ${minimumLevel}; Гнусная сила`,
    folder: POWER_FOLDER,
    automation: {
      vilePower: true,
      minimumLevel
    },
    activities: powerActivities(key, activities),
    sourcePage: "5–7",
    description: description(
      body,
      "активности проверяют и расходуют очки оккультизма из особенности «Оккультные дары». Если указана формула урона или временных хитов, модуль выполняет бросок; спасброски, атаки заклинанием и эффекты заклинаний применяются по карточке."
    )
  });
}

const markDefinitions = [
  {
    key: "mark-cursed-flesh",
    name: "Проклятая плоть",
    img: "icons/magic/unholy/strike-body-life-soul-purple.webp",
    effects: [activeEffect({
      key: "heretic-cursed-flesh",
      name: "Проклятая плоть",
      img: "icons/magic/unholy/strike-body-life-soul-purple.webp",
      changes: [{ key: "system.traits.ci.value", type: "custom", value: "diseased", priority: 20 }]
    })],
    body: "<p>У вас нет крови, вы иммунны к болезням, совершаете с преимуществом спасброски от проклятий и игнорируете эффекты экстремальной жары и холода.</p>",
    automation: "переносимый эффект добавляет иммунитет к болезням. Преимущество против проклятий и игнорирование экстремальной температуры применяются вручную."
  },
  {
    key: "mark-sharp-darkvision",
    name: "Острое тёмное зрение",
    img: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
    effects: [activeEffect({
      key: "heretic-sharp-darkvision",
      name: "Острое тёмное зрение",
      img: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
      changes: [{ key: "system.attributes.senses.ranges.darkvision", type: "add", value: "120", priority: 20 }]
    })],
    body: "<p>Вы видите в темноте и тусклом свете на 120 футов. Если у вас уже есть тёмное зрение, его дистанция прибавляется к этой величине, максимум 300 футов.</p>",
    automation: "переносимый эффект добавляет 120 футов к текущему тёмному зрению. Если итог превышает 300 футов, ограничьте его вручную."
  },
  {
    key: "mark-occult-magic",
    name: "Оккультная магия",
    img: "icons/magic/symbols/runes-star-pentagon-magenta.webp",
    body: "<p>До завершения накладывания невозможно определить ваше заклинание. Обнаружение магии раскрывает лишь тёмную ауру. Добавьте модификатор оккультизма к Сл попыток противодействовать или рассеять ваши заклинания.</p>",
    automation: "скрытие заклинания и повышение Сл рассеивания применяются вручную, поскольку dnd5e не предоставляет отдельного поля Сл противодействия."
  },
  {
    key: "mark-restless",
    name: "Неугомонный",
    img: "icons/magic/time/hourglass-tilted-gray.webp",
    body: "<p>Вы не нуждаетесь во сне, магия не может вас усыпить, и продолжительный отдых занимает 4 часа. После него степень истощения уменьшается на 1к4 вместо одного уровня.</p>",
    automation: "особые продолжительность отдыха и снижение истощения остаются ручными правилами; стандартный отдых Foundry не поддерживает индивидуальную длительность."
  },
  {
    key: "mark-shadow-pockets",
    name: "Теневые карманы",
    img: `${WOW}/Abilities/EnvelopingShadows.png`,
    body: "<p>Вы храните предметы в своей тени. Вместимость равна 15 + модификатор Силы фунтов. При вашей смерти содержимое появляется в пространстве тени или вашем пространстве.</p>",
    automation: "используйте контейнер или заметку на листе персонажа; отдельный инвентарь тени системой не поддерживается."
  },
  {
    key: "mark-soul-eater",
    name: "Пожиратель душ",
    img: "icons/magic/death/skull-energy-light-purple.webp",
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "sr", type: "recoverAll" }, { period: "lr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "soul-eater",
      name: "Пожрать душу",
      activation: "special",
      consumeItemUse: true,
      rangeValue: 30,
      targetType: "creature",
      targetCount: "1",
      condition: "Существо, не являющееся нежитью или конструкцией, умирает"
    }),
    body: "<p>Вам не нужно есть или пить. Когда подходящее существо умирает в пределах 30 футов, потратьте Кости Хитов в количестве до половины бонуса мастерства и восстановите хиты как при коротком отдыхе. Повторное применение — после короткого или продолжительного отдыха.</p>",
    automation: "активность учитывает одно применение между отдыхами. Выбор и бросок Костей Хитов выполняется через лист персонажа."
  },
  {
    key: "mark-unholiness",
    name: "Нечестивость",
    img: "icons/magic/unholy/barrier-shield-glowing-pink.webp",
    body: "<p>Вы имеете преимущество против эффектов обращения нежити, телепортации или отправки на другой план, против антипатии/симпатии, освящения, удержания личности, наблюдения, зоны правды и любых заклинаний ограждения.</p>",
    automation: "из-за разнородности источников преимущество выбирается вручную при соответствующем спасброске."
  },
  {
    key: "mark-low-gravity",
    name: "Слабая гравитация",
    img: "icons/magic/movement/trail-streak-impact-blue.webp",
    body: "<p>На вас постоянно действует прыжок. Вы падаете на 100 футов за раунд, имеете сопротивление урону от падения, максимум урона от падения 5к6 и приземляетесь на ноги при падении менее 50 футов.</p>",
    automation: "параметры падения и прыжка применяются вручную, поскольку они не представлены отдельными полями актёра."
  },
  {
    key: "mark-callous",
    name: "Чёрствый",
    img: `${WOW}/Spells/PsychicHorrors.png`,
    body: "<p>Вы совершаете с преимуществом спасброски от очарования.</p>",
    automation: "выбирайте преимущество при спасброске от очарования."
  },
  {
    key: "mark-cynical",
    name: "Циничный",
    img: `${WOW}/Abilities/BloodyEye.png`,
    body: "<p>Вы совершаете с преимуществом спасброски и проверки характеристик для распознавания истинной природы иллюзий.</p>",
    automation: "преимущество применяется вручную, когда Мастер сообщает, что бросок относится к распознаванию иллюзии."
  },
  {
    key: "mark-proud",
    name: "Гордый",
    img: "icons/magic/control/fear-fright-white.webp",
    body: "<p>Вы совершаете с преимуществом спасброски от испуга.</p>",
    automation: "выбирайте преимущество при спасброске от испуга."
  },
  {
    key: "mark-undead",
    name: "Нежить порчи",
    img: `${WOW}/Spells/AnimateDead.png`,
    effects: [activeEffect({
      key: "heretic-mark-undead",
      name: "Нежить порчи",
      img: `${WOW}/Spells/AnimateDead.png`,
      changes: [{ key: "system.details.type.value", type: "override", value: "undead", priority: 100 }]
    })],
    body: "<p>Ваш тип существа становится нежитью вместо обычного типа, и вам не нужно дышать.</p>",
    automation: "переносимый эффект устанавливает тип существа «нежить». Отсутствие потребности в дыхании учитывается повествовательно."
  }
];

const forbiddenTalentDefinitions = [
  ["talent-banish-light", "Изгнать свет", "Вы произвольно накладываете авторское заклинание «Затемнение», требуя только соматический компонент; во время действия имеете преимущество на Запугивание.", "action"],
  ["talent-arcane-step", "Таинственный шаг", "Вы произвольно накладываете измерение: дистанция 5 футов, время накладывания 1 минута, заклинание считается заклинанием 1-го уровня.", "special"],
  ["talent-hidden-presence", "Скрытое присутствие", "Вы произвольно накладываете авторское заклинание «Завеса чар» без компонентов и имеете преимущество на Скрытность во время его действия.", "action"],
  ["talent-open-sight", "Откровенное зрение", "Вы произвольно накладываете обнаружение магии и опознание без компонентов; дистанция опознания становится 30 футов.", "action"],
  ["talent-shadow-butler", "Теневой дворецкий", "Действием придайте форму тени, накладывая призыв фамильяра, парящий диск Тензера или невидимого слугу без компонентов. Повторное применение оканчивает предыдущее.", "action"],
  ["talent-shadow-puppet", "Теневая марионетка", "Вы произвольно накладываете тихий образ, требуя только соматический компонент; проверки распознавания иллюзии совершаются с помехой.", "action"],
  ["talent-shapeshifter", "Оборотень", "Вы произвольно накладываете изменение облика без компонентов; проверки распознавания иллюзии совершаются с помехой.", "action"],
  ["talent-unholy-mantra", "Нечестивая мантра", "Действием до конца следующего хода получите преимущество на спасброски Интеллекта, Мудрости, Харизмы и спасброски концентрации.", "action"],
  ["talent-abyss-lurker", "Скрытник Бездны", "Действием исчезните с физического плана до начала следующего хода.", "action"]
];

const distortedDefinitions = [
  {
    key: "distortion-ability-improvement",
    name: "Искажённое тело: Улучшение характеристик",
    body: "<p>Увеличьте одну характеристику на 2 либо две характеристики на 1, максимум до 20. С разрешения Мастера вместо этого можно выбрать черту.</p>",
    automation: "условное улучшение характеристик невозможно вложить внутрь ItemChoice. После выбора примените увеличение в окне характеристик персонажа."
  },
  {
    key: "distortion-beyond-sight",
    name: "Взгляд за грань",
    effects: [activeEffect({
      key: "heretic-beyond-sight",
      name: "Взгляд за грань",
      img: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
      changes: [
        { key: "system.attributes.senses.ranges.darkvision", type: "upgrade", value: "120", priority: 20 },
        { key: "system.attributes.senses.ranges.blindsight", type: "upgrade", value: "30", priority: 20 }
      ]
    })],
    body: "<p>Вы видите в тусклом свете, обычной и магической темноте на 120 футов и получаете слепое зрение 30 футов.</p>",
    automation: "переносимый эффект устанавливает минимум 120 футов тёмного зрения и 30 футов слепого зрения; игнорирование магической темноты учитывается по описанию."
  },
  {
    key: "distortion-warped-power",
    name: "Искажённая сила",
    body: "<p>Выберите холод, огонь, электричество, некротический, ядовитый или психический урон. Один бросок такого урона вашего заклинания или гнусной силы получает модификатор оккультизма, минимум +1.</p>",
    automation: "выбранный тип урона и бонус применяются вручную, поскольку особенность требует постоянного выбора при получении."
  },
  {
    key: "distortion-cursed-strikes",
    name: "Проклятые удары",
    body: "<p>Атаки оружием в рамках действия Атака наносят 1к4 дополнительного некротического урона, либо 1к6 при удержании оружия двумя руками.</p>",
    automation: "добавочный урон применяется вручную: dnd5e не объединяет отдельные оружейные активности в единое действие Атака."
  },
  {
    key: "distortion-dark-guard",
    name: "Тёмная стража",
    body: "<p>Вы получаете +1 к КД, пока не используете щит. Для получения бонуса требуется владение щитами.</p>",
    automation: "модуль автоматически добавляет +1 к КД, если персонаж владеет щитами и не экипировал щит, и снимает бонус при экипировке щита."
  },
  {
    key: "distortion-defiled-heart",
    name: "Осквернённое сердце",
    body: "<p>Если после короткого отдыха у вас меньше 4 очков оккультизма, восстановите их до 4.</p>",
    automation: "при завершении короткого отдыха модуль восстанавливает ресурс «Оккультные дары» до четырёх очков."
  },
  {
    key: "distortion-eerie-agility",
    name: "Жуткая ловкость",
    body: "<p>Когда вы совершаете действие Атака, можете атаковать дважды вместо одного раза.</p>",
    automation: "дополнительная атака выполняется повторным использованием оружейной активности."
  },
  {
    key: "distortion-forbidden-flesh",
    name: "Запретная плоть",
    effects: [activeEffect({
      key: "heretic-forbidden-flesh",
      name: "Запретная плоть",
      img: "icons/magic/unholy/strike-body-life-soul-purple.webp",
      changes: [
        { key: "system.traits.dr.value", type: "custom", value: "necrotic", priority: 20 },
        { key: "system.traits.dv.value", type: "custom", value: "radiant", priority: 50 }
      ]
    })],
    body: "<p>Вы сопротивляетесь некротическому и дробящему, колющему, рубящему урону немагического непосеребрённого оружия, но уязвимы к излучению и не можете получать сопротивление или иммунитет к нему.</p>",
    automation: "переносимый эффект добавляет сопротивление некротическому урону и уязвимость к излучению. Условное сопротивление физическому урону применяется вручную или через Midi-QOL только против немагического непосеребрённого оружия; запрет последующего иммунитета к излучению проверяет Мастер."
  },
  {
    key: "distortion-ghost-flight",
    name: "Призрачный полёт",
    effects: [activeEffect({
      key: "heretic-ghost-flight",
      name: "Призрачный полёт",
      img: "icons/magic/movement/chevrons-down-yellow.webp",
      changes: [{ key: "system.attributes.movement.fly", type: "upgrade", value: "40", priority: 20 }]
    })],
    body: "<p>Вы получаете скорость полёта 40 футов, но совершаете с помехой спасброски Силы и Ловкости, пока используете её.</p>",
    automation: "переносимый эффект добавляет скорость полёта. Помеха на спасброски включается вручную, когда персонаж фактически летит."
  },
  {
    key: "distortion-ghoulish-might",
    name: "Гульская мощь",
    effects: [activeEffect({
      key: "heretic-ghoulish-might",
      name: "Гульская мощь",
      img: "icons/magic/control/buff-strength-muscle-damage-orange.webp",
      changes: [
        { key: "system.attributes.hp.bonuses.level", type: "add", value: "2", priority: 20 },
        { key: "system.abilities.str.check.roll.mode", type: "upgrade", value: "1", priority: 20 },
        { key: "system.abilities.str.save.roll.mode", type: "upgrade", value: "1", priority: 20 }
      ]
    })],
    body: "<p>Вы имеете преимущество на проверки и спасброски Силы и увеличиваете максимум хитов на удвоенный общий уровень персонажа. Бонус не складывается с чертой «Стойкость».</p>",
    automation: "переносимый эффект добавляет 2 хита за уровень и преимущество на проверки и спасброски Силы. Несовместимость с чертой «Стойкость» проверяется Мастером."
  }
];

const basePowers = [
  vilePower({
    key: "vile-charming-presence",
    name: "Чарующее обаяние",
    body: "<p>За 1 очко бонусным действием на час получите преимущество на Убеждение. Пока эффект действует, за 1 очко наложите помеху на спасбросок существа против вашего очарования.</p>",
    activities: [
      { name: "Чарующее обаяние", cost: 1, activation: "bonus" },
      { name: "Помешать сопротивлению очарованию", cost: 1, activation: "reaction" }
    ]
  }),
  vilePower({
    key: "vile-dark-command",
    name: "Тёмная команда",
    body: "<p>За 1 очко наложите приказ; за 2 очка — внушение, требуя только вербальный компонент.</p>",
    activities: [
      { name: "Приказ", cost: 1 },
      { name: "Внушение", cost: 2 }
    ]
  }),
  vilePower({
    key: "vile-flicker-evasion",
    name: "Мерцание и уклонение",
    body: "<p>Бонусным действием за 1 очко немедленно совершите Рывок и затем Уклонение либо Отход.</p>",
    activities: [{ name: "Рывок и Уклонение/Отход", cost: 1, activation: "bonus" }]
  }),
  vilePower({
    key: "vile-spectral-presence",
    name: "Призрачное присутствие",
    body: "<p>За 1 очко бонусным действием на час не оставляйте следов и получите преимущество на Скрытность, Ловкость рук и Выживание; либо за 2 очка наложите бесследное передвижение без компонентов.</p>",
    activities: [
      { name: "Призрачные навыки", cost: 1, activation: "bonus" },
      { name: "Бесследное передвижение", cost: 2, activation: "bonus" }
    ]
  }),
  vilePower({
    key: "vile-id-blast",
    name: "Взрыв Ид",
    body: "<p>Действием потратьте 1–5 очков. Существо в пределах 60 футов совершает спасбросок Интеллекта или Харизмы. Провал: 2к8 + модификатор оккультизма за первое очко и +1к8 за каждое следующее; успех: половина.</p>",
    activities: [{
      name: "Взрыв Ид",
      min: 1,
      max: 5,
      range: 60,
      targetType: "creature",
      targetCount: "1",
      formula: "{costPlusOne}d8 + {occultMod}",
      damageType: "psychic"
    }]
  }),
  vilePower({
    key: "vile-fear-inspiring",
    name: "Внушающий страх",
    body: "<p>За 1 очко бонусным действием на час получите преимущество на Запугивание. Пока эффект действует, за 1 очко наложите помеху на спасбросок против испуга перед вами.</p>",
    activities: [
      { name: "Внушающий страх", cost: 1, activation: "bonus" },
      { name: "Помешать сопротивлению страху", cost: 1, activation: "reaction" }
    ]
  }),
  vilePower({
    key: "vile-obscuring-secret",
    name: "Затемняющая тайна",
    body: "<p>За 1 очко бонусным действием на час получите преимущество на Обман. Пока эффект действует, за 1 очко наложите помеху на распознавание ваших иллюзий.</p>",
    activities: [
      { name: "Затемняющая тайна", cost: 1, activation: "bonus" },
      { name: "Помешать распознаванию иллюзии", cost: 1, activation: "reaction" }
    ]
  }),
  vilePower({
    key: "vile-occult-step",
    name: "Оккультный шаг",
    body: "<p>Бонусным действием потратьте любое количество очков и телепортируйтесь: 1–5 очков — 15 футов за очко; 6–9 — 60 футов за очко; 10+ — 150 футов за очко.</p>",
    activities: [{ name: "Оккультный шаг", min: 1, max: 13, activation: "bonus", message: "Дистанция зависит от количества потраченных очков по таблице особенности." }]
  }),
  vilePower({
    key: "vile-death-omen",
    name: "Предзнаменование смерти",
    body: "<p>За 1 очко в любой момент своего хода получите преимущество на все атаки по одному видимому существу до конца хода.</p>",
    activities: [{ name: "Предзнаменование смерти", cost: 1, activation: "special", targetType: "creature", targetCount: "1" }]
  }),
  vilePower({
    key: "vile-pass-unnoticed",
    name: "Пройти незамеченным",
    body: "<p>Действием за 2 очка наложите на себя невидимость либо необнаружимость, требуя только соматический компонент.</p>",
    activities: [
      { name: "Невидимость", cost: 2 },
      { name: "Необнаружимость", cost: 2 }
    ]
  }),
  vilePower({
    key: "vile-predator-eye",
    name: "Глаз хищника",
    body: "<p>Бонусным действием за 1 очко на минуту или 2 очка на 10 минут получите преимущество на Восприятие и Проницательность, игнорируйте помеху большой дистанции и половинное/трёхчетвертное укрытие.</p>",
    activities: [
      { name: "Глаз хищника: 1 минута", cost: 1, activation: "bonus" },
      { name: "Глаз хищника: 10 минут", cost: 2, activation: "bonus" }
    ]
  }),
  vilePower({
    key: "vile-shadow-blast",
    name: "Теневой взрыв",
    body: "<p>Действием потратьте 1–5 очков и совершите дальнобойную атаку заклинанием на 120 футов. Попадание: 2к12 + модификатор оккультизма за первое очко и +1к12 за каждое следующее.</p>",
    activities: [{
      name: "Теневой взрыв",
      min: 1,
      max: 5,
      range: 120,
      targetType: "creature",
      targetCount: "1",
      formula: "{costPlusOne}d12 + {occultMod}",
      damageType: "necrotic"
    }]
  }),
  vilePower({
    key: "vile-shadow-weaver",
    name: "Ткач теней",
    body: "<p>Действием за 1 очко наложите туманное облако, либо за 2 очка — тьму, требуя только соматический компонент. Существа в области не могут прятаться от вас.</p>",
    activities: [
      { name: "Туманное облако", cost: 1 },
      { name: "Тьма", cost: 2 }
    ]
  }),
  vilePower({
    key: "vile-touch-corruption",
    name: "Прикосновение порчи",
    body: "<p>Бонусным действием за 1 очко выберите существо в 30 футах или поражённое вами оружием в этом ходу. При провале спасброска Телосложения цель отравлена на минуту и повторяет спасбросок в конце хода.</p>",
    activities: [{ name: "Прикосновение порчи", cost: 1, activation: "bonus", range: 30, targetType: "creature", targetCount: "1" }]
  }),
  vilePower({
    key: "vile-supernatural-limbs",
    name: "Сверхъестественные конечности",
    body: "<p>В начале хода за 1 очко на минуту или 2 очка на час увеличьте досягаемость рукопашных атак на 10 футов. Бонусным действием можно окончить эффект.</p>",
    activities: [
      { name: "Конечности: 1 минута", cost: 1, activation: "special" },
      { name: "Конечности: 1 час", cost: 2, activation: "special" }
    ]
  }),
  vilePower({
    key: "vile-unholy-power",
    name: "Нечестивая сила",
    body: "<p>При накладывании заклинания потратьте 1–8 очков, повышая уровень ячейки на один за очко. Максимальный итоговый уровень: 4-й на уровнях персонажа 1–6, 5-й на 7–8, 6-й на 9–10, 7-й на 11–12, 8-й на 13–14, 9-й на 15+.</p>",
    activities: [{ name: "Усилить заклинание", min: 1, max: 8, activation: "special" }]
  }),
  vilePower({
    key: "vile-unholy-smite",
    name: "Нечестивая кара",
    body: "<p>После попадания оружием потратьте 1–3 очка. Атака наносит модификатор оккультизма + 1к8 некротического урона за каждое очко.</p>",
    activities: [{
      name: "Нечестивая кара",
      min: 1,
      max: 3,
      activation: "special",
      formula: "{cost}d8 + {occultMod}",
      damageType: "necrotic"
    }]
  }),
  vilePower({
    key: "vile-unholy-vigor",
    name: "Нечестивая мощь",
    body: "<p>Бонусным действием потратьте 1–10 очков и получите 2к6 временных хитов за каждое очко.</p>",
    activities: [{
      name: "Нечестивая мощь",
      min: 1,
      max: 10,
      activation: "bonus",
      formula: "{doubleCost}d6",
      applyTempHp: true
    }]
  }),
  vilePower({
    key: "vile-unspoken-words",
    name: "Невысказанные слова",
    body: "<p>За 1 очко наложите понимание языков; за 2 очка — тишину, требуя только вербальный компонент.</p>",
    activities: [
      { name: "Понимание языков", cost: 1 },
      { name: "Тишина", cost: 2 }
    ]
  })
];

const levelThreePowers = [
  vilePower({
    key: "vile-curse-broker",
    name: "Посредник проклятий",
    minimumLevel: 3,
    body: "<p>Действием за 3 очка наложите наложение проклятия или снятие проклятия без материальных компонентов и с дистанцией 30 футов.</p>",
    activities: [{ name: "Наложение проклятия", cost: 3, range: 30 }, { name: "Снятие проклятия", cost: 3, range: 30 }]
  }),
  vilePower({
    key: "vile-phantom-self",
    name: "Фантомное «Я»",
    minimumLevel: 3,
    body: "<p>Бонусным действием за 3 очка наложите размытость либо зеркальное отражение без компонентов; концентрация на них поддерживается с преимуществом.</p>",
    activities: [{ name: "Размытость", cost: 3, activation: "bonus" }, { name: "Зеркальное отражение", cost: 3, activation: "bonus" }]
  }),
  vilePower({
    key: "vile-shadow-form",
    name: "Теневая форма",
    minimumLevel: 3,
    body: "<p>Бонусным действием за 2 очка наложите на себя газообразную форму, требуя только вербальный компонент. Имеющаяся скорость полёта не уменьшается.</p>",
    activities: [{ name: "Газообразная форма", cost: 2, activation: "bonus" }]
  }),
  vilePower({
    key: "vile-spirit-binding",
    name: "Связывание духа",
    minimumLevel: 3,
    body: "<p>За 3 очка наложите оживление мертвеца либо крошечного слугу; за 5 — авторский призыв духа. Материальные компоненты не требуются.</p>",
    activities: [{ name: "Оживление мертвеца", cost: 3 }, { name: "Крошечный слуга", cost: 3 }, { name: "Призыв духа", cost: 5 }]
  }),
  vilePower({
    key: "vile-dreadlord",
    name: "Властелин ужаса",
    minimumLevel: 3,
    body: "<p>За 1 очко наложите причинение страха; за 3 — страх, требуя только вербальный компонент.</p>",
    activities: [{ name: "Причинение страха", cost: 1 }, { name: "Страх", cost: 3 }]
  }),
  vilePower({
    key: "vile-mind-spy",
    name: "Мысленный шпион",
    minimumLevel: 3,
    body: "<p>Бонусным действием за 2 очка наложите обнаружение мыслей без компонентов.</p>",
    activities: [{ name: "Обнаружение мыслей", cost: 2, activation: "bonus" }]
  }),
  vilePower({
    key: "vile-unholy-agility",
    name: "Нечестивая ловкость",
    minimumLevel: 3,
    body: "<p>Бонусным действием за 1 очко наложите на себя длинный шаг; за 6 — ускорение, без компонентов.</p>",
    activities: [{ name: "Длинный шаг", cost: 1, activation: "bonus" }, { name: "Ускорение", cost: 6, activation: "bonus" }]
  }),
  vilePower({
    key: "vile-unholy-circle",
    name: "Нечестивый круг",
    minimumLevel: 3,
    body: "<p>Действием за 1 очко наложите западню; за 3 — магический круг, без компонентов.</p>",
    activities: [{ name: "Западня", cost: 1 }, { name: "Магический круг", cost: 3 }]
  }),
  vilePower({
    key: "vile-vanishing",
    name: "Исчезновение",
    minimumLevel: 3,
    body: "<p>Реакцией при попадании по вам за 3 очка телепортируйтесь до 30 футов. Атака промахивается, если вы оказались вне досягаемости или за полным укрытием.</p>",
    activities: [{ name: "Исчезновение", cost: 3, activation: "reaction", range: 30 }]
  })
];

const levelFivePowers = [
  vilePower({
    key: "vile-corpse-puppeteer",
    name: "Кукловод трупов",
    minimumLevel: 5,
    body: "<p>За 5 очков наложите танцевальную макабру, за 8 — создание нежити, за 13 — авторское создание абоминации; материальные компоненты не требуются.</p>",
    activities: [{ name: "Танцевальная макабра", cost: 5 }, { name: "Создание нежити", cost: 8 }, { name: "Создание абоминации", cost: 13 }]
  }),
  vilePower({
    key: "vile-dream-eater",
    name: "Пожиратель снов",
    minimumLevel: 5,
    body: "<p>За 1 очко наложите сон, за 2 — кошачий сон, за 4 — сон, за 7 — авторский сон песочного человека; материальные компоненты не требуются.</p>",
    activities: [{ name: "Сон", cost: 1 }, { name: "Кошачий сон", cost: 2 }, { name: "Сновидение", cost: 4 }, { name: "Сон песочного человека", cost: 7 }]
  }),
  vilePower({
    key: "vile-eerie-visions",
    name: "Жуткие видения",
    minimumLevel: 5,
    body: "<p>За 1 очко наложите предсказание, за 2 — ясновидение, за 3 — наблюдение, за 4 — знание легенд, без компонентов.</p>",
    activities: [{ name: "Предсказание", cost: 1 }, { name: "Ясновидение", cost: 2 }, { name: "Наблюдение", cost: 3 }, { name: "Знание легенд", cost: 4 }]
  }),
  vilePower({
    key: "vile-darkness-maker",
    name: "Творец мрака",
    minimumLevel: 5,
    body: "<p>За 1 очко наложите тихий образ, за 2 — иллюзорную сцену, за 3 — иллюзорную местность либо создание, без материальных компонентов.</p>",
    activities: [{ name: "Тихий образ", cost: 1 }, { name: "Иллюзорная сцена", cost: 2 }, { name: "Иллюзорная местность", cost: 3 }, { name: "Создание", cost: 3 }]
  }),
  vilePower({
    key: "vile-haunting-curse",
    name: "Преследующее проклятие",
    minimumLevel: 5,
    body: "<p>За 6 очков наложите геас, освящение либо планарные узы без материальных компонентов и с временем накладывания в 10 раз меньше. За 13 очков наложите подчинение чудовища. Эти заклинания считаются проклятиями.</p>",
    activities: [{ name: "Геас", cost: 6 }, { name: "Освящение", cost: 6 }, { name: "Планарные узы", cost: 6 }, { name: "Подчинение чудовища", cost: 13 }]
  }),
  vilePower({
    key: "vile-mind-thief",
    name: "Похититель разума",
    minimumLevel: 5,
    body: "<p>За 1 очко наложите очарование личности, за 2 — венец безумия, за 4 — подчинение личности, требуя только вербальный компонент.</p>",
    activities: [{ name: "Очарование личности", cost: 1 }, { name: "Венец безумия", cost: 2 }, { name: "Подчинение личности", cost: 4 }]
  }),
  vilePower({
    key: "vile-phantom-cloak",
    name: "Фантомный плащ",
    minimumLevel: 5,
    body: "<p>Бонусным действием за 6 очков наложите на себя большую невидимость без компонентов, длительностью до 10 минут и с концентрацией.</p>",
    activities: [{ name: "Фантомный плащ", cost: 6, activation: "bonus" }]
  }),
  vilePower({
    key: "vile-strike-living-unliving",
    name: "Поразить живое/неживое",
    minimumLevel: 5,
    body: "<p>За 3 очка наложите авторское окаменение, за 5 — оживление предметов, за 6 — превращение в камень без материальных компонентов. При применении превращения в камень к себе вы сохраняете сознание, концентрацию и можете окончить эффект в любой момент.</p>",
    activities: [{ name: "Окаменение", cost: 3 }, { name: "Оживление предметов", cost: 5 }, { name: "Превращение в камень", cost: 6 }]
  }),
  vilePower({
    key: "vile-unholy-weapon",
    name: "Нечестивое оружие",
    minimumLevel: 5,
    body: "<p>Бонусным действием потратьте 1–3 очка. Одно несомое оружие на час становится магическим и получает +1 к атаке и урону за каждое очко.</p>",
    activities: [{ name: "Нечестивое оружие", min: 1, max: 3, activation: "bonus", message: "Выберите несомое оружие и примените к нему бонус, равный потраченным очкам, на 1 час." }]
  })
];

export const HERETIC_MARKS = markDefinitions.map(definition => definition.key);
export const HERETIC_FORBIDDEN_TALENTS = forbiddenTalentDefinitions.map(([key]) => key);
export const HERETIC_DISTORTIONS = distortedDefinitions.map(definition => definition.key);
export const HERETIC_BASE_POWERS = basePowers.map(document => document.system.identifier);
export const HERETIC_LEVEL_THREE_POWERS = levelThreePowers.map(document => document.system.identifier);
export const HERETIC_LEVEL_FIVE_POWERS = levelFivePowers.map(document => document.system.identifier);
export const HERETIC_CORE_POWERS = ["vile-unholy-power", "vile-unholy-smite", "vile-unholy-vigor"];

export const hereticDocuments = [
  hereticFeature({
    key: "occult-gifts",
    name: "Оккультные дары",
    img: "icons/magic/symbols/runes-star-pentagon-magenta.webp",
    level: 1,
    requirements: "Еретик 1",
    folder: MAIN_FOLDER,
    uses: {
      max: "@scale.heretic.occult-points",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: Object.assign(
      {},
      utilityActivity({
        key: "choose-occult-ability",
        name: "Выбрать характеристику оккультизма",
        action: "choose-occult-ability",
        activation: "special"
      }),
      utilityActivity({
        key: "occult-fate-bonus",
        name: "Оккультный бонус +1",
        action: "use-occult-points",
        actionData: { occultCost: 1, occultMessage: "Добавьте +1 к только что совершённому броску." },
        activation: "special",
        condition: "После результата атаки, проверки или спасброска, но до объявления исхода"
      })
    ),
    description: description(`
      <p>Ваш максимум очков оккультизма равен 2/4/7/9/13 на уровнях Еретика 1–5 и полностью восстанавливается после продолжительного отдыха.</p>
      <p>После результата атаки, проверки характеристики или спасброска, но до объявления исхода, потратьте 1 очко и добавьте +1. Не более одного раза на бросок.</p>
      <p>Выберите Интеллект, Мудрость или Харизму как характеристику оккультизма.</p>
    `, "ресурс хранится на этой особенности и масштабируется по уровню класса. Действие выбора сохраняет характеристику на актёре; все гнусные силы расходуют этот общий ресурс.")
  }),
  hereticFeature({
    key: "marked-by-corruption",
    name: "Отмеченный порчей",
    img: "icons/magic/unholy/hand-claw-glow-orange.webp",
    level: 1,
    requirements: "Еретик 1",
    folder: MAIN_FOLDER,
    activities: utilityActivity({
      key: "heretic-thaumaturgy",
      name: "Чудотворство",
      activation: "action"
    }),
    description: description(`
      <p>Вы изучаете чудотворство и используете для него характеристику оккультизма.</p>
      <p>Выберите три постоянных дара порчи из списка. При получении уровня можно заменить один выбранный дар.</p>
    `, "Advancement класса предлагает три дара порчи. Чудотворство представлено отдельной активностью; при необходимости импортируйте системное заклинание и назначьте выбранную характеристику.")
  }),
  hereticFeature({
    key: "vile-powers",
    name: "Гнусные силы",
    img: "icons/magic/unholy/orb-glowing-purple.webp",
    level: 1,
    requirements: "Еретик 1",
    folder: MAIN_FOLDER,
    description: description(`
      <p>Вы знаете 3/4/6/6/7 гнусных сил на уровнях Еретика 1–5. Минимум одна известная сила должна быть «Нечестивая сила», «Нечестивая кара» или «Нечестивая мощь».</p>
      <p>Сл гнусной силы = 8 + бонус мастерства + модификатор оккультизма. Модификатор атаки = бонус мастерства + модификатор оккультизма.</p>
      <p>При получении уровня в любом классе одну силу можно заменить другой с тем же требованием по уровню.</p>
    `, "выборы встроены в Advancement по правильным уровням. Модуль проверяет минимальный уровень силы и обязательное наличие одной основной силы.")
  }),
  hereticFeature({
    key: "forbidden-talent",
    name: "Запретный талант",
    img: "icons/magic/unholy/orb-rays-blue.webp",
    level: 2,
    requirements: "Еретик 2",
    folder: MAIN_FOLDER,
    description: description(`
      <p>Выберите один запретный талант на 2-м уровне и второй на 5-м. Они используются произвольно без очков оккультизма и используют Сл и модификатор атаки гнусных сил.</p>
      <p>Спасброски концентрации на заклинаниях запретных талантов совершаются с преимуществом.</p>
    `, "оба выбора встроены в Advancement. Каждая карточка таланта содержит активность-напоминание и ссылку на стандартное заклинание, если оно доступно.")
  }),
  hereticFeature({
    key: "distorted-body",
    name: "Искажённое тело",
    img: "icons/magic/unholy/strike-body-explode-disintegrate.webp",
    level: 4,
    requirements: "Еретик 4",
    folder: MAIN_FOLDER,
    description: description(`
      <p>Выберите ещё один дар «Отмеченного порчей» и одну постоянную черту искажённого тела. При получении уровня можно заменить один выбор, сделанный этой особенностью.</p>
    `, "Advancement отдельно предлагает дополнительный дар порчи и одну черту искажённого тела. Постоянные эффекты автоматизированы там, где dnd5e имеет соответствующее поле.")
  }),
  ...markDefinitions.map(definition => hereticFeature({
    ...definition,
    level: 1,
    requirements: "Еретик 1; Отмеченный порчей",
    folder: MARK_FOLDER,
    automation: { corruptionMark: true },
    description: description(definition.body, definition.automation)
  })),
  ...forbiddenTalentDefinitions.map(([key, name, body, activation]) => hereticFeature({
    key,
    name,
    img: "icons/magic/unholy/orb-rays-blue.webp",
    level: 2,
    requirements: "Еретик 2; Запретный талант",
    folder: TALENT_FOLDER,
    automation: { forbiddenTalent: true },
    activities: utilityActivity({
      key,
      name,
      activation
    }),
    description: description(`<p>${body}</p>`, "активность публикует применение таланта. Заклинание не расходует ячейку; его эффекты и концентрация отслеживаются обычными средствами Foundry.")
  })),
  ...distortedDefinitions.map(definition => hereticFeature({
    ...definition,
    level: 4,
    requirements: "Еретик 4; Искажённое тело",
    folder: BODY_FOLDER,
    automation: { distortion: true },
    description: description(definition.body, definition.automation)
  })),
  ...basePowers,
  ...levelThreePowers,
  ...levelFivePowers
];
