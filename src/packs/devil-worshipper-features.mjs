import {
  activeEffect,
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Дьяволопоклонник; предоставленный PDF PK_DevilContract (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:devil-worshipper-features");

export const devilWorshipperFolders = [
  folder({ key: "devil-worshipper-features", name: "Дьяволопоклонник: классовые особенности", sort: 1150000 })
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

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function devilFeature({
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
    requirements: `Дьяволопоклонник ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    effects,
    automation: {
      feature: key,
      devilWorshipperFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    description: value
  });
}

function auraTempHpActivity({ key, name, value }) {
  return utilityActivity({
    key,
    name,
    action: "gain-devil-soul-aura-temp-hp",
    actionData: {
      devilSoulAuraTempHp: value
    },
    activation: "special",
    spellSlot: false
  });
}

export const devilWorshipperDocuments = [
  devilFeature({
    key: "devil-spellcasting-ability",
    name: "Базовая характеристика заклинаний",
    img: `${WOW}/Spells/DemonicPact.png`,
    level: 1,
    activities: utilityActivity({
      key: "choose-devil-worshipper-ability",
      name: "Выбрать характеристику",
      action: "choose-devil-worshipper-ability",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы берёте этот престиж-класс, выберите Интеллект, Мудрость или Харизму. Отныне она является вашей основной характеристикой для заклинаний Дьяволопоклонника. Поменять её впоследствии нельзя.</p>
    `, "активность сохраняет выбранную характеристику на актёре. Если выбор ещё не сделан, модуль временно использует лучшую из Интеллекта, Мудрости и Харизмы для расчётов.")
  }),
  devilFeature({
    key: "hellfire",
    name: "Адское пламя",
    img: `${WOW}/Spells/FelFire.png`,
    level: 1,
    description: description(`
      <p>Чары Дьяволопоклонника замараны смрадным пламенем Ада. Вы добавляете свой модификатор Интеллекта, Мудрости или Харизмы к урону от огненных заклинаний, которые используете.</p>
      <p>Кроме того, вы можете изменять стихию любого из своих заклинаний на огонь.</p>
    `, "модуль добавляет выбранный модификатор к урону заклинаний, если бросок/карточка уже содержит огненный урон. Добровольная смена стихии любого заклинания на огонь выполняется игроком вручную на карточке заклинания или через договорённость с Мастером перед броском.")
  }),
  devilFeature({
    key: "imp-familiar",
    name: "Бесовский фамильяр",
    img: `${WOW}/Spells/SummonImp.png`,
    level: 1,
    activities: utilityActivity({
      key: "summon-devil-imp-familiar",
      name: "Призвать бесовского фамильяра",
      action: "summon-devil-imp-familiar",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Бесы шепчут ваше имя в Аду, соревнуясь друг с другом за право стать вашим фамильяром. На 1-м уровне вы получаете в качестве фамильяра беса, хотите вы этого или нет. Если у вас уже есть фамильяр, бес пожирает его и занимает его место.</p>
      <p>Параметры беса находятся в Бестиарии.</p>
    `, "активность создаёт уникального NPC/токен беса-фамильяра рядом с владельцем. Если нужен точный статблок из бестиария кампании, используйте созданный лист как заготовку и скорректируйте атаки.")
  }),
  devilFeature({
    key: "devil-sight",
    name: "Зрение дьявола",
    img: `${WOW}/Spells/ImpPhaseShift.png`,
    level: 2,
    effects: [
      activeEffect({
        key: "devil-sight",
        name: "Зрение дьявола",
        img: `${WOW}/Spells/ImpPhaseShift.png`,
        changes: [{
          key: "system.attributes.senses.ranges.darkvision",
          type: "upgrade",
          value: "60",
          priority: 20
        }],
        transfer: false
      })
    ],
    description: description(`
      <p>На 2-м уровне вы получаете дьявольскую остроту зрения. Вы приобретаете темновидение 60 футов, действующее как в обычной, так и в магической темноте.</p>
    `, "пассивный эффект повышает темновидение до 60 футов. Игнорирование магической темноты хранится в описании, потому что dnd5e не имеет стабильного системного поля для такого отличия.")
  }),
  devilFeature({
    key: "dark-luck",
    name: "Тёмная удача",
    img: `${WOW}/Miscellaneous/LuckyMoneyEnvelope.png`,
    level: 2,
    activities: utilityActivity({
      key: "show-dark-luck",
      name: "Показать Тёмную удачу",
      action: "show-dark-luck",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Тёмные силы оберегают вас. Вам тепло в холодную погоду и прохладно в знойный день, а сверхъестественная аура помогает игнорировать невзгоды и лишения, связанные с погодой.</p>
      <p>Кроме того, один раз за ход, когда на атаке, проверке способности или спасброске у вас выпадет 1, вы можете перебросить этот кубик, но обязаны использовать второй результат, даже если вновь выпала 1.</p>
      <p>И наконец, попав в трудную ситуацию, вы можете попросить дьявола помочь вам. Если покровитель считает, что вы просите о такой удаче слишком часто, он может лишить вас её или обернуть удачу неудачей.</p>
    `, "активность выводит правило в чат. Автоматический переброс не навязан, потому что решение принимается после конкретного броска и только один раз за ход; помощь дьявола полностью зависит от решения Мастера.")
  }),
  devilFeature({
    key: "quiet-whisper",
    name: "Тихий шёпот",
    img: `${WOW}/Miscellaneous/Herb_Whispervine.png`,
    level: 2,
    description: description(`
      <p>На самой грани восприятия вы постоянно слышите тихий потусторонний хор множества голосов, нашёптывающих секреты мироздания.</p>
      <p>Вы получаете владение одним языком, одним набором инструментов и одним навыком из следующих: История, Природа, Магия или Религия. Если вы уже владеете выбранным навыком, то удваиваете бонус мастерства для него.</p>
    `, "выбор языка, инструмента и навыка/экспертности выполняется вручную на листе. Это безопаснее, чем создавать нестандартный advancement-pool, потому что список языков и инструментов часто изменяется модулями и кампанией.")
  }),
  devilFeature({
    key: "empowered-charms",
    name: "Усиленные чары",
    img: `${WOW}/Abilities/DemonicPower.png`,
    level: 3,
    activities: utilityActivity({
      key: "show-empowered-charms",
      name: "Показать число перебросов",
      action: "show-empowered-charms",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Подпитываемые силой Ада и вашего контракта, заклинания, которые вы используете, получают дополнительную силу.</p>
      <p>Начиная с 3-го уровня, каждый раз при совершении броска урона от заклинания вы можете перебросить несколько костей урона. Количество равно вашему модификатору Интеллекта, Мудрости или Харизмы, минимум одна кость. Вы должны использовать новое выпавшее значение.</p>
    `, "активность показывает текущее число костей, которое можно перебросить. Сам выбор конкретных костей выполняется вручную после броска урона.")
  }),
  devilFeature({
    key: "hellfire-fury",
    name: "Ярость адского огня",
    img: `${WOW}/Spells/FelHellfire.png`,
    level: 3,
    description: description(`
      <p>Адское пламя настолько горячо, что от него нет спасения. Начиная с 3-го уровня, огненный урон от ваших заклинаний игнорирует сопротивление огню и наносит половину урона существам с иммунитетом к огню.</p>
    `, "при активном Midi-QOL модуль корректирует применение огненного урона ваших заклинаний: компенсирует сопротивление огню и добавляет половину огненного урона существам с иммунитетом к огню.")
  }),
  devilFeature({
    key: "devilish-glaive",
    name: "Дьявольская гвизарма",
    img: `${WOW}/Weapons/Halberd21.png`,
    level: 5,
    uses: shortRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "summon-devil-glaive",
        name: "Призвать гвизарму",
        action: "summon-devil-glaive",
        activation: "bonus",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...utilityActivity({
        key: "roll-devil-glaive-damage",
        name: "Гвизарма: урон",
        action: "roll-devil-glaive-damage",
        activation: "action",
        spellSlot: false
      }),
      ...utilityActivity({
        key: "roll-devil-glaive-grapple-damage",
        name: "Гвизарма: урон схваченной цели",
        action: "roll-devil-glaive-grapple-damage",
        activation: "bonus",
        spellSlot: false
      })
    },
    description: description(`
      <p>Начиная с 5-го уровня, вы можете бонусным действием призвать гвизарму, оружие костяных дьяволов. Вы считаетесь владеющим этим оружием. Гвизарма имеет досягаемость 10 футов, наносит 2к12 режущего урона, и вы можете использовать свой Интеллект, Мудрость или Харизму вместо Силы, обращаясь с ней. Урон гвизармы считается магическим.</p>
      <p>По желанию, успешно попав по существу гвизармой, вы можете сделать существо схваченным. Существо может освободиться успешной проверкой Атлетики (Сила) или Акробатики (Ловкость) против вашей Атлетики с выбранной характеристикой Дьяволопоклонника.</p>
      <p>Пока вы удерживаете существо, вы не можете использовать гвизарму, но можете в свой ход бонусным действием наносить существу 1к12 режущего урона. После призыва гвизарма остаётся 1 минуту, затем исчезает. Чтобы призвать её вновь, нужно завершить короткий отдых. Гвизарма исчезает, если вы передаёте её кому-то другому.</p>
    `, "активность призыва тратит использование и создаёт 1-минутный эффект. Отдельные активности бросают урон 2к12 + выбранный модификатор и 1к12 по схваченной цели. Захват, проверка освобождения и исчезновение при передаче оружия подтверждаются вручную.")
  }),
  devilFeature({
    key: "aura-of-devastated-souls",
    name: "Аура опустошённых душ",
    img: `${WOW}/Spells/DestructiveSoul.png`,
    level: 5,
    activities: {
      ...auraTempHpActivity({
        key: "devil-aura-small",
        name: "Аура: Маленькое существо",
        value: 10
      }),
      ...auraTempHpActivity({
        key: "devil-aura-medium",
        name: "Аура: Среднее существо",
        value: 20
      }),
      ...auraTempHpActivity({
        key: "devil-aura-large",
        name: "Аура: Большое существо",
        value: 30
      }),
      ...auraTempHpActivity({
        key: "devil-aura-huge",
        name: "Аура: Огромное существо",
        value: 40
      }),
      ...auraTempHpActivity({
        key: "devil-aura-gargantuan",
        name: "Аура: Громадное существо",
        value: 50
      })
    },
    description: description(`
      <p>На 5-м уровне вас постоянно окружает невидимая опустошающая аура. Если любое существо размером не меньше Маленького в пределах 60 футов от вас умирает, вы поглощаете остатки его жизненной силы.</p>
      <p>Вы получаете временные хиты, равные 10 × размер существа: 10 за Маленькое, 20 за Среднее и так далее. Эти временные хиты остаются до начала вашего короткого отдыха и не складываются.</p>
    `, "активности выставляют временные хиты по размеру погибшего существа, если новое значение выше текущих временных хитов. Проверка смерти, размера и дистанции 60 футов подтверждается Мастером.")
  })
];
