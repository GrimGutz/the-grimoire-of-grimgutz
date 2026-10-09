import {
  activeEffect,
  feature,
  folder,
  idFor,
  itemChoice,
  itemGrant,
  utilityActivity,
} from "../common.mjs";

const SOURCE = "Трансформация: Полый / Hollow; PDF пользователя Transformation_hollow.pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const HOLLOW_FOLDER = idFor("folder:hollow");
const OVERVIEW_FOLDER = idFor("folder:hollow-main-transformation");
const BOON_FOLDER = idFor("folder:hollow-boons");
const FLAW_FOLDER = idFor("folder:hollow-flaws");

export const hollowFolders = [
  folder({ key: "hollow", name: "Полый", sort: 1720000 }),
  folder({ key: "hollow-main-transformation", name: "Основная трансформация", sort: 1721000, parent: HOLLOW_FOLDER }),
  folder({ key: "hollow-boons", name: "Бонусы трансформации", sort: 1722000, parent: HOLLOW_FOLDER }),
  folder({ key: "hollow-flaws", name: "Недостатки трансформации", sort: 1723000, parent: HOLLOW_FOLDER })
];

export const hollowFeatureFolders = [
  hollowFolders[0],
  hollowFolders[2],
  hollowFolders[3]
];

function hollowFeature(options) {
  return feature({
    ...options,
    sourcePage: options.sourcePage ?? "61–64",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      transformation: "hollow",
      transformationLevel: options.transformationLevel ?? null,
      hollowFeature: true,
      ...(options.automation ?? {})
    }
  });
}

function hollowActivity({ key, name, cost, min, max, formula, damageType, message, consumeFeatureUse = false, ...activity }) {
  return utilityActivity({
    key,
    name,
    action: "use-hollow-charges",
    actionData: {
      hollowCost: cost,
      hollowMin: min,
      hollowMax: max,
      hollowFormula: formula,
      hollowDamageType: damageType,
      hollowMessage: message,
      hollowConsumeFeatureUse: consumeFeatureUse
    },
    ...activity
  });
}

const saveDc = "8 + бонус мастерства + модификатор Телосложения";
const level2Boons = [
  "spellburn",
  "masking-aura",
  "negative-gaze",
  "destructive-strikes"
];
const level3Boons = [
  ...level2Boons,
  "spell-weakening",
  "fortified-soul",
  "dispelling",
  "negative-shroud"
];
const level4Boons = [
  ...level3Boons,
  "supreme-curse",
  "wound-in-magic",
  "mystic-annihilation",
  "ether-destroyer"
];

