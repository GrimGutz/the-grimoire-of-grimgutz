import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const SOURCE = "Престиж-класс: Падший жрец; предоставленный PDF PK_FallenPriest (1).pdf";

const MAIN_FOLDER = idFor("folder:fallen-priest-features");

export const fallenPriestFolders = [
  folder({ key: "fallen-priest-features", name: "Падший жрец: классовые особенности", sort: 1050000 })
];

function description(body, automation) {
  return `
    ${body}
    <hr>
    <p><strong>Автоматизация Foundry:</strong> ${automation}</p>
  `;
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

function fallenPriestFeature({
  key,
  name,
  img,
  level,
  description: value,
  uses = null,
  activities = {},
  extraAutomation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Падший жрец ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    automation: {
      feature: key,
      fallenPriestFeature: true,
      minimumLevel: level,
      ...extraAutomation
    },
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    description: value
  });
}

export const fallenPriestDocuments = [
  fallenPriestFeature({
    key: "fallen-priest-heretic",
    name: "Еретик",
    img: `${WOW}/Spells/TwistedFaith.png`,
    level: 1,
    description: description(`
      <p>Так как Падший жрец оставил своё служение, он больше не может получать уровни ни в классе Жреца, ни в любом другом классе, использующем божественную магию, кроме Падшего жреца.</p>
    `, "это сюжетно-механическое ограничение оставлено как правило карточки. Модуль не блокирует уровни других классов, потому что список «божественных» классов зависит от мира, переводов и решений Мастера.")
  }),
  fallenPriestFeature({
    key: "fallen-priest-spellcasting",
    name: "Чтение заклинаний",
    img: `${WOW}/Spells/DivineIllumination.png`,
    level: 1,
    activities: utilityActivity({
      key: "fallen-priest-spellcasting-sync",
      name: "Синхронизировать чтение заклинаний",
      action: "sync-fallen-priest-spellcasting",
      activation: "special"
    }),
    description: description(`
      <p>Падший жрец может произносить заклинания из списка Жреца и добавляет свой уровень Падшего жреца к уровням Жреца, когда определяет доступные круги заклинаний, количество ячеек и количество подготавливаемых заклинаний в день.</p>
      <p>Падший жрец не имеет доступа к доменным заклинаниям. Вместо благодати он крадёт божественную силу, не получая её напрямую.</p>
    `, "runtime добавляет уровни Падшего жреца к прогрессии ячеек Жреца и обновляет формулу подготовки заклинаний Жреца до «Мудрость + уровни Жреца + уровни Падшего жреца». Если на листе нет класса Жреца, подготовку и ячейки нужно вести вручную. Действие на карточке запускает повторную синхронизацию.")
  }),
  fallenPriestFeature({
    key: "fallen-priest-turn-undead",
    name: "Изгнание нежити",
    img: `${WOW}/Spells/TurnUndead.png`,
    level: 1,
    activities: utilityActivity({
      key: "fallen-priest-turn-undead",
      name: "Изгнание нежити",
      activation: "action",
      targetType: "enemy",
      rollFormula: "8 + @prof + @abilities.wis.mod",
      rollName: "Сл спасброска Мудрости",
      rollVisible: true
    }),
    description: description(`
      <p>Падший жрец может изгонять и уничтожать нежить так же, как обычный Жрец.</p>
    `, "активность показывает Сл спасброска Мудрости. Сам эффект изгнания/уничтожения, лимиты Божественного канала и допустимый ПО нежити применяются вручную по правилам Жреца, потому что они зависят от текущих уровней и доступных классовых особенностей персонажа.")
  }),
  fallenPriestFeature({
    key: "divine-resistance",
    name: "Сопротивление божественному",
    img: `${WOW}/Spells/SpellWarding.png`,
    level: 2,
    description: description(`
      <p>Крадя силу богов, Падший жрец научился защищать себя от их гнева. Вы получаете сопротивление магии, но только против божественных заклинаний.</p>
    `, "правило оставлено ручным: Foundry и Midi-QOL не имеют стабильного универсального признака, что конкретное заклинание является именно божественным. При подходящем спасброске включайте преимущество вручную.")
  }),
  fallenPriestFeature({
    key: "absorb-power",
    name: "Поглощение силы",
    img: `${WOW}/Abilities/IncantersAbsorbtion.png`,
    level: 3,
    activities: utilityActivity({
      key: "absorb-power",
      name: "Восстановить ячейки на коротком отдыхе",
      activation: "special",
      condition: "Во время короткого отдыха",
      rollFormula: "@classes.fallen-priest.levels",
      rollName: "Сумма кругов восстанавливаемых ячеек",
      rollVisible: true
    }),
    description: description(`
      <p>Во время короткого отдыха вы можете восстановить ячейки заклинаний, сумма кругов которых равна вашему уровню Падшего жреца, в любой комбинации.</p>
    `, "активность выводит доступную сумму кругов ячеек. Конкретные ячейки выбираются и восстанавливаются вручную, потому что правило разрешает любую комбинацию.")
  }),
  fallenPriestFeature({
    key: "divine-copying",
    name: "Копирование божественного",
    img: `${WOW}/Spells/DivineProvidence.png`,
    level: 4,
    activities: utilityActivity({
      key: "divine-copying",
      name: "Скопировать божественное заклинание",
      activation: "reaction",
      condition: "Божественный заклинатель в пределах 60 футов творит заклинание за 1 действие или 1 бонусное действие",
      rangeValue: 60,
      targetType: "creature",
      targetChoice: true
    }),
    description: description(`
      <p>Когда божественный заклинатель творит заклинание со временем накладывания 1 действие или 1 бонусное действие в пределах 60 футов от вас, вы можете реакцией подключиться к его связи с богом и наложить копию этого же заклинания, не тратя ячейку.</p>
      <p>Копия полностью идентична оригиналу, включая Сл спасбросков и точность попадания, но вы можете выбрать другие цели. Вы не можете скопировать заклинание, если его круг превышает тот, которым владеете вы. Дорогие материальные компоненты нужно предоставить самостоятельно.</p>
    `, "карточка задаёт реакцию и дистанцию. Само копирование выполняется вручную, потому что нужно знать оригинальное заклинание, его круг, компоненты, цели и показатели чужого заклинателя.")
  }),
  fallenPriestFeature({
    key: "arcane-copying",
    name: "Копирование арканы",
    img: `${WOW}/Spells/ArcaneTorrent.png`,
    level: 5,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "arcane-copying",
      name: "Скопировать тайное заклинание",
      activation: "reaction",
      condition: "Тайный заклинатель в пределах 60 футов творит заклинание за 1 действие или 1 бонусное действие",
      consumeItemUse: true,
      rangeValue: 60,
      targetType: "creature",
      targetChoice: true
    }),
    description: description(`
      <p>Вы можете применить навык, полностью аналогичный Копированию божественного, но копируете тайное, а не божественное заклинание.</p>
      <p>Эта способность может быть использована один раз и восстанавливается после короткого отдыха.</p>
    `, "карточка отслеживает одно использование за короткий отдых. Само копирование тайного заклинания выполняется вручную по тем же причинам, что и Копирование божественного.")
  })
];
