import {
  activeEffect,
  attackActivity,
  baseDocument,
  feature,
  folder,
  idFor,
  itemChoice,
  itemGrant,
  MODULE_ID,
  sourceData,
  utilityActivity,
} from "../common.mjs";

const SOURCE = "Трансформация: Порождение убийств / Murderspawn; PDF пользователя";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MURDERSPAWN_FOLDER = idFor("folder:murderspawn");
const OVERVIEW_FOLDER = idFor("folder:murderspawn-main-transformation");
const BOON_FOLDER = idFor("folder:murderspawn-boons");
const FLAW_FOLDER = idFor("folder:murderspawn-flaws");
const WEAPON_FOLDER = idFor("folder:murderspawn-weapons");

export const murderspawnFolders = [
  folder({ key: "murderspawn", name: "Порождение убийств", sort: 1710000 }),
  folder({ key: "murderspawn-main-transformation", name: "Основная трансформация", sort: 1711000, parent: MURDERSPAWN_FOLDER }),
  folder({ key: "murderspawn-boons", name: "Бонусы трансформации", sort: 1712000, parent: MURDERSPAWN_FOLDER }),
  folder({ key: "murderspawn-flaws", name: "Недостатки трансформации", sort: 1713000, parent: MURDERSPAWN_FOLDER }),
  folder({ key: "murderspawn-weapons", name: "Оружие трансформации", sort: 1714000, parent: MURDERSPAWN_FOLDER })
];

export const murderspawnFeatureFolders = [
  murderspawnFolders[0],
  murderspawnFolders[2],
  murderspawnFolders[3]
];

export const murderspawnWeaponFolders = [
  murderspawnFolders[0],
  murderspawnFolders[4]
];

function murderspawnFeature(options) {
  return feature({
    ...options,
    sourcePage: options.sourcePage ?? "63–65",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      transformation: "murderspawn",
      transformationLevel: options.transformationLevel ?? null,
      murderspawnFeature: true,
      ...(options.automation ?? {})
    }
  });
}

const saveDc = "8 + бонус мастерства + уровень трансформации + модификатор Силы или Ловкости";
const level2Boons = [
  "slayer-form-2",
  "let-the-slaughter-begin",
  "death-run",
  "deadly-hunter"
];
const level3Boons = [
  ...level2Boons,
  "unstoppable",
  "aura-of-carnage",
  "primal-reflexes",
  "death-craving"
];
const level4Boons = [
  ...level3Boons,
  "unkillable",
  "cacophony-of-death",
  "perfect-carving",
  "incarnation-of-murder"
];

function clawAttackActivities() {
  const activities = attackActivity();
  const activity = Object.values(activities)[0];
  activity.name = "Атака когтями";
  activity.attack.ability = "str";
  activity.target.affects.count = "1";
  activity.target.affects.type = "creature";
  return activities;
}

function murderspawnClaws({ key, name, dice, level }) {
  return baseDocument({
    key,
    name,
    type: "weapon",
    img: "icons/creatures/claws/claw-talons-glowing-orange.webp",
    folder: WEAPON_FOLDER,
    flags: {
      [MODULE_ID]: {
        murderspawnWeapon: true,
        murderspawnLevel: level,
        transformation: "murderspawn",
        transformationLevel: level
      }
    },
    system: {
      description: {
        value: `<p>Природное оружие Формы убийцы. При попадании когти наносят ${dice}к8 + модификатор Силы или Ловкости рубящего урона.</p><p><strong>Примечание:</strong> если персонаж использует Ловкость вместо Силы, переключите характеристику атаки на Ловкость на листе предмета.</p>`,
        chat: ""
      },
      source: sourceData("64", SOURCE),
      quantity: 1,
      weight: {
        value: 0,
        units: "lb"
      },
      price: {
        value: 0,
        denomination: "gp"
      },
      attunement: "",
      equipped: true,
      rarity: "",
      identified: true,
      cover: null,
      range: {
        value: null,
        long: null,
        units: "ft",
        reach: null
      },
      uses: {
        max: "",
        spent: 0,
        recovery: []
      },
      damage: {
        versatile: {
          number: null,
          denomination: null,
          bonus: "",
          types: [],
          custom: {
            enabled: false,
            formula: ""
          },
          scaling: {
            mode: "",
            number: null,
            formula: ""
          }
        },
        base: {
          number: dice,
          denomination: 8,
          bonus: "",
          types: ["slashing"],
          custom: {
            enabled: false,
            formula: ""
          },
          scaling: {
            mode: "",
            number: null,
            formula: ""
          }
        }
      },
      armor: {
        value: 10
      },
      hp: {
        value: 0,
        max: 0,
        dt: null,
        conditions: ""
      },
      properties: ["fin"],
      proficient: null,
      crewed: false,
      unidentified: {
        description: ""
      },
      type: {
        value: "simpleM",
        baseItem: ""
      },
      activities: clawAttackActivities(),
      identifier: key,
      container: null,
      attuned: false,
      ammunition: {},
      magicalBonus: null,
      mastery: ""
    }
  });
}

