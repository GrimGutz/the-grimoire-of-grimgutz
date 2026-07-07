import {
  activeEffect,
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Демонолог; предоставленный PDF PK_demonolog (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:demonologist-features");

export const demonologistFolders = [
  folder({ key: "demonologist-features", name: "Демонолог: классовые особенности", sort: 2630000 })
];

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function shortRestUse(max = "1") {
  return {
    max,
    spent: 0,
    recovery: [
      { period: "sr", type: "recoverAll" },
      { period: "lr", type: "recoverAll" }
    ]
  };
}

function longRestUse(max = "1") {
  return {
    max,
    spent: 0,
    recovery: [{ period: "lr", type: "recoverAll" }]
  };
}

function demonologistFeature({
  key,
  name,
  img,
  level,
  description: value,
  uses = null,
  activities = {},
  effects = [],
  automation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Демонолог ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    effects,
    automation: {
      feature: key,
      demonologistFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    description: value
  });
}

export const demonologistDocuments = [
  demonologistFeature({
    key: "demon-charm",
    name: "Очарование демонов",
    img: `${WOW}/Spells/DemonicEmpathy.png`,
    level: 1,
    activities: utilityActivity({
      key: "show-demonologist-demon-charm",
      name: "Показать правило очарования",
      action: "show-demonologist-demon-charm",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Ваши магические исследования и постоянный контакт с младшими демонами позволяют влиять на демонов как на представителей собственного вида.</p>
      <p>Заклинания <em>Очарование личности</em> и <em>Очарование монстра</em>, которые вы накладываете, действуют на демонов, даже если те обычно обладают иммунитетом к подобным попыткам подчинения.</p>
    `, "активность выводит правило в чат. Модуль не меняет иммунитеты целей автоматически, потому что нужно подтвердить, что цель является демоном и что используется именно подходящее заклинание.")
  }),
  demonologistFeature({
    key: "infernal-familiar",
    name: "Инфернальный фамильяр",
    img: `${WOW}/Spells/SummonImp.png`,
    level: 1,
    activities: utilityActivity({
      key: "show-demonologist-infernal-familiar",
      name: "Призвать инфернального фамильяра",
      action: "show-demonologist-infernal-familiar",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>На 1-м уровне вы получаете квазита в качестве фамильяра, хотите вы этого или нет. Если у вас уже был фамильяр, квазит пожирает его и занимает его место.</p>
      <p>Параметры квазита находятся в Бестиарии.</p>
    `, "активность создаёт уникального NPC/токен квазита-фамильяра рядом с владельцем. Если нужен точный статблок из бестиария кампании, используйте созданный лист как заготовку и скорректируйте атаки.")
  }),
  demonologistFeature({
    key: "master-summoner",
    name: "Мастер призыва",
    img: `${WOW}/Spells/DarkSummoning.png`,
    level: 2,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "use-demonologist-master-summoner",
      name: "Призвать демона без ячейки",
      action: "use-demonologist-master-summoner",
      activation: "special",
      consumeItemUse: true,
      spellSlot: false
    }),
    description: description(`
      <p>Начиная со 2-го уровня, когда вы используете заклинание призыва демонов, например <em>Призыв младших демонов</em> или <em>Призыв Хезроу</em>, вы можете совершить призыв без траты ячейки заклинания.</p>
      <p>Вы восстанавливаете использование этой способности после короткого отдыха.</p>
    `, "карточка отслеживает одно использование за короткий отдых и выводит напоминание. Само заклинание призыва применяется отдельно, потому что конкретное заклинание и призываемые существа выбираются игроком/Мастером.")
  }),
  demonologistFeature({
    key: "dark-knowledge",
    name: "Тёмное знание",
    img: `${WOW}/Spells/DemonicPact.png`,
    level: 2,
    uses: shortRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "cast-demonologist-protection",
        name: "Защита от добра и зла",
        action: "cast-demonologist-protection",
        activation: "action",
        spellSlot: false
      }),
      ...utilityActivity({
        key: "cast-demonologist-spirit-guardians",
        name: "Духовные стражи",
        action: "cast-demonologist-spirit-guardians",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      })
    },
    description: description(`
      <p>Вы изучаете язык Бездны и заклинание <em>Защита от добра и зла</em>. Вы можете накладывать это заклинание без траты ячеек заклинаний и без компонентов.</p>
      <p>На 5-м уровне Демонолога вы также изучаете заклинание <em>Духовные стражи</em>. Вы можете наложить его один раз без траты ячейки заклинания и без компонентов, после чего восстанавливаете использование после короткого отдыха. Призванные стражи выглядят как бесы или младшие демоны и наносят некротический урон.</p>
    `, "класс автоматически выдаёт язык Бездны на 2-м уровне. Активность «Защита от добра и зла» работает как at-will памятка без расхода. Активность «Духовные стражи» доступна с 5-го уровня Демонолога и тратит одно использование за короткий отдых.")
  }),
  demonologistFeature({
    key: "demonic-resistance",
    name: "Демоническое сопротивление",
    img: `${WOW}/Spells/FelFireward.png`,
    level: 3,
    effects: [
      activeEffect({
        key: "demonic-resistance",
        name: "Демоническое сопротивление",
        img: `${WOW}/Spells/FelFireward.png`,
        changes: [
          {
            key: "system.traits.dr.value",
            type: "custom",
            value: "fire",
            priority: 20
          },
          {
            key: "system.traits.dr.value",
            type: "custom",
            value: "acid",
            priority: 20
          },
          {
            key: "system.traits.di.value",
            type: "custom",
            value: "poison",
            priority: 20
          },
          {
            key: "system.traits.ci.value",
            type: "custom",
            value: "poisoned",
            priority: 20
          }
        ],
        transfer: false
      })
    ],
    description: description(`
      <p>С 3-го уровня вы получаете сопротивление урону огнём и кислотой, а также иммунитет к урону ядом и состоянию Отравлен.</p>
    `, "пассивный эффект добавляет сопротивление огню и кислоте, иммунитет к яду и иммунитет к состоянию Отравлен.")
  }),
  demonologistFeature({
    key: "demonic-vitality",
    name: "Демоническая живучесть",
    img: `${WOW}/Spells/DemonicFortitude.png`,
    level: 3,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "activate-demonic-vitality",
      name: "Включить живучесть",
      action: "activate-demonic-vitality",
      activation: "bonus",
      consumeItemUse: true,
      spellSlot: false
    }),
    description: description(`
      <p>Бонусным действием вы входите в состояние демонической живучести на 1 минуту. Вы получаете 10 временных хитов, и в начале каждого вашего хода эти временные хиты обновляются до 10.</p>
      <p>Существа в пределах 5 футов, совершающие по вам рукопашные атаки, получают 3к10 урона огнём. Этот огонь игнорирует сопротивление и не вредит вам.</p>
      <p>Вы восстанавливаете использование этой способности после короткого отдыха.</p>
    `, "активность тратит использование, создаёт 1-минутный эффект, выставляет временные хиты минимум 10 и обновляет их в начале вашего хода. Урон 3к10 огнём выводится в чат как напоминание; цель рукопашной атаки, дистанцию 5 футов и игнорирование сопротивления подтверждает Мастер.")
  }),
  demonologistFeature({
    key: "demonic-mind",
    name: "Демонический разум",
    img: `${WOW}/Spells/MindTwisting.png`,
    level: 4,
    uses: shortRestUse("1"),
    effects: [
      activeEffect({
        key: "demonic-mind",
        name: "Демонический разум",
        img: `${WOW}/Spells/MindTwisting.png`,
        changes: [
          {
            key: "system.traits.dr.value",
            type: "custom",
            value: "psychic",
            priority: 20
          },
          {
            key: "system.attributes.senses.ranges.telepathy",
            type: "upgrade",
            value: "60",
            priority: 20
          }
        ],
        transfer: false
      })
    ],
    activities: utilityActivity({
      key: "cast-demonologist-detect-thoughts",
      name: "Обнаружение мыслей",
      action: "cast-demonologist-detect-thoughts",
      activation: "action",
      consumeItemUse: true,
      spellSlot: false
    }),
    description: description(`
      <p>Вы получаете телепатию в пределах 60 футов и сопротивление психическому урону.</p>
      <p>Один раз между короткими отдыхами вы можете использовать <em>Обнаружение мыслей</em> без траты ячейки заклинания и без компонентов.</p>
    `, "пассивный эффект добавляет сопротивление психическому урону и выставляет телепатию 60 футов. Активность тратит одно использование за короткий отдых и выводит применение «Обнаружения мыслей» без ячейки и компонентов.")
  }),
  demonologistFeature({
    key: "double-summon",
    name: "Удвоенный призыв",
    img: `${WOW}/Abilities/DemonicEmpowerment.png`,
    level: 5,
    uses: longRestUse("1"),
    activities: utilityActivity({
      key: "use-demonologist-double-summon",
      name: "Удвоить призыв",
      action: "use-demonologist-double-summon",
      activation: "special",
      consumeItemUse: true,
      spellSlot: false
    }),
    description: description(`
      <p>Начиная с 5-го уровня, один раз в день, когда вы используете заклинание призыва демонов, вы можете призвать вдвое больше существ, чем обычно.</p>
    `, "карточка отслеживает одно использование за продолжительный отдых и выводит напоминание. Конкретное количество призванных существ меняется вручную при применении соответствующего заклинания.")
  }),
  demonologistFeature({
    key: "domination",
    name: "Доминация",
    img: `${WOW}/Spells/EnslaveDemon.png`,
    level: 5,
    activities: utilityActivity({
      key: "show-demonologist-domination",
      name: "Показать правило доминации",
      action: "show-demonologist-domination",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Начиная с 5-го уровня, вы можете использовать <em>Подчинение личности</em> на демонов, игнорируя их сопротивления и иммунитеты к подобным эффектам очарования.</p>
    `, "активность выводит правило в чат. Модуль не меняет иммунитеты целей автоматически, потому что требуется подтвердить тип цели и используемое заклинание.")
  })
];
