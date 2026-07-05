import {
  activeEffect,
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Воин тьмы; предоставленный PDF PK_DarkWarrior (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:dark-warrior-features");

export const darkWarriorFolders = [
  folder({ key: "dark-warrior-features", name: "Воин тьмы: классовые особенности", sort: 1140000 })
];

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
    recovery: [
      { period: "lr", type: "recoverAll" }
    ]
  };
}

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function darkWarriorFeature({
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
    requirements: `Воин тьмы ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    effects,
    automation: {
      feature: key,
      darkWarriorFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    description: value
  });
}

function elixirActivity({ key, name, elixir }) {
  return utilityActivity({
    key,
    name,
    action: "drink-dark-warrior-elixir",
    actionData: {
      darkWarriorElixir: elixir
    },
    activation: "action",
    consumeItemUse: true,
    spellSlot: false
  });
}

export const darkWarriorDocuments = [
  darkWarriorFeature({
    key: "black-magic-oil",
    name: "Масло чёрной магии",
    img: `${WOW}/Abilities/OilJets.png`,
    level: 1,
    uses: shortRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "apply-black-magic-oil",
        name: "Нанести чёрное масло",
        action: "apply-black-magic-oil",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...utilityActivity({
        key: "sync-dark-warrior-resources",
        name: "Синхронизировать ресурсы Воина тьмы",
        action: "sync-dark-warrior-resources",
        activation: "special",
        spellSlot: false
      })
    },
    description: description(`
      <p>Во время короткого отдыха Воин тьмы может наполнить флакон обычного мирского масла своей тёмной энергией, превращая его в нечестивое масло для покрытия оружия.</p>
      <p>Один флакон может покрыть 1 оружие или 5 боеприпасов. Нанесение масла занимает 1 действие, после чего оно остаётся на оружии в течение 1 минуты и высыхает.</p>
      <p>Покрытое маслом оружие позволяет Воину тьмы добавлять свой модификатор Харизмы как некротический урон к атакам этим оружием.</p>
    `, "карточка имеет 1 использование, восстанавливающееся на коротком или длительном отдыхе. Активность нанесения масла создаёт временный эффект на 1 минуту; пока эффект активен, модуль добавляет модификатор Харизмы некротическим уроном к броскам урона оружием. Выбор конкретного покрытого оружия или 5 боеприпасов подтверждается игроком/Мастером.")
  }),
  darkWarriorFeature({
    key: "black-magic-elixir",
    name: "Эликсир чёрной магии",
    img: `${WOW}/Trade/Elixir_04.png`,
    level: 2,
    uses: longRestUse("1"),
    activities: {
      ...elixirActivity({
        key: "dark-elixir-strength",
        name: "Выпить: Адская сила",
        elixir: "strength"
      }),
      ...elixirActivity({
        key: "dark-elixir-shield",
        name: "Выпить: Адский щит",
        elixir: "shield"
      }),
      ...elixirActivity({
        key: "dark-elixir-eye",
        name: "Выпить: Демонический глаз",
        elixir: "eye"
      }),
      ...elixirActivity({
        key: "dark-elixir-horrifying",
        name: "Выпить: Ужасающий облик",
        elixir: "horrifying"
      })
    },
    description: description(`
      <p>Начиная со 2-го уровня, во время длительного отдыха вы можете наполнить склянку с водой нечестивой чёрной энергией. Она превращается в эликсир, сохраняющий силу в течение 24 часов, после чего вновь становится обычной водой.</p>
      <p>Эликсир выпивается действием. После этого вы испытываете его эффект в течение 1 часа. Выберите один эффект:</p>
      <ul>
        <li><strong>Адская сила.</strong> Вы получаете +3 к Силе.</li>
        <li><strong>Адский щит.</strong> Вы получаете +1 КД.</li>
        <li><strong>Демонический глаз.</strong> Вы получаете истинное зрение 30 футов.</li>
        <li><strong>Ужасающий облик.</strong> Существа в пределах 30 футов от вас совершают спасбросок Мудрости против вашей СЛ заклинаний. Если у вас нет заклинательной характеристики, используйте Харизму. При провале они напуганы вами. При успехе они невосприимчивы к этому эффекту на следующие 24 часа.</li>
      </ul>
      <p>Любое существо, кроме Воина тьмы, которое пьёт чёрный эликсир, должно преуспеть в спасброске Телосложения против СЛ заклинаний Воина тьмы. При провале оно отравлено на 1 минуту и не получает преимуществ эликсира даже при успешном спасброске.</p>
    `, "активности эликсира тратят использование и накладывают 1-часовой эффект: +3 Силы, +1 КД, истинное зрение 30 футов или маркер Ужасающего облика с выводом СЛ спасброска. Если существо не является Воином тьмы, спасбросок Телосложения и отравление применяются Мастером вручную.")
  }),
  darkWarriorFeature({
    key: "improved-black-oil",
    name: "Улучшенное чёрное масло",
    img: `${WOW}/Trade/WeaponScroll03.png`,
    level: 3,
    description: description(`
      <p>На 3-м уровне оружие, обработанное чёрным маслом, считается магическим.</p>
    `, "модуль сохраняет правило в описании. Признак магического оружия зависит от конкретного покрытого оружия или боеприпасов и не применяется как глобальный пассивный эффект персонажа.")
  }),
  darkWarriorFeature({
    key: "improved-black-elixir",
    name: "Улучшенный эликсир",
    img: `${WOW}/Trade/Elixir_06.png`,
    level: 4,
    activities: utilityActivity({
      key: "sync-dark-warrior-elixir",
      name: "Синхронизировать эликсиры",
      action: "sync-dark-warrior-resources",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>На 4-м уровне вы можете создать два эликсира вместо одного. Эликсиры могут быть как одинаковыми, так и разными.</p>
    `, "модуль синхронизирует максимум использований «Эликсира чёрной магии»: 1 использование до 4-го уровня Воина тьмы и 2 использования с 4-го уровня.")
  }),
  darkWarriorFeature({
    key: "dark-resistance",
    name: "Тёмное сопротивление",
    img: `${WOW}/Spells/ResistMagic.png`,
    level: 5,
    effects: [
      activeEffect({
        key: "dark-resistance",
        name: "Тёмное сопротивление",
        img: `${WOW}/Spells/ResistMagic.png`,
        changes: [{
          key: "flags.midi-qol.magicResistance.all",
          type: "custom",
          value: "true",
          priority: 20
        }],
        transfer: false
      })
    ],
    description: description(`
      <p>На 5-м уровне посредством ритуала и нечестивых татуировок Воин тьмы получает сопротивление магии. Вы совершаете с преимуществом спасброски от заклинаний и прочих магических эффектов.</p>
    `, "пассивный эффект добавляет флаг Midi-QOL magicResistance для преимущества на спасброски от заклинаний и магических эффектов. Для полной работы нужен активный Midi-QOL.")
  }),
  darkWarriorFeature({
    key: "blackening-weapon",
    name: "Очернение оружия",
    img: `${WOW}/Abilities/EbonBlade.png`,
    level: 5,
    activities: utilityActivity({
      key: "blackening-weapon",
      name: "Провести ритуал очернения",
      activation: "special",
      condition: "Часовой ритуал на одном оружии ближнего боя",
      spellSlot: false
    }),
    description: description(`
      <p>На 5-м уровне вы можете провести часовой ритуал над одним своим оружием ближнего боя, делая его очернённым.</p>
      <ul>
        <li>Оружие получает +1 к броскам атаки и урона. Если у оружия уже есть бонус улучшения, бонус складывается, но итог не может превышать +3.</li>
        <li>Оружие считается магическим.</li>
        <li>Каждый раз, когда вы наносите рану живому существу, вы получаете временные хиты в размере половины нанесённого урона. Эти временные хиты остаются до начала длительного отдыха и не складываются.</li>
      </ul>
      <p>Вы можете держать очернённым только одно оружие. Если проводите ритуал над другим, первое сразу теряет силу.</p>
    `, "карточка служит управлением и описанием ритуала. Бонусы нужно внести на конкретное оружие вручную, потому что правило действует только на один выбранный предмет, учитывает существующий бонус улучшения и выдаёт временные хиты от фактически нанесённого урона живому существу.")
  })
];