export const murderspawnDocuments = [
  murderspawnFeature({
    key: "murderspawn-transformation",
    name: "Трансформация: Порождение убийств / Murderspawn",
    img: "icons/creatures/abilities/mouth-teeth-long-red.webp",
    requirements: "Сила или Ловкость 13; ритуал Шабаш Смерти или наследование силы",
    folder: OVERVIEW_FOLDER,
    advancement: [
      itemGrant({
        key: "murderspawn-character-level-1",
        level: 1,
        title: "Порождение убийств I (уровни персонажа 1–5)",
        items: ["murderous-intent", "slayer-form-1", "dark-urge"],
        pack: "features"
      }),
      itemChoice({
        key: "murderspawn-character-level-6-boon",
        level: 6,
        title: "Бонус трансформации II",
        hint: "Выберите один бонус трансформации из списка бонусов II уровня или ниже. Если бонус уже есть у персонажа, выберите другой.",
        items: level2Boons,
        allowDrops: false,
        pack: "features"
      }),
      itemGrant({
        key: "murderspawn-character-level-6-flaw",
        level: 6,
        title: "Недостаток трансформации II",
        items: ["algophobia"],
        pack: "features"
      }),
      itemChoice({
        key: "murderspawn-character-level-11-boon",
        level: 11,
        title: "Бонус трансформации III",
        hint: "Выберите один бонус трансформации из списка бонусов III уровня или ниже. Если бонус уже есть у персонажа, выберите другой.",
        items: level3Boons,
        allowDrops: false,
        pack: "features"
      }),
      itemGrant({
        key: "murderspawn-character-level-11-flaw",
        level: 11,
        title: "Недостаток трансформации III",
        items: ["guilty"],
        pack: "features"
      }),
      itemChoice({
        key: "murderspawn-character-level-16-boon",
        level: 16,
        title: "Бонус трансформации IV",
        hint: "Выберите один бонус трансформации из списка бонусов IV уровня или ниже. Если бонус уже есть у персонажа, выберите другой.",
        items: level4Boons,
        allowDrops: false,
        pack: "features"
      }),
      itemGrant({
        key: "murderspawn-character-level-16-flaw",
        level: 16,
        title: "Недостаток трансформации IV",
        items: ["chosen-of-murder"],
        pack: "features"
      })
    ],
    description: `
      <p>Порождение убийств — трансформация существа, которое становится воплощением резни и предательства. Сила может быть унаследована по родословной или получена через ритуал <strong>Шабаш Смерти</strong>.</p>
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
      <p><strong>Возможные вехи уровня:</strong> убийство исключительно чистого и доброго существа; трижды поддаться Тёмному порыву; устроить ненужную массовую смерть; жестоко поступить с дорогим персонажу существом.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> перетащите на персонажа только эту основную карточку трансформации. D&D5e Advancement откроет окно прокачки на уровнях персонажа 1, 6, 11 и 16. На I уровне персонаж получает все стартовые бонусы и недостаток. На II, III и IV уровнях он выбирает один бонус из доступных бонусов текущего или предыдущих уровней и автоматически получает недостаток этого уровня. Трансформация не является классом и не добавляет уровни класса. Уровень трансформации хранится во флагах выданных карточек и выводится по максимальному уровню этих карточек. Постоянные числовые бонусы создают ActiveEffect на актёре автоматически: скорость от Смертельного бега и инициатива от Первобытных рефлексов. Убийственное намерение, выбор Силы/Ловкости, ауры, триггеры убийства и принудительное поведение ведутся Мастером вручную.</p>
    `
  }),
  murderspawnFeature({
    key: "murderous-intent",
    name: "Убийственное намерение",
    img: "icons/skills/melee/blade-tip-energy-green.webp",
    requirements: "Порождение убийств 1",
    transformationLevel: 1,
    folder: BOON_FOLDER,
    description: `
      <p>Каждый раз, когда вы наносите существу урон атакой, оно получает 1 уровень Убийственного намерения (УН). Когда у существа есть УН, вы наносите ему дополнительный 1 урон за каждый уровень УН.</p>
      <p>Существо может иметь количество уровней УН, равное удвоенному уровню вашей трансформации. После короткого или продолжительного отдыха существо теряет все уровни УН.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> уровни УН отслеживаются вручную на цели; дополнительный урон добавляется вручную или через situational bonus Midi-QOL.</p>
    `
  }),
  murderspawnFeature({
    key: "slayer-form-1",
    name: "Форма убийцы (1-й уровень)",
    img: "icons/creatures/claws/claw-talons-glowing-orange.webp",
    requirements: "Порождение убийств 1",
    transformationLevel: 1,
    folder: BOON_FOLDER,
    description: `
      <p>Ваша Сила или Ловкость увеличивается на 2, а Телосложение увеличивается на 1. Характеристика не может быть увеличена выше 16 этим способом.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> выбор Силы или Ловкости и ограничение максимума 16 применяются вручную через лист персонажа или Advancement, потому что эффект зависит от выбора игрока и текущих значений характеристик.</p>
    `
  }),
  murderspawnFeature({
    key: "dark-urge",
    name: "Тёмный порыв",
    img: "icons/magic/control/fear-fright-monster-red.webp",
    requirements: "Порождение убийств 1",
    transformationLevel: 1,
    folder: FLAW_FOLDER,
    description: `
      <p>Когда вы находитесь в пределах 20 футов от Чистого существа, вы должны совершить спасбросок Мудрости против Сл трансформации. При провале вы впадаете в транс и должны попытаться убить это существо, защищая себя по необходимости.</p>
      <p>Транс заканчивается только смертью цели, либо когда вы получаете состояние без сознания или умираете. Чистым существом считается тот, кто искренне помогает другим или не запятнан жестокостью мира.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> проверка запускается решением Мастера; спасбросок и принудительное поведение выполняются вручную.</p>
    `
  }),
  murderspawnFeature({
    key: "slayer-form-2",
    name: "Форма убийцы (2-й уровень)",
    img: "icons/creatures/magical/humanoid-silhouette-dashing-blue.webp",
    requirements: "Порождение убийств 2",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    advancement: [
      itemGrant({
        key: "slayer-form-claws-2",
        level: 6,
        title: "Когти Формы убийцы II",
        items: ["murderspawn-claws-2"],
        pack: "equipment"
      }),
      itemGrant({
        key: "slayer-form-claws-3",
        level: 11,
        title: "Когти Формы убийцы III",
        items: ["murderspawn-claws-3"],
        pack: "equipment"
      }),
      itemGrant({
        key: "slayer-form-claws-4",
        level: 16,
        title: "Когти Формы убийцы IV",
        items: ["murderspawn-claws-4"],
        pack: "equipment"
      })
    ],
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "slayer-form-2",
      name: "Принять Форму убийцы",
      activation: "bonus",
      consumeItemUse: true
    }),
    description: `
      <p>Бонусным действием вы принимаете форму существа резни. Ваш тип существа становится Чудовище. Вы не можете говорить, но можете использовать снаряжение и носить доспехи. Вернуться в нормальную форму можно бонусным действием; вы также возвращаетесь в неё, если теряете сознание или умираете.</p>
      <p>В форме ваш размер увеличивается на одну категорию, появляются две вторичные руки, максимум хитов увеличивается на 10 × уровень трансформации, а на руках вырастают когти. Когти наносят 2к8 + модификатор Силы или Ловкости рубящего урона; урон увеличивается на 1к8 за каждый уровень трансформации выше 2. Атака по лежащему ничком существу считается критическим попаданием.</p>
      <p>Для атаки когтями добавлены отдельные предметы: Когти Порождения убийств (ур. 2), Когти Порождения убийств (ур. 3) и Когти Порождения убийств (ур. 4).</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность расходует применение за продолжительный отдых. Размер, тип существа, вторичные руки, максимум хитов и автоматический крит по лежащей цели применяются вручную. Когти выдаются отдельным weapon-предметом нужного уровня.</p>
    `
  }),
  murderspawnFeature({
    key: "let-the-slaughter-begin",
    name: "Да начнётся резня",
    img: `${WOW}/Spells/Skull.png`,
    requirements: "Порождение убийств 2",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "sr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "let-the-slaughter-begin",
      name: "Да начнётся резня",
      activation: "bonus",
      consumeItemUse: true,
      rangeValue: 30,
      targetType: "creature",
      targetChoice: true
    }),
    description: `
      <p>Бонусным действием каждое существо в пределах 30 футов должно пройти спасбросок Телосложения против Сл трансформации. При провале оно поражено внутренней болью на число раундов, равное уровню трансформации: вы наносите ему +1к4 урона при попадании атакой оружия, а его скорость уменьшается вдвое.</p>
      <p>Если существо умирает под действием этой особенности, вы получаете +1 к КД до завершения короткого или продолжительного отдыха.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность расходует применение за короткий отдых и показывает дистанцию. Спасброски, замедление, дополнительный урон и бонус КД зависят от выбранных целей и смерти цели, поэтому применяются Мастером вручную.</p>
    `
  }),
  murderspawnFeature({
    key: "death-run",
    name: "Смертельный бег",
    img: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
    requirements: "Порождение убийств 2",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    effects: [activeEffect({
      key: "death-run",
      name: "Смертельный бег",
      img: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
      changes: [{ key: "system.attributes.movement.walk", type: "add", value: "10", priority: 20 }]
    })],
    description: `
      <p>Ваша скорость ходьбы увеличивается на 10 футов. Кроме того, когда вы убиваете существо атакой, вы можете переместиться на расстояние вашей скорости к другому существу и совершить по нему дополнительную рукопашную атаку. Эта атака наносит двойной урон.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> переносимый эффект автоматически добавляет +10 футов к скорости ходьбы. Перемещение после убийства, дополнительная атака и двойной урон выполняются вручную, потому что зависят от конкретного убийства и выбранной новой цели.</p>
    `
  }),
  murderspawnFeature({
    key: "deadly-hunter",
    name: "Смертоносный охотник",
    img: "icons/magic/perception/silhouette-stealth-shadow.webp",
    requirements: "Порождение убийств 2; дополнительный бонус трансформации",
    transformationLevel: 2,
    folder: BOON_FOLDER,
    description: `
      <p>Когда вы убиваете существо, вы становитесь невидимым до конца вашего следующего хода или пока не совершите атаку либо не наложите заклинание.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> состояние невидимости накладывается вручную после подтверждённого убийства.</p>
    `
  }),
  murderspawnFeature({
    key: "algophobia",
    name: "Алгофобия",
    img: "icons/magic/control/fear-fright-white.webp",
    requirements: "Порождение убийств 2",
    transformationLevel: 2,
    folder: FLAW_FOLDER,
    description: `
      <p>Когда вы получаете урон от критического удара или от одного источника получаете урон, равный половине ваших хитов, совершите спасбросок Мудрости против Сл трансформации. При провале на 1 минуту вы впадаете в безумное состояние и должны атаковать ближайшее существо, пока не получите состояние без сознания.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> триггер зависит от входящего урона и текущих хитов; спасбросок и принудительный выбор цели выполняются вручную.</p>
    `
  }),
  murderspawnFeature({
    key: "unstoppable",
    name: "Неудержимый",
    img: "icons/magic/defensive/shield-barrier-flaming-diamond-red.webp",
    requirements: "Порождение убийств 3",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    uses: {
      max: "3",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "unstoppable",
      name: "Снизить полученный урон до 1",
      activation: "special",
      consumeItemUse: true
    }),
    description: `
      <p>Когда вы получаете урон, вы уменьшаете количество полученного урона до 1. Число применений равно уровню трансформации за продолжительный отдых.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность расходует одно применение. Модуль синхронизирует максимум применений с текущим уровнем трансформации, определяя его по выданным карточкам Порождения убийств. Само уменьшение входящего урона применяется вручную, чтобы Мастер мог выбрать момент использования после просмотра источника урона.</p>
    `
  }),
  murderspawnFeature({
    key: "aura-of-carnage",
    name: "Аура резни",
    img: "icons/magic/unholy/orb-glowing-yellow-purple.webp",
    requirements: "Порождение убийств 3",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    activities: utilityActivity({ key: "choose-carnage-aura-type", name: "Выбрать тип уязвимости ауры", action: "choose-carnage-aura-type", activation: "special", spellSlot: false }),
    description: `
      <p>Пока вы в сознании, любое существо в пределах 15 футов от вас уязвимо к одному типу урона: дробящему, колющему или рубящему. Вы выбираете тип после завершения продолжительного отдыха.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> после продолжительного отдыха выберите дробящий, колющий или рубящий урон кнопкой в карточке. Привязанная к токену область радиусом 15 футов автоматически накладывает выбранную уязвимость на всех существ внутри, включая владельца («любое существо»). При выходе, потере сознания источника или удалении особенности уязвимость снимается; собственные уязвимости целей сохраняются. Перемещение не запускает отдельный бросок урона: выбранный тип учитывается при обычном применении урона D&D5e/Midi-QOL.</p>
    `
  }),
  murderspawnFeature({
    key: "primal-reflexes",
    name: "Первобытные рефлексы",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    requirements: "Порождение убийств 3",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    effects: [activeEffect({
      key: "primal-reflexes",
      name: "Первобытные рефлексы",
      img: "icons/skills/movement/arrow-upward-yellow.webp",
      changes: [{ key: "system.attributes.init.bonus", type: "add", value: "10", priority: 20 }]
    })],
    description: `
      <p>Вы получаете +10 к проверкам инициативы. Кроме того, теперь вы совершаете реакцию за каждый боевой ход.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> переносимый эффект автоматически добавляет +10 к инициативе. Дополнительные реакции отслеживаются вручную, потому что Foundry не поддерживает безопасное штатное увеличение числа реакций по ходам разных существ.</p>
    `
  }),
  murderspawnFeature({
    key: "death-craving",
    name: "Жажда смерти",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    requirements: "Порождение убийств 3; дополнительный бонус трансформации",
    transformationLevel: 3,
    folder: BOON_FOLDER,
    description: `
      <p>Когда существо теряет четверть своих хитов, число, необходимое вам для критического попадания по нему, уменьшается на 1. Эффект срабатывает снова, когда существо теряет половину и три четверти хитов, суммарно снижая порог критического попадания до 3. Особенность складывается с другими эффектами, снижающими порог критического попадания.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> изменение порога критического попадания зависит от процента хитов конкретной цели, поэтому применяется вручную на выбранных атаках.</p>
    `
  }),
  murderspawnFeature({
    key: "guilty",
    name: "Виновный",
    img: "icons/magic/death/undead-ghost-scream-teal.webp",
    requirements: "Порождение убийств 3",
    transformationLevel: 3,
    folder: FLAW_FOLDER,
    description: `
      <p>Духи и воспоминания убитых преследуют вас. Если вы не убили существо в течение последних 6 часов, вы совершаете все проверки характеристик с помехой.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> помеха включается вручную, потому что модуль не может надёжно определить, какое убийство засчитывается и когда прошло 6 часов игрового времени.</p>
    `
  }),
  murderspawnFeature({
    key: "unkillable",
    name: "Неубиваемый",
    img: "icons/magic/death/skull-energy-light-white.webp",
    requirements: "Порождение убийств 4; Неудержимый",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "unkillable",
      name: "Отвергнуть смерть",
      activation: "special",
      consumeItemUse: true
    }),
    description: `
      <p>Если ваши хиты уменьшаются до 0, вы не умираете и не теряете сознание. Вместо этого бросьте все ваши кости хитов и восстановите сумму результата. Вы восстанавливаете применение после продолжительного отдыха.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность расходует применение. Бросок костей хитов и восстановление хитов выполняются вручную, потому что нужно использовать текущий пул костей хитов персонажа.</p>
    `
  }),
  murderspawnFeature({
    key: "cacophony-of-death",
    name: "Какофония смерти",
    img: "icons/magic/sonic/explosion-shock-wave-teal.webp",
    requirements: "Порождение убийств 4",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "cacophony-of-death",
      name: "Какофония смерти",
      activation: "action",
      consumeItemUse: true
    }),
    description: `
      <p>Действием вы заставляете любое существо с уровнем Убийственного намерения совершить спасбросок Телосложения против Сл трансформации, расходуя все уровни УН на этих существах. При провале существо получает 1к12 урона за каждый израсходованный уровень УН; при успехе — половину. Если существо концентрировалось на заклинании и получило урон от этой особенности, оно немедленно теряет концентрацию.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность расходует применение за продолжительный отдых. Уровни УН, число к12 по каждой цели и потеря концентрации применяются вручную.</p>
    `
  }),
  murderspawnFeature({
    key: "perfect-carving",
    name: "Идеальная разделка",
    img: "icons/skills/wounds/blood-cells-vessel-red-orange.webp",
    requirements: "Порождение убийств 4",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    description: `
      <p>Когда вы уменьшаете хиты существа до значения 5 × ваш уровень трансформации или ниже, существо немедленно умирает. Когда вы используете эту особенность, каждое существо в пределах 20 футов от вас должно совершить спасбросок Мудрости против Сл трансформации или стать испуганным на 1 минуту. Цель может повторять спасбросок в конце каждого своего хода.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> мгновенная смерть и страх применяются вручную после подтверждения текущих хитов цели.</p>
    `
  }),
  murderspawnFeature({
    key: "incarnation-of-murder",
    name: "Воплощение убийства",
    img: `${WOW}/Spells/BrokenHeart.png`,
    requirements: "Порождение убийств 4; дополнительный бонус трансформации",
    transformationLevel: 4,
    folder: BOON_FOLDER,
    activities: utilityActivity({
      key: "incarnation-of-murder-healing",
      name: "Лечение от рукопашной атаки",
      activation: "special",
      rollFormula: "1d6",
      rollName: "Восстановление хитов",
      rollVisible: true
    }),
    description: `
      <p>Каждый раз, когда вы наносите урон существу рукопашной атакой, вы восстанавливаете 1к6 хитов.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность бросает 1к6 восстановления; применение лечения запускается вручную после подходящей рукопашной атаки.</p>
    `
  }),
  murderspawnFeature({
    key: "chosen-of-murder",
    name: "Избранный убийцы",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    requirements: "Порождение убийств 4",
    transformationLevel: 4,
    folder: FLAW_FOLDER,
    description: `
      <p>После успешного сопротивления Тёмному порыву следующий раз, когда вы окажетесь без сознания, вы должны совершить спасбросок Мудрости со Сл 10. При провале вы подвергаетесь Алгофобии. Каждый раз, когда вы преуспеваете в этом спасброске, Сл увеличивается на 1 каждую ночь, пока вы не провалитесь; после провала Сл сбрасывается до 10.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> накопление Сл и проверка во сне отслеживаются вручную, потому что зависят от сюжетных событий и сна персонажа.</p>
    `
  }),
  murderspawnClaws({
    key: "murderspawn-claws-2",
    name: "Когти Порождения убийств (ур. 2)",
    dice: 2,
    level: 2
  }),
  murderspawnClaws({
    key: "murderspawn-claws-3",
    name: "Когти Порождения убийств (ур. 3)",
    dice: 3,
    level: 3
  }),
  murderspawnClaws({
    key: "murderspawn-claws-4",
    name: "Когти Порождения убийств (ур. 4)",
    dice: 4,
    level: 4
  })
];

export const murderspawnTransformationDocuments = murderspawnDocuments
  .filter(document => document.system?.identifier === "murderspawn-transformation")
  .map(document => ({
    ...document,
    folder: null
  }));

export const murderspawnFeatureDocuments = murderspawnDocuments.filter(
  document => document.type === "feat" && document.system?.identifier !== "murderspawn-transformation"
);

export const murderspawnWeaponDocuments = murderspawnDocuments.filter(document => document.type === "weapon");