export const hollowDocuments = [
  hollowFeature({
    key: "hollow-transformation",
    name: "Трансформация: Полый / Hollow",
    img: `${WOW}/Spells/AntiMagicZone.png`,
    requirements: "Телосложение 13; становление раной в магии",
    folder: OVERVIEW_FOLDER,
    advancement: [
      itemGrant({
        key: "hollow-character-level-1",
        level: 1,
        title: "Полый I (уровни персонажа 1–5)",
        items: ["magic-eradicator", "negative-body", "hollow-soul"],
        pack: "features"
      }),
      itemChoice({
        key: "hollow-character-level-6-boon",
        level: 6,
        title: "Бонус трансформации II",
        hint: "Выберите один бонус трансформации из списка бонусов II уровня или ниже. Если бонус уже есть у персонажа, выберите другой.",
        items: level2Boons,
        pack: "features"
      }),
      itemGrant({
        key: "hollow-character-level-6-flaw",
        level: 6,
        title: "Недостаток трансформации II",
        items: ["magic-incompatibility"],
        pack: "features"
      }),
      itemChoice({
        key: "hollow-character-level-11-boon",
        level: 11,
        title: "Бонус трансформации III",
        hint: "Выберите один бонус трансформации из списка бонусов III уровня или ниже. Если бонус уже есть у персонажа, выберите другой.",
        items: level3Boons,
        pack: "features"
      }),
      itemGrant({
        key: "hollow-character-level-11-flaw",
        level: 11,
        title: "Недостаток трансформации III",
        items: ["resistant-body"],
        pack: "features"
      }),
      itemChoice({
        key: "hollow-character-level-16-boon",
        level: 16,
        title: "Бонус трансформации IV",
        hint: "Выберите один бонус трансформации из списка бонусов IV уровня или ниже. Если бонус уже есть у персонажа, выберите другой.",
        items: level4Boons,
        pack: "features"
      }),
      itemGrant({
        key: "hollow-character-level-16-flaw",
        level: 16,
        title: "Недостаток трансформации IV",
        items: ["magical-inhibition"],
        pack: "features"
      })
    ],
    description: `
      <p>Полые — живые раны в магии, существа, накопившие в теле частицы анти-магии. Их присутствие искажает заклинания, разрушает магические эффекты и постепенно делает их самих нестабильными.</p>
      <p><strong>Сл спасброска трансформации:</strong> ${saveDc}.</p>
      <table>
        <thead><tr><th>Уровень персонажа</th><th>Уровень трансформации</th><th>Advancement</th></tr></thead>
        <tbody>
          <tr><td>1–5</td><td>I</td><td>открывается на 1-м уровне персонажа</td></tr>
          <tr><td>6–10</td><td>II</td><td>открывается на 6-м уровне персонажа</td></tr>
          <tr><td>11–15</td><td>III</td><td>открывается на 11-м уровне персонажа</td></tr>
          <tr><td>16–20</td><td>IV</td><td>открывается на 16-м уровне персонажа</td></tr>
        </tbody>
      </table>
      <p><strong>Возможные вехи уровня:</strong> убить могущественное магическое существо; убить могущественного мага; уничтожить источник магии.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> перетащите на персонажа только эту основную карточку. D&D5e Advancement выдаёт стартовые особенности на 1-м уровне персонажа и открывает выбор бонуса на 6, 11 и 16 уровнях. На II, III и IV уровнях персонаж выбирает один бонус из текущего или предыдущих уровней и автоматически получает недостаток уровня. «Истребитель магии» хранит Заряды Анти-Магии; активности проверяют и списывают заряды. Постоянные эффекты Полого создаются на актёре автоматически: «Негативное тело», «Аура маскировки», «Негативный взгляд», «Укреплённая душа» и «Рана в магии». Условные спасброски, ауры на союзников/врагов и эффекты нестабильности подтверждаются Мастером.</p>
    `
  }),
  hollowFeature({
    key: "magic-eradicator",
    name: "Истребитель магии",
    img: `${WOW}/Spells/ConsumeMagic.png`,
    requirements: "Полый 1",
    transformationLevel: 1,
    folder: BOON_FOLDER,
    uses: {
      max: "99",
      spent: 99,
      recovery: []
    },
    activities: Object.assign(
      {},
      utilityActivity({
        key: "gain-hollow-charge",
        name: "Накопить 1 Заряд Анти-Магии",
        action: "gain-hollow-charge",
        activation: "special"
      }),
      hollowActivity({
        key: "hollow-veil",
        name: "Пелена",
        cost: 2,
        formula: "{level}d6",
        damageType: "force",
        message: "Пелена наносит силовой урон, равный количеству d6 по уровню трансформации.",
        activation: "special",
        condition: "При попадании атакой",
        targetType: "creature",
        targetCount: "1"
      }),
      hollowActivity({
        key: "hollow-resistance",
        name: "Сопротивление",
        cost: 3,
        message: "Бросьте дополнительный d20 против заклинания или магического эффекта и используйте лучший результат.",
        activation: "special",
        condition: "Когда вы вынуждены совершить спасбросок против заклинания или магического эффекта"
      }),
      hollowActivity({
        key: "hollow-dispersal",
        name: "Рассеивание",
        cost: "all",
        formula: "{cost}",
        damageType: "force",
        message: "Все существа в пределах 15 футов совершают спасбросок Телосложения; при успехе получают половину урона.",
        activation: "bonus",
        rangeValue: 15,
        targetType: "creature",
        targetChoice: true
      })
    ),
    description: `
      <p>Вы получаете и храните <strong>Заряды Анти-Магии</strong>, которые используются способностями Полого. «Полая душа» генерирует 1 заряд каждый час.</p>
      <ul>
        <li><strong>Пелена (2 заряда).</strong> При попадании атакой потратьте 2 заряда, чтобы нанести силовой урон: 1к6 за каждый уровень трансформации.</li>
        <li><strong>Сопротивление (3 заряда).</strong> Когда вы совершаете спасбросок против заклинания или магического эффекта, потратьте 3 заряда, чтобы бросить дополнительный d20 и использовать лучший результат.</li>
        <li><strong>Рассеивание (все доступные заряды).</strong> Бонусным действием потратьте все текущие заряды. Каждое существо в пределах 15 футов совершает спасбросок Телосложения против Сл трансформации и получает силовой урон, равный числу потраченных зарядов, или половину при успехе.</li>
      </ul>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> ресурс этой карточки хранит текущие Заряды Анти-Магии как оставшиеся применения. Активность «Накопить 1 заряд» добавляет заряд; остальные активности проверяют и списывают требуемое количество. Автоматическое почасовое накопление не включено, потому что Foundry без календаря не знает, когда прошёл час игрового времени.</p>
    `
  }),
  hollowFeature({
    key: "negative-body",
    name: "Негативное тело",
    img: `${WOW}/Spells/ChargeNegative.png`,
    requirements: "Полый 1",
    transformationLevel: 1,
    folder: BOON_FOLDER,
    effects: [activeEffect({
      key: "negative-body",
      name: "Негативное тело",
      img: `${WOW}/Spells/ChargeNegative.png`,
      changes: [
        { key: "system.abilities.con.value", type: "add", value: "2", priority: 20 },
        { key: "system.abilities.wis.value", type: "add", value: "1", priority: 20 }
      ]
    })],
    description: `
      <p>Ваше Телосложение увеличивается на 2, а Мудрость увеличивается на 1. Характеристика не может быть увеличена выше 16 таким образом.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> модуль создаёт Active Effect на актёре и рассчитывает фактическое повышение от исходных значений характеристик, чтобы не поднять Телосложение или Мудрость выше 16.</p>
    `
  }),
  hollowFeature({
    key: "hollow-soul",
    name: "Полая душа",
    img: `${WOW}/Spells/SoulGem.png`,
    requirements: "Полый 1",
    transformationLevel: 1,
    folder: FLAW_FOLDER,
    description: `
      <p>Вы генерируете 1 Заряд Анти-Магии каждый час. Накопление слишком большого числа зарядов вводит вас в нестабильное состояние.</p>
      <ul>
        <li><strong>10+ зарядов.</strong> При провале спасброска против заклинания или магического эффекта вы получаете заряды, равные уровню заклинания или УС существа; при успехе — половину.</li>
        <li><strong>20+ зарядов.</strong> Вы не можете накладывать заклинания, использовать магические эффекты или магические предметы.</li>
        <li><strong>30+ зарядов.</strong> Вы получаете 1к6 некротического урона за каждое действие или бонусное действие, не требующее зарядов.</li>
      </ul>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> используйте активность «Накопить 1 Заряд Анти-Магии» на особенности «Истребитель магии». Эффекты нестабильности зависят от источника магии и действий персонажа, поэтому применяются Мастером вручную.</p>
    `
  }),
  hollowFeature({
    key: "spellburn",
    name: "Выжигание заклинаний",
    img: `${WOW}/Spells/ManaBurn.png`,
    requirements: "Полый 2",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    activities: hollowActivity({
      key: "spellburn",
      name: "Выжечь ячейки заклинаний",
      cost: 6,
      message: "Цель совершает спасбросок Телосложения; при провале бросьте 1d6 и уничтожьте выбранные ячейки заклинаний с суммарным уровнем, равным результату.",
      activation: "special",
      condition: "После попадания рукопашной атакой оружием",
      targetType: "creature",
      targetCount: "1"
    }),
    description: `
      <p>За 6 зарядов после попадания рукопашной атакой оружием вы можете заставить заклинателя совершить спасбросок Телосложения против Сл трансформации. При провале бросьте 1к6; цель теряет ячейки заклинаний на ваш выбор с суммарным уровнем, равным результату.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность проверяет и списывает 6 Зарядов Анти-Магии. Спасбросок и удаление ячеек выбранной цели выполняются вручную.</p>
    `
  }),
  hollowFeature({
    key: "masking-aura",
    name: "Аура маскировки",
    img: `${WOW}/Spells/AntiMagicShell.png`,
    requirements: "Полый 2",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    description: `
      <p>Любое существо в пределах 10 футов от вас не может быть обнаружено заклинаниями или другими магическими средствами. Союзники в этой ауре получают бонус к спасброскам, равный вашему модификатору Телосложения.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> модуль создаёт эффект-маркер на владельце. Бонус союзникам применяется вручную или отдельным эффектом на союзнике, потому что он зависит от текущей дистанции до Полого.</p>
    `
  }),
  hollowFeature({
    key: "negative-gaze",
    name: "Негативный взгляд",
    img: `${WOW}/Spells/EvilEye.png`,
    requirements: "Полый 2",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    description: `
      <p>Вы всегда находитесь под действием заклинания <em>обнаружение магии</em>. Кроме того, вы можете накладывать <em>определение</em> по желанию: дальность 60 футов, мгновенное наложение, и при цели-существе вы точно узнаёте его текущие хиты и ячейки заклинаний. Вы можете использовать эти свойства даже под действием антимагического поля.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> модуль создаёт эффект-маркер на владельце. Информацию о хитах, ячейках и магических эффектах сообщает Мастер.</p>
    `
  }),
  hollowFeature({
    key: "destructive-strikes",
    name: "Разрушающие удары",
    img: `${WOW}/Spells/MagicDamage.png`,
    requirements: "Полый 2; дополнительный бонус трансформации",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    description: `
      <p>Когда вы попадаете по существу и наносите ему урон, оно совершает проверки концентрации на заклинания и другие магические эффекты с помехой. Урон этой атакой проходит через все магические барьеры и временные хиты из-за вашей антимагической природы.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> помеха концентрации и обход временных хитов/барьеров зависят от цели и источника эффекта, поэтому применяются Мастером вручную.</p>
    `
  }),
  hollowFeature({
    key: "magic-incompatibility",
    name: "Магическая несовместимость",
    img: `${WOW}/Spells/NullWard.png`,
    requirements: "Полый 2",
    transformationLevel: 2,
    folder: FLAW_FOLDER,
    description: `
      <p>Вы не можете установить связь через Укреплённую Душу. Настройка на магические предметы требует полной концентрации в течение нескольких дней: обычный — 1 день, необычный — 2, редкий — 3, очень редкий — 4, легендарный — 5, артефакт — 7 дней.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> настройка предметов и длительность концентрации отслеживаются вручную.</p>
    `
  }),
  hollowFeature({
    key: "spell-weakening",
    name: "Ослабление чар",
    img: `${WOW}/Spells/SpellWarding.png`,
    requirements: "Полый 3",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    activities: hollowActivity({
      key: "spell-weakening",
      name: "Ослабить заклинание",
      cost: 3,
      message: "Выберите существо в пределах 60 футов; в течение следующей минуты его заклинание получает остаточную анти-магию.",
      activation: "special",
      rangeValue: 60,
      targetType: "creature",
      targetCount: "1"
    }),
    description: `
      <p>При использовании способности, требующей зарядов, вы можете потратить 3 дополнительных заряда, чтобы оставить остаточную анти-магию. Выберите существо в пределах 60 футов; в течение следующей минуты, когда оно накладывает заклинание, оно получает урон, равный уровню заклинания, и должно использовать ячейку более высокого уровня, иначе заклинание не срабатывает.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность списывает 3 дополнительных заряда и напоминает применить эффект к выбранному существу. Урон и проверка уровня ячейки выполняются вручную.</p>
    `
  }),
  hollowFeature({
    key: "fortified-soul",
    name: "Укреплённая душа",
    img: `${WOW}/Spells/ResistMagic.png`,
    requirements: "Полый 3",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    effects: [activeEffect({
      key: "fortified-soul",
      name: "Укреплённая душа",
      img: `${WOW}/Spells/ResistMagic.png`,
      changes: []
    })],
    description: `
      <p>Вы получаете сопротивление урону от заклинаний.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активный эффект включает обработчик Midi-QOL: урон от заклинаний уменьшается вдвое с округлением вниз. Уже применённое сопротивление типу урона не складывается с этим сопротивлением. Без Midi-QOL уменьшение подтверждается Мастером.</p>
    `
  }),
  hollowFeature({
    key: "dispelling",
    name: "Рассеивание",
    img: `${WOW}/Spells/DISPELMAGIC.png`,
    requirements: "Полый 3",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    activities: hollowActivity({
      key: "dispelling",
      name: "Аннулировать заклинание",
      min: 2,
      max: 10,
      message: "Потратьте заряды, равные удвоенному уровню заклинания, чтобы полностью аннулировать его.",
      activation: "reaction",
      rangeValue: 60,
      targetType: "creature",
      targetCount: "1",
      condition: "Существо в пределах 60 футов накладывает заклинание"
    }),
    description: `
      <p>Реакцией, увидев существо, накладывающее заклинание в пределах 60 футов, вы можете потратить количество зарядов, равное удвоенному уровню заклинания, чтобы полностью аннулировать его, максимум 10 зарядов.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность позволяет выбрать и списать 2–10 зарядов. Отмена заклинания подтверждается Мастером.</p>
    `
  }),
  hollowFeature({
    key: "negative-shroud",
    name: "Негативная пелена",
    img: `${WOW}/Spells/NetherCloak.png`,
    requirements: "Полый 3; дополнительный бонус трансформации",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    activities: hollowActivity({
      key: "negative-shroud",
      name: "Негативная пелена",
      cost: 8,
      message: "Бросьте d20; при 11+ вы преуспеваете в спасброске и не получаете урона от аннулированной магии.",
      activation: "reaction",
      condition: "Когда вы становитесь целью заклинания"
    }),
    description: `
      <p>За 8 зарядов реакцией, когда вы становитесь целью заклинания, бросьте d20. При результате 11 или выше вы преуспеваете в спасброске и не получаете урона, так как магия обращается вокруг вас.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность списывает 8 зарядов. Бросок d20 и отмена урона выполняются вручную после результата.</p>
    `
  }),
  hollowFeature({
    key: "resistant-body",
    name: "Резистентное тело",
    img: `${WOW}/Spells/MagicImmunity.png`,
    requirements: "Полый 3",
    transformationLevel: 3,
    folder: FLAW_FOLDER,
    description: `
      <p>Когда союзник накладывает на вас заклинание или вызывает на вас магический эффект, а у вас 15 зарядов или больше, вы должны совершить спасбросок Телосложения против Сл трансформации, чтобы получить преимущества заклинания или эффекта. Заклинания регенерации и воскрешения имеют 33% шанс провалиться.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> проверка зависит от источника эффекта и текущего количества зарядов, поэтому выполняется Мастером вручную.</p>
    `
  }),
  hollowFeature({
    key: "supreme-curse",
    name: "Высшее проклятие",
    img: `${WOW}/Spells/Curse.png`,
    requirements: "Полый 4",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: hollowActivity({
      key: "supreme-curse",
      name: "Высшее проклятие",
      cost: 10,
      consumeFeatureUse: true,
      message: "Цель совершает спасбросок Телосложения; при провале получает 1d4+1 раундов отделения от магической энергии.",
      activation: "special",
      condition: "После попадания рукопашной атакой",
      targetType: "creature",
      targetCount: "1"
    }),
    description: `
      <p>За 10 зарядов после попадания рукопашной атакой вы можете заставить цель совершить спасбросок Телосложения. При провале анти-магия окружает её на 1к4+1 раунд: она не может накладывать заклинания, теряет концентрацию на заклинаниях, а её магические предметы становятся обычными, если они не легендарные и не артефакты. Использование восстанавливается после продолжительного отдыха.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность расходует 10 зарядов и одно применение за продолжительный отдых. Спасбросок, длительность и отключение магических предметов применяются вручную.</p>
    `
  }),
  hollowFeature({
    key: "wound-in-magic",
    name: "Рана в магии",
    img: `${WOW}/Spells/AntiMagicZone.png`,
    requirements: "Полый 4",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    description: `
      <p>Любой враг в радиусе 10 футов от вас, который накладывает заклинание, должен бросить d20; при результате 9 или ниже его заклинание не срабатывает.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> модуль создаёт эффект-маркер на владельце. Бросок d20 выполняется вручную для врагов в радиусе 10 футов, потому что эффект зависит от позиции и враждебности существа.</p>
    `
  }),
  hollowFeature({
    key: "mystic-annihilation",
    name: "Мистическая аннуляция",
    img: `${WOW}/Spells/MassDispel.png`,
    requirements: "Полый 4",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    activities: hollowActivity({
      key: "mystic-annihilation",
      name: "Антимагическое поле",
      cost: 15,
      message: "Наложите антимагическое поле радиусом 20 футов.",
      activation: "action",
      rangeValue: 20,
      targetType: "creature",
      targetChoice: true
    }),
    description: `
      <p>Действием за 15 зарядов вы накладываете <em>антимагическое поле</em> с радиусом 20 футов. Вы можете использовать эту способность даже если не можете накладывать заклинания, например под действием антимагического поля или способности первого уровня.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность списывает 15 зарядов. Шаблон и подавление магии применяются Мастером по правилам антимагического поля.</p>
    `
  }),
  hollowFeature({
    key: "ether-destroyer",
    name: "Уничтожитель эфира",
    img: `${WOW}/Spells/AbolishMagic.png`,
    requirements: "Полый 4; дополнительный бонус трансформации",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    activities: hollowActivity({
      key: "ether-destroyer",
      name: "Уничтожить магическую особенность",
      cost: 10,
      message: "При провале спасброска Телосложения выберите одно заклинание или магическую особенность цели; цель теряет доступ к ней на неопределённый срок.",
      activation: "special",
      condition: "При попадании рукопашной атакой",
      targetType: "creature",
      targetCount: "1"
    }),
    description: `
      <p>При попадании рукопашной атакой вы можете потратить 10 зарядов, чтобы заставить цель совершить спасбросок Телосложения. При провале выберите одно заклинание или магическую особенность цели; цель теряет доступ к этой особенности на неопределённый срок, если не получит <em>снятие проклятия</em> или не изучит/получит заклинание заново.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность списывает 10 зарядов. Выбор потерянной особенности и восстановление доступа выполняются Мастером вручную.</p>
    `
  }),
  hollowFeature({
    key: "magical-inhibition",
    name: "Магическое ингибирование",
    img: `${WOW}/Spells/WispSplodeGreen.png`,
    requirements: "Полый 4",
    transformationLevel: 4,
    folder: FLAW_FOLDER,
    description: `
      <p>При провале спасброска против заклинания или магического эффекта на 5 или больше вокруг вас формируется зона нестабильности радиусом 20 футов. Бросьте d4: появляются Охотники на Магов, заклинатели получают урон, область запрещает магию или существа в области становятся устойчивыми к заклинаниям. За каждые 10 текущих зарядов происходит дополнительный эффект.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> зона и результат d4 создаются Мастером вручную, потому что эффект меняет окружающую сцену и может призывать существ.</p>
    `
  })
];

export const hollowTransformationDocuments = hollowDocuments
  .filter(document => document.system?.identifier === "hollow-transformation")
  .map(document => ({
    ...document,
    folder: null
  }));

export const hollowFeatureDocuments = hollowDocuments.filter(
  document => document.type === "feat" && document.system?.identifier !== "hollow-transformation"
);
