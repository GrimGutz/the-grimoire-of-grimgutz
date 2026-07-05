import {
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Нетерильский арканист; предоставленный PDF PK_NeterilArkanist.pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:netherese-arcanist-features");

export const nethereseArcanistFolders = [
  folder({ key: "netherese-arcanist-features", name: "Нетерильский арканист: классовые особенности", sort: 1160000 })
];

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

function nethereseFeature({
  key,
  name,
  img,
  level,
  description: value,
  uses = null,
  activities = {},
  automation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Нетерильский арканист ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    automation: {
      feature: key,
      nethereseArcanistFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "15–17",
    sourceCustom: SOURCE,
    description: value
  });
}

function greatSpellActivity({ key, name, spell }) {
  return utilityActivity({
    key,
    name,
    action: "cast-netherese-great-spell",
    actionData: {
      nethereseGreatSpell: spell
    },
    activation: "action",
    consumeItemUse: true,
    spellSlot: false
  });
}

export const nethereseArcanistDocuments = [
  nethereseFeature({
    key: "scholar-arcanist",
    name: "Учёный арканист",
    img: `${WOW}/Spells/StudentOfMagic.png`,
    level: 1,
    activities: utilityActivity({
      key: "show-scholar-arcanist",
      name: "Правило инициативы",
      action: "show-scholar-arcanist",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Вы становитесь экспертом по темам, которые касаются Нетерильской империи и Плетения. Вы получаете владение навыком История. Если вы уже владели этим навыком, то изучаете его на мастерском уровне. Также вы получаете мастерское владение навыком Магия.</p>
      <p>Когда вы совершаете бросок инициативы, можете использовать Интеллект вместо Ловкости.</p>
    `, "Advancement выдаёт Историю и мастерское владение Магией. Если История уже была у персонажа, переведите её в экспертность вручную, потому что Foundry не даёт безопасного условного Advancement для «владение или экспертность». Активность выводит напоминание о выборе Интеллекта для инициативы.")
  }),
  nethereseFeature({
    key: "netherese-grimoire",
    name: "Нетерильский гримуар",
    img: `${WOW}/Miscellaneous/Book_12.png`,
    level: 1,
    description: description(`
      <p>Вы получаете первый нетерильский гримуар. Он действует как книга заклинаний волшебника, и для произнесения заклинаний из него, а также Великих заклинаний, вы должны использовать гримуар в качестве фокусировки.</p>
      <p>Вы можете объединить его со своей книгой заклинаний за 500 зм, 10 дней транскрипции знаний и обычные затраты на переписывание собственных заклинаний. Независимо от того, являетесь ли вы волшебником или чародеем, для добавления в гримуар используются заклинания из списка волшебника. На каждом следующем уровне этого престиж-класса можно добавить в него ещё по два заклинания.</p>
    `, "карточка хранит правило гримуара. Конкретные добавленные заклинания, стоимость чернил, время транскрипции и обязательная фокусировка подтверждаются игроком и Мастером.")
  }),
  nethereseFeature({
    key: "mini-mythal",
    name: "Мини-мифаль",
    img: `${WOW}/Spells/AntiMagicZone.png`,
    level: 2,
    uses: longRestUse("3"),
    activities: {
      ...utilityActivity({
        key: "activate-mini-mythal",
        name: "Создать мини-мифаль",
        action: "activate-mini-mythal",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...utilityActivity({
        key: "teleport-in-mini-mythal",
        name: "Телепортировать внутри мифаля",
        action: "teleport-in-mini-mythal",
        activation: "bonus",
        spellSlot: false
      }),
      ...utilityActivity({
        key: "overload-mini-mythal",
        name: "Перегрузить мини-мифаль",
        action: "overload-mini-mythal",
        activation: "action",
        spellSlot: false
      })
    },
    description: description(`
      <p>Действием вы создаёте вокруг себя сферу радиусом 30 футов на 1 минуту. Сфера центрирована на вас, но не движется, не мешает зрению и исчезает, если вы покидаете её или ваши хиты падают до 0.</p>
      <ul>
        <li>Вы можете накладывать заклинания с дистанцией «касание» против любого существа внутри сферы.</li>
        <li>Проверки концентрации вы совершаете с преимуществом.</li>
        <li>Действием вы можете сделать сферу твёрдой до конца следующего хода, не позволяя существам, предметам и заклинаниям проходить через неё; после этого мифаль распадается.</li>
        <li>Бонусным действием вы можете телепортировать одно существо внутри мифаля в другую точку внутри него. Несогласное существо сопротивляется спасброском Харизмы.</li>
        <li>Действием вы можете перегрузить мифаль. Существа в пределах 30 футов от мифаля совершают спасбросок Ловкости против вашей СЛ заклинаний; при провале получают 10к6+40 урона силовым полем, при успехе — половину. Существа внутри мифаля, включая вас, автоматически проваливают спасбросок.</li>
      </ul>
    `, "карточка имеет 3 использования за длительный отдых. Создание накладывает 1-минутный marker-эффект. Перегрузка бросает 10к6+40 силового урона, снимает эффект и тратит оставшиеся использования до длительного отдыха. Закаление сферы, выбор целей, спасброски и позиционирование применяются вручную.")
  }),
  nethereseFeature({
    key: "ancient-knowledge",
    name: "Древнее знание",
    img: `${WOW}/Spells/ArcaneIntellect.png`,
    level: 3,
    uses: longRestUse("2"),
    activities: utilityActivity({
      key: "use-ancient-knowledge",
      name: "Вспомнить заклинание",
      action: "use-ancient-knowledge",
      activation: "action",
      consumeItemUse: true,
      spellSlot: false
    }),
    description: description(`
      <p>Действием вы можете погрузиться в память Нетерила и «вспомнить» одно заклинание 5-го круга или ниже из списка заклинаний любого класса. Оно считается для вас заклинанием волшебника, и вы следуете обычным правилам его накладывания, включая ячейки, время и материальные компоненты. Заклинание исчезает из сознания после того, как вы его наложили.</p>
      <p>Вы можете использовать эту способность два раза. После длительного отдыха она восстанавливается.</p>
    `, "карточка имеет 2 использования за длительный отдых и выводит в чат напоминание. Выбор конкретного заклинания и его добавление/удаление с листа выполняются вручную, потому что список может быть любым классом.")
  }),
  nethereseFeature({
    key: "great-spells",
    name: "Великие заклинания",
    img: `${WOW}/Places/Netherstorm_01.png`,
    level: 5,
    uses: longRestUse("1"),
    activities: {
      ...greatSpellActivity({
        key: "cast-proctivs-floating-island",
        name: "Великое: Парящий остров Проктива",
        spell: "Парящий остров Проктива"
      }),
      ...greatSpellActivity({
        key: "cast-amaunators-eternal-sun",
        name: "Великое: Вечное солнце Амаунатора",
        spell: "Вечное солнце Амаунатора"
      }),
      ...greatSpellActivity({
        key: "cast-fiery-cataract",
        name: "Великое: Огненная катаракта",
        spell: "Огненная катаракта"
      }),
      ...greatSpellActivity({
        key: "cast-diluvial-torrent",
        name: "Великое: Поток Дилювиаля",
        spell: "Поток Дилювиаля"
      }),
      ...greatSpellActivity({
        key: "cast-horrible-drought",
        name: "Великое: Ужасная засуха",
        spell: "Ужасная засуха"
      }),
      ...greatSpellActivity({
        key: "cast-tolodines-killing-wind",
        name: "Великое: Смертоносный ветер Толодина",
        spell: "Смертоносный ветер Толодина"
      }),
      ...greatSpellActivity({
        key: "cast-beast-of-a-thousand-legs",
        name: "Великое: Тварь о тысяче ног",
        spell: "Тварь о тысяче ног"
      })
    },
    description: description(`
      <p>Начиная с 5-го уровня вы выбираете одно Великое заклинание из списка и можете использовать его один раз за длительный отдых. Сразу после произнесения вы получаете четыре уровня истощения и временно отрываетесь от Плетения, что оставляет вас неспособным произносить заклинания. Единственный способ избавиться от этой усталости и восстановить связь с Плетением — отдых в течение десяти дней.</p>
      <p>Пока связь с Плетением прервана, вы не можете использовать чудесные предметы, требующие настройки или заклинательных способностей. Если вас убьют в этот период, заклинание <em>Клон</em> не срабатывает, и воскреснуть можно только с помощью <em>Истинного воскрешения</em> через десять дней после Великого заклинания.</p>
      <p>Некоторые Великие заклинания требуют мифаллара. Создание мифаллара требует 30 дней и 50 000 зм материалов; он имеет КД 20, 350 хитов, сопротивление всем немагическим атакам и поглощает магический урон как исцеление.</p>
    `, "каждая активность тратит общее использование способности и создаёт 10-дневный marker-эффект «Отрыв от Плетения». Четыре уровня истощения, запрет заклинаний, ограничения предметов, мифаллар, постоянные эффекты и последствия смерти применяются Мастером, потому что требуют кампанийного решения и не имеют безопасного универсального системного пути.")
  })
];
