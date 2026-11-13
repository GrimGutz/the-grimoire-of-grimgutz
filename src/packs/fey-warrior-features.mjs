import {
  activeEffect,
  feature,
  fixedAbilityScoreAdvancement,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Воитель фей; предоставленный PDF PK_Feyskiy_voitel (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:fey-warrior-features");
const TRAIT_FOLDER = idFor("folder:fey-warrior-traits");

export const feyWarriorFolders = [
  folder({ key: "fey-warrior-features", name: "Воитель фей: классовые особенности", sort: 1010000 }),
  folder({ key: "fey-warrior-traits", name: "Воитель фей: черты фей", sort: 1020000 })
];

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function srUses() {
  return {
    max: "1",
    spent: 0,
    recovery: [
      { period: "sr", type: "recoverAll" },
      { period: "lr", type: "recoverAll" }
    ]
  };
}

function feyWarriorFeature({
  key,
  name,
  img,
  level,
  folder: targetFolder = MAIN_FOLDER,
  description: value,
  uses = null,
  activities = {},
  effects = [],
  advancement = [],
  automation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Воитель фей ${level}`,
    folder: targetFolder,
    uses,
    activities,
    effects,
    advancement,
    automation: {
      feature: key,
      feyWarriorFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "1–5",
    sourceCustom: SOURCE,
    description: value
  });
}

function feyTrait(options) {
  return feyWarriorFeature({
    ...options,
    level: options.level ?? 2,
    folder: TRAIT_FOLDER,
    automation: {
      feyTrait: true,
      ...(options.automation ?? {})
    }
  });
}

export const feyWarriorDocuments = [
  feyWarriorFeature({
    key: "fey-transformation",
    name: "Трансформация в фею",
    img: `${WOW}/Spells/GiftoftheWild.png`,
    level: 1,
    description: description(`
      <p>Ваше тело медленно приспосабливается к первым изменениям, вызванным причудливой магией фэйри. На 1 уровне вы получаете черту <strong>Маска</strong>. На 2, 3 и 5 уровнях вы выбираете ещё по одной черте феи.</p>
      <p>Вместе с дарами вы также получаете слабость к холодному железу: предметы из него ощущаются неприятно горячими и через несколько мгновений причиняют боль.</p>
    `, "черта «Маска» выдаётся автоматически на 1 уровне, а выбор дополнительных черт встроен в Advancement класса. Слабость к холодному железу оставлена как правило карточки, потому что dnd5e не имеет стандартного типа материала «холодное железо».")
  }),
  feyWarriorFeature({
    key: "fey-warrior-cantrips",
    name: "Заговоры Воителя фей",
    img: `${WOW}/Spells/StudentOfMagic.png`,
    level: 1,
    activities: utilityActivity({
      key: "fey-warrior-cantrips",
      name: "Таблица заговоров",
      activation: "special"
    }),
    description: description(`
      <p>Вы изучаете один заговор из списка заклинаний любого класса. На более высоких уровнях количество известных заговоров указано в таблице Воителя фей: 1 на 1–2 уровне, 2 на 3–4 уровне, 3 на 5 уровне.</p>
      <p>Заклинательная характеристика для этих заговоров — Харизма.</p>
    `, "класс добавляет ScaleValue «Заговоры». Сами заговоры выберите и добавьте вручную из нужных списков заклинаний, потому что PDF разрешает брать их из любого класса.")
  }),
  feyWarriorFeature({
    key: "call-of-feywild",
    name: "Зов Страны Фей",
    img: `${WOW}/Spells/FaerieFire.png`,
    level: 1,
    activities: utilityActivity({
      key: "call-of-feywild",
      name: "Почувствовать фей",
      activation: "special",
      condition: "Мгновенно в 30 футах или после 1 часа медитативного транса в радиусе 8 км",
      rangeValue: 30,
      targetType: "creature"
    }),
    description: description(`
      <p>Вы мгновенно обнаруживаете любых фей в радиусе 30 футов. Сосредоточившись на глубоком медитативном трансе в течение 1 часа, вы можете расширить это чувство до 8 км.</p>
    `, "активность отмечает использование чувства. Реальное наличие фей и расширенный радиус 8 км подтверждает Мастер.")
  }),
  feyWarriorFeature({
    key: "charming-defense",
    name: "Очаровательная защита",
    img: `${WOW}/Spells/Charm.png`,
    level: 2,
    description: description(`
      <p>Пока вы не носите доспехов, вы можете прибавлять бонус Харизмы к вашему Классу Доспеха.</p>
    `, "runtime синхронизирует условный эффект КД: он включается, когда у персонажа есть эта особенность и нет экипированной брони, и снимается при надевании брони.")
  }),
  feyWarriorFeature({
    key: "chimeric-weapon",
    name: "Химерическое оружие",
    img: `${WOW}/Spells/NaturesWrath.png`,
    level: 3,
    description: description(`
      <p>Вы наполняете удары оружия силой Глубокой грёзы. Ваши атаки оружием наносят дополнительный психический урон, равный вашему модификатору Харизмы.</p>
    `, "при броске урона оружием модуль добавляет отдельный психический урон, равный текущему модификатору Харизмы.")
  }),
  feyWarriorFeature({
    key: "permanent-manifestation",
    name: "Постоянное проявление",
    img: `${WOW}/Abilities/Dreamstate.png`,
    level: 4,
    uses: {
      max: "1",
      spent: 0,
      recovery: [
        { period: "sr", type: "recoverAll" },
        { period: "lr", type: "recoverAll" }
      ]
    },
    activities: utilityActivity({
      key: "permanent-manifestation",
      name: "Использовать постоянное проявление",
      activation: "special",
      consumeItemUse: true
    }),
    description: description(`
      <p>Вы можете выбрать одну из активных черт фей, которую приобрели, и сделать её постоянной. Физическое проявление остаётся неизменным.</p>
      <p>Вы можете использовать эту способность число раз, равное модификатору Харизмы, минимум один раз, и восстанавливаете все использования после короткого отдыха.</p>
    `, "модуль синхронизирует максимум использований по модификатору Харизмы. Какую активную черту вы сделали постоянной, нужно отметить вручную.")
  }),
  feyWarriorFeature({
    key: "fey-magic",
    name: "Магия фей",
    img: `${WOW}/Spells/NatureBlessing.png`,
    level: 4,
    description: description(`
      <p>Раз в день вы можете применить каждое из следующих заклинаний без расхода ячеек и материальных компонентов: <em>Лечение ран</em>, <em>Звериные узы</em>, <em>Огонь фей</em>, <em>Поиск животных или растений</em>, <em>Улучшение характеристики</em>, <em>Рост растений</em>, <em>Гипнотический узор</em>.</p>
      <p>Заклинательная характеристика — Харизма.</p>
    `, "список заклинаний сохранён на карточке. Сами заклинания добавьте на лист вручную как врождённые/безъячеечные, чтобы отслеживать каждое применение раздельно.")
  }),
  feyWarriorFeature({
    key: "fey-skin",
    name: "Фейская кожа",
    img: `${WOW}/Spells/SkinofEarth.png`,
    level: 5,
    description: description(`
      <p>Ваше наследие защищает вас от любого оружия, сделанного не из холодного железа. Дробящий, колющий и рубящий урон, получаемый от оружия не из холодного железа, уменьшается на 5.</p>
      <p>Вместе с этим вы приобретаете уязвимость к повреждениям от холодного железа.</p>
    `, "эффект не накладывается как обычное сопротивление, потому что правило уменьшает урон на фиксированные 5 и зависит от материала оружия. Применяйте корректировку урона вручную.")
  }),
  feyTrait({
    key: "fey-mask",
    name: "Маска",
    img: `${WOW}/Spells/MirrorImage.png`,
    level: 1,
    uses: srUses(),
    activities: utilityActivity({
      key: "fey-mask-double",
      name: "Создание двойника",
      activation: "action",
      consumeItemUse: true
    }),
    description: description(`
      <p><strong>Личина:</strong> вокруг вас автоматически формируется естественный смертный облик, подходящий вам. Существа, видящие сквозь иллюзии, и существа с истинным зрением могут видеть через него.</p>
      <p><strong>Создание двойника:</strong> действием вы можете наложить <em>Отражения</em> без траты ячеек. После использования вы должны завершить короткий отдых.</p>
    `, "карточка отслеживает использование активной части «Создание двойника». Облик личины и само заклинание применяются вручную.")
  }),
  feyTrait({
    key: "fey-blood",
    name: "Кровь фей",
    img: `${WOW}/Spells/MagicImmunity.png`,
    uses: srUses(),
    effects: [activeEffect({
      key: "fey-blood",
      name: "Кровь фей",
      img: `${WOW}/Spells/MagicImmunity.png`,
      changes: [{ key: "system.traits.ci.value", type: "custom", value: "magical sleep", priority: 20 }],
      transfer: false
    })],
    activities: utilityActivity({
      key: "fey-blood-magic-protection",
      name: "Защита от магии",
      activation: "reaction",
      condition: "Когда вы проваливаете спасбросок от заклинания",
      consumeItemUse: true
    }),
    description: description(`
      <p><strong>Транс:</strong> вам больше не нужно спать; вы можете отдыхать в 4-часовом медитативном трансе. Вы совершаете с преимуществом спасброски от очарования, и вас невозможно магически усыпить.</p>
      <p><strong>Защита от магии:</strong> если вы проваливаете спасбросок от заклинания, вы можете реакцией повторить его с преимуществом. После использования завершите короткий отдых.</p>
    `, "пассивный эффект добавляет маркер иммунитета к магическому сну. Преимущество против очарования и повторный спасбросок применяются вручную в окне броска.")
  }),
  feyTrait({
    key: "fey-eyes",
    name: "Глаза феи",
    img: `${WOW}/Abilities/CatlikeReflexes.png`,
    uses: srUses(),
    effects: [activeEffect({
      key: "fey-eyes",
      name: "Кошачье зрение",
      img: `${WOW}/Abilities/CatlikeReflexes.png`,
      changes: [{ key: "system.attributes.senses.ranges.darkvision", type: "upgrade", value: "120", priority: 20 }],
      transfer: false
    })],
    activities: utilityActivity({
      key: "fey-eyes-hypnosis",
      name: "Гипноз",
      activation: "action",
      consumeItemUse: true,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      rollFormula: "8 + @prof + @abilities.cha.mod",
      rollName: "Сл спасброска Интеллекта",
      rollVisible: true
    }),
    description: description(`
      <p><strong>Кошачье зрение:</strong> вы видите в темноте и тусклом свете на расстоянии до 120 футов.</p>
      <p><strong>Гипноз:</strong> действием вы смотрите в глаза разумного существа. Цель проходит спасбросок Интеллекта, иначе считается ошеломлённой, пока вы поддерживаете зрительный контакт. Цель повторяет спасбросок в конце каждого своего хода; эффект также заканчивается при получении урона. Нежить, растения, конструкты и существа с иммунитетом к очарованию не подвержены эффекту.</p>
    `, "пассивный эффект выставляет тёмное зрение 120 футов. Активность тратит использование и показывает Сл; состояние цели примените вручную.")
  }),
  feyTrait({
    key: "fey-appearance",
    name: "Облик феи",
    img: `${WOW}/Spells/Charm.png`,
    uses: srUses(),
    advancement: [fixedAbilityScoreAdvancement({
      key: "fey-appearance-charisma",
      level: 1,
      fixed: { cha: 1 },
      max: 20,
      title: "Красивые черты: Харизма +1"
    })],
    activities: utilityActivity({
      key: "fey-appearance-suggestion",
      name: "Разумное предложение",
      activation: "action",
      consumeItemUse: true,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      rollFormula: "8 + @prof + @abilities.cha.mod",
      rollName: "Сл спасброска Мудрости",
      rollVisible: true
    }),
    description: description(`
      <p><strong>Красивые черты:</strong> ваша Харизма увеличивается на 1, максимум до 20.</p>
      <p><strong>Разумное предложение:</strong> действием вы улыбаетесь одному существу. При провале спасброска Мудрости вы предлагаете ему ход действий, как заклинанием <em>Внушение</em>. После использования завершите короткий отдых.</p>
    `, "карточка содержит Advancement Харизма +1. Активность тратит использование и показывает Сл спасброска; эффект Внушения примените вручную.")
  }),
  feyTrait({
    key: "fey-speed",
    name: "Скорость фей",
    img: `${WOW}/Spells/BurningSpeed.png`,
    uses: srUses(),
    effects: [activeEffect({
      key: "fey-speed",
      name: "Быстрые ноги",
      img: `${WOW}/Spells/BurningSpeed.png`,
      changes: [{ key: "system.attributes.movement.walk", type: "add", value: "5", priority: 20 }],
      transfer: false
    })],
    advancement: [fixedAbilityScoreAdvancement({
      key: "fey-speed-dexterity",
      level: 1,
      fixed: { dex: 1 },
      max: 20,
      title: "Быстрые ноги: Ловкость +1"
    })],
    activities: utilityActivity({
      key: "fey-speed-burst",
      name: "Всплеск скорости",
      activation: "reaction",
      condition: "Когда вы получаете урон",
      consumeItemUse: true
    }),
    description: description(`
      <p><strong>Быстрые ноги:</strong> ваша Ловкость увеличивается на 1, максимум до 20, а базовая скорость увеличивается на 5 футов.</p>
      <p><strong>Всплеск скорости:</strong> реакцией на получение урона вы можете переместиться на расстояние до половины обычной скорости, не провоцируя атак. После использования завершите короткий отдых.</p>
    `, "карточка содержит Advancement Ловкость +1 и пассивный эффект +5 футов скорости. Реакционное перемещение выполняется вручную.")
  }),
  feyTrait({
    key: "irresistible-charms",
    name: "Непреодолимые чары",
    img: `${WOW}/Spells/StudentOfMagic.png`,
    uses: srUses(),
    effects: [activeEffect({
      key: "irresistible-charms",
      name: "Трудное заклинание",
      img: `${WOW}/Spells/StudentOfMagic.png`,
      changes: [{ key: "system.bonuses.spell.dc", type: "add", value: "1", priority: 20 }],
      transfer: false
    })],
    activities: utilityActivity({
      key: "irresistible-charms-reroll",
      name: "Призыв чары",
      activation: "reaction",
      condition: "Когда противник преуспевает в спасброске от вашего заклинания",
      consumeItemUse: true
    }),
    description: description(`
      <p><strong>Трудное заклинание:</strong> Сл спасбросков от ваших заклинаний увеличивается на 1.</p>
      <p><strong>Призыв чары:</strong> если противник преуспевает в спасброске от вашего заклинания, вы можете заставить его перебросить этот бросок и использовать новый результат. После использования завершите короткий отдых.</p>
    `, "пассивный эффект добавляет +1 к Сл заклинаний. Принудительный переброс спасброска применяется вручную.")
  }),
  feyTrait({
    key: "fey-indomitable-life",
    name: "Неистребимая жизнь",
    img: `${WOW}/Miscellaneous/Eternal_Life.png`,
    uses: srUses(),
    activities: {
      ...utilityActivity({
        key: "fey-indomitable-life-temp-hp",
        name: "Временные хиты после отдыха",
        activation: "special",
        rollFormula: "@abilities.cha.mod + @classes.fey-warrior.levels",
        rollName: "Временные хиты",
        rollVisible: true
      }),
      ...utilityActivity({
        key: "fey-indomitable-life-healing-spirit",
        name: "Дух исцеления",
        activation: "action",
        consumeItemUse: true
      })
    },
    description: description(`
      <p><strong>Неутомимая жизнь:</strong> каждый раз, окончив короткий или длинный отдых, вы получаете временные хиты, равные модификатору Харизмы + уровню Воителя фей. Они остаются до конца следующего отдыха.</p>
      <p><strong>Дух исцеления:</strong> действием вы можете призвать <em>Исцеляющий дух</em> без траты ячеек. После использования завершите короткий отдых.</p>
    `, "активность бросает формулу временных хитов после отдыха; примените результат как временные хиты. «Дух исцеления» отслеживает использование, само заклинание применяется вручную.")
  }),
  feyTrait({
    key: "healing-adept",
    name: "Адепт исцеления",
    img: `${WOW}/Spells/HealingTouch.png`,
    uses: srUses(),
    activities: {
      ...utilityActivity({
        key: "healing-adept-kit",
        name: "Комплект целителя",
        activation: "action",
        rollFormula: "1d12 + @abilities.con.mod",
        rollName: "Восстановление хитов",
        rollVisible: true
      }),
      ...utilityActivity({
        key: "healing-adept-false-life",
        name: "Невероятная живучесть",
        activation: "action",
        consumeItemUse: true,
        rollFormula: "1d4 + 14",
        rollName: "Временные хиты Псевдожизни 3 круга",
        rollVisible: true
      })
    },
    description: description(`
      <p><strong>Адепт жизни:</strong> когда вы лечите кого-то магией, ваши кости лечения имеют максимальное значение. Если вы используете комплект целителя, цель восстанавливает 1к12 + её модификатор Телосложения хитов; этот вариант нельзя использовать на то же существо до его длинного отдыха.</p>
      <p><strong>Невероятная живучесть:</strong> действием вы накладываете на себя <em>Псевдожизнь</em> как заклинание 3 уровня без траты ячеек и компонентов. После использования завершите короткий отдых.</p>
    `, "карточка содержит бросок для комплекта целителя и бросок временных хитов Псевдожизни 3 круга. Максимизацию магического лечения применяйте вручную при броске соответствующего заклинания.")
  }),
  feyTrait({
    key: "graceful-fighter",
    name: "Грациозный боец",
    img: `${WOW}/Abilities/CatFormAttack.png`,
    uses: srUses(),
    activities: utilityActivity({
      key: "graceful-fighter-action-surge",
      name: "Всплеск действий",
      activation: "special",
      consumeItemUse: true
    }),
    description: description(`
      <p><strong>Уход от опасности:</strong> когда вы получаете критический удар, вы можете реакцией совершить одну атаку оружием по противнику в пределах досягаемости, после чего переместиться на полную скорость, не провоцируя атак.</p>
      <p><strong>Всплеск действий:</strong> в свой ход вы можете совершить одно дополнительное действие помимо обычного и бонусного действий, аналогично воинской способности. После использования завершите короткий отдых.</p>
    `, "активность отслеживает использование Всплеска действий. Реакционная атака и перемещение после критического удара выполняются вручную.")
  })
];
