import {
  MODULE_ID,
  baseDocument,
  sourceData,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Нетерильский арканист; предоставленный PDF PK_NeterilArkanist.pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";

function activities(...entries) {
  return Object.assign({}, ...entries);
}

function nethereseSpell({
  key,
  name,
  img,
  school,
  activation,
  range,
  duration,
  targetSpecial,
  properties = ["vocal", "somatic"],
  material = "",
  spellActivities = {},
  description
}) {
  return baseDocument({
    key,
    name,
    type: "spell",
    img,
    flags: {
      [MODULE_ID]: {
        nethereseGreatSpell: true
      }
    },
    system: {
      description: {
        value: description.trim(),
        chat: ""
      },
      source: sourceData("16–17", SOURCE),
      activation: {
        type: activation.type,
        condition: "",
        value: activation.value
      },
      duration: {
        value: duration.value,
        units: duration.units
      },
      target: {
        affects: {
          type: "",
          count: "",
          choice: false,
          special: targetSpecial
        },
        template: {
          count: "",
          contiguous: false,
          type: "",
          size: "",
          width: "",
          height: "",
          units: ""
        }
      },
      range,
      uses: {
        max: "",
        spent: 0,
        recovery: []
      },
      level: 9,
      school,
      materials: {
        value: material,
        consumed: material.includes("расход"),
        cost: 0,
        supply: 0
      },
      preparation: {
        mode: "prepared",
        prepared: false
      },
      properties,
      activities: spellActivities,
      identifier: key
    }
  });
}

export const nethereseArcanistSpellDocuments = [
  nethereseSpell({
    key: "proctivs-floating-island",
    name: "Парящий остров Проктива / Proctiv's Floating Island",
    img: `${WOW}/Places/CrystalSong_01.png`,
    school: "trs",
    activation: { type: "hour", value: 8 },
    range: { value: null, units: "spec", special: "8 км" },
    duration: { value: "24", units: "hour" },
    targetSpecial: "Участок местности со сторонами не более 1,5 км",
    properties: ["vocal", "somatic", "material"],
    material: "Мифаллар стоимостью 50 000 зм, вплавленный в центр острова",
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Заклинание срезает горную вершину, переворачивает и левитирует её. Выберите участок местности со сторонами не более полутора километров. Эта область вырезается из земли, поднимается на 500 футов и переворачивается.</p>
<p>Действием вы можете перемещать парящий остров на количество футов, равное вашему модификатору Интеллекта × 50. Через 24 часа остров медленно опустится на землю.</p>
<p>Если каждый день в течение года тратить ячейку 9-го уровня для зарядки мифаллара, эффект становится постоянным. Заряжать мифаллар может любой заклинатель с ячейкой 9-го уровня.</p>
<p><strong>Автоматизация Foundry:</strong> карточка справочная. Геометрия острова, мифаллар и постоянный эффект применяются Мастером.</p>
`
  }),
  nethereseSpell({
    key: "amaunators-eternal-sun",
    name: "Вечное солнце Амаунатора / Amaunator's Eternal Sun",
    img: `${WOW}/Miscellaneous/Eternal_Fire.png`,
    school: "evo",
    activation: { type: "hour", value: 8 },
    range: { value: null, units: "spec", special: "3 км" },
    duration: { value: "24", units: "hour" },
    targetSpecial: "Ложное солнце в видимой точке неба",
    properties: ["vocal", "somatic", "material"],
    material: "Мифаллар стоимостью 50 000 зм, расходуемый заклинанием",
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Заклинание создаёт ложное солнце в 3 километрах над головой, в области неба, которую вы видите. Оно сияет с полуденной яркостью и перекрывает реальное солнце для наблюдателей в радиусе 240 километров.</p>
<p>Тратя ячейку 9-го уровня каждый день в течение года, можно сделать эффект постоянным.</p>
<p><strong>Автоматизация Foundry:</strong> карточка справочная. Освещение сцены и постоянный эффект настраиваются Мастером.</p>
`
  }),
  nethereseSpell({
    key: "fiery-cataract",
    name: "Огненная катаракта / Fiery Cataract",
    img: `${WOW}/Spells/BlueRainOfFire.png`,
    school: "evo",
    activation: { type: "minute", value: 1 },
    range: { value: null, units: "self", special: "" },
    duration: { value: "0", units: "inst" },
    targetSpecial: "Цилиндр радиусом 100 футов и высотой 1000 футов, центрированный на заклинателе",
    spellActivities: utilityActivity({
      key: "fiery-cataract-damage",
      name: "Огонь и силовое поле",
      activation: "action",
      targetType: "creature",
      rollFormula: "15d10[fire] + 15d10[force]",
      rollName: "Огненная катаракта",
      rollVisible: true
    }),
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Вертикальный столб волшебного огня падает с неба. Каждое существо в цилиндре радиусом 100 футов и высотой 1000 футов, центрированном на заклинателе, совершает спасбросок Ловкости. При провале существо получает 15к10 урона огнём и 15к10 урона силовым полем, при успехе — половину.</p>
<p>Вы иммунны к урону огнём этого заклинания, но не к силовому урону, и в эпицентре совершаете спасбросок с помехой.</p>
<p><strong>Автоматизация Foundry:</strong> добавлен бросок 15к10 огнём + 15к10 силовым полем. Область, спасброски и половинный урон применяются через сцену/Midi-QOL или вручную.</p>
`
  }),
  nethereseSpell({
    key: "diluvial-torrent",
    name: "Поток Дилювиаля / Diluvial Torrent",
    img: `${WOW}/Spells/GiftoftheWaterSpirit.png`,
    school: "evo",
    activation: { type: "minute", value: 1 },
    range: { value: null, units: "self", special: "" },
    duration: { value: "0", units: "inst" },
    targetSpecial: "Существа в радиусе 100 футов от заклинателя",
    properties: ["vocal", "somatic", "material"],
    material: "Серебряный гонг стоимостью 500 зм",
    spellActivities: activities(
      utilityActivity({
        key: "diluvial-torrent-close",
        name: "Урон: 20 футов и ближе",
        activation: "action",
        targetType: "creature",
        rollFormula: "10 * @details.level",
        rollName: "Дробящий урон",
        rollVisible: true
      }),
      utilityActivity({
        key: "diluvial-torrent-mid",
        name: "Урон: 30–50 футов",
        activation: "action",
        targetType: "creature",
        rollFormula: "5 * @details.level",
        rollName: "Дробящий урон",
        rollVisible: true
      }),
      utilityActivity({
        key: "diluvial-torrent-far",
        name: "Урон: 50–100 футов",
        activation: "action",
        targetType: "creature",
        rollFormula: "3 * @details.level",
        rollName: "Дробящий урон",
        rollVisible: true
      })
    ),
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Вы вызываете бурный 100-футовый цилиндр воды радиусом 20 футов с высоты 200 футов. Каждое существо в радиусе 100 футов от вас совершает спасбросок Ловкости; при успехе получает половину урона. Вы сами получаете лишь половину урона, но совершаете спасбросок с помехой.</p>
<ul>
  <li>20 футов и ближе: 10 × уровень заклинателя дробящего урона.</li>
  <li>30–50 футов: 5 × уровень заклинателя дробящего урона.</li>
  <li>50–100 футов: 3 × уровень заклинателя дробящего урона.</li>
</ul>
<p><strong>Автоматизация Foundry:</strong> добавлены три расчётные активности урона по дистанции. Риск утопления, область воды, спасброски и половинный урон применяются Мастером.</p>
`
  }),
  nethereseSpell({
    key: "horrible-drought",
    name: "Ужасная засуха / Horrible Drought",
    img: `${WOW}/Miscellaneous/Primal_Nether.png`,
    school: "nec",
    activation: { type: "action", value: 1 },
    range: { value: null, units: "self", special: "Сфера радиусом 150 футов" },
    duration: { value: "0", units: "inst" },
    targetSpecial: "Существа в радиусе 150 футов от заклинателя",
    properties: ["vocal", "somatic", "material"],
    material: "Щепотка порошка сухости",
    spellActivities: activities(
      utilityActivity({
        key: "horrible-drought-damage",
        name: "Некротический урон",
        activation: "action",
        targetType: "creature",
        rollFormula: "24d8[necrotic]",
        rollName: "Ужасная засуха",
        rollVisible: true
      }),
      utilityActivity({
        key: "horrible-drought-consequence",
        name: "Последствие для заклинателя",
        activation: "special",
        rollFormula: "1d6",
        rollName: "Последствие засухи",
        rollVisible: true,
        spellSlot: false
      })
    ),
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Существа в радиусе 150 футов от вас совершают спасбросок Телосложения. Водные элементали и растительные существа делают его с помехой. При провале цель получает 24к8 некротического урона, при успехе — половину.</p>
<p>Вы не подвержены эффекту засухи, но должны совершить спасбросок Телосложения СЛ 20. При провале бросьте к6 и примените последствие: обезвоживание и бессознательность; иссохшая рука; бессрочное безумие; выпадение волос и увядание кожи; слепота; неутолимая жажда.</p>
<p><strong>Автоматизация Foundry:</strong> добавлен бросок 24к8 некротического урона и к6 последствий. Водоёмы, спасброски, половинный урон и последствия применяются Мастером.</p>
`
  }),
  nethereseSpell({
    key: "tolodines-killing-wind",
    name: "Смертоносный ветер Толодина / Tolodine's Killing Wind",
    img: `${WOW}/Abilities/NetherWindPresence.png`,
    school: "evo",
    activation: { type: "minute", value: 1 },
    range: { value: null, units: "self", special: "Сфера радиусом 100 футов" },
    duration: { value: "0", units: "inst" },
    targetSpecial: "Живые существа в радиусе 100 футов",
    properties: ["vocal", "somatic", "material"],
    material: "Череп гуманоида, умершего не более недели назад, расходуемый заклинанием",
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Зелёные ветры окутывают область на 100 футов вокруг вас. Каждое живое существо внутри области совершает спасбросок Телосложения. Нежить и конструкты иммунны. При провале, если у существа меньше 100 хитов, оно умирает.</p>
<p>Вы также совершаете этот спасбросок и погибаете при провале, если у вас меньше 100 хитов. Независимо от успеха, внешний вид необратимо меняется: тело становится истощённым, лицо измождённым, глаза приобретают мистический зелёный блеск.</p>
<p><strong>Автоматизация Foundry:</strong> карточка справочная. Смерть целей по текущим хитам, иммунитет нежити/конструктов и необратимые изменения внешности применяются Мастером.</p>
`
  }),
  nethereseSpell({
    key: "beast-of-a-thousand-legs",
    name: "Тварь о тысяче ног / Beast of a Thousand Legs",
    img: `${WOW}/Spells/CallStorm.png`,
    school: "evo",
    activation: { type: "minute", value: 10 },
    range: { value: null, units: "self", special: "Сфера радиусом 2 мили" },
    duration: { value: "12", units: "hour" },
    targetSpecial: "Торнадо внутри шторма радиусом 2 мили",
    properties: ["vocal", "somatic", "concentration"],
    spellActivities: utilityActivity({
      key: "beast-of-a-thousand-legs-damage",
      name: "Урон торнадо",
      activation: "special",
      targetType: "creature",
      rollFormula: "10d10[bludgeoning]",
      rollName: "Дробящий урон",
      rollVisible: true
    }),
    description: `
<p><strong>Великое заклинание Нетерила.</strong> Вы создаёте шторм радиусом 2 мили. В любое время в нём активны десять торнадо, каждый 15 футов в диаметре. Каждый торнадо существует 1к6 × 10 минут, затем появляется новый в случайном месте шторма.</p>
<p>Существо, попавшее в торнадо, совершает спасбросок Силы. При провале оно подхватывается ветром, получает 10к10 дробящего урона, затем падает с высоты 100 футов и получает полный урон от падения. После окончания шторма вы совершаете спасбросок Силы с помехой СЛ 20; при провале шторм уносит вас в случайном направлении, с 33% шансом — на План Воздуха.</p>
<p><strong>Автоматизация Foundry:</strong> добавлен бросок 10к10 дробящего урона. Перемещение торнадо, спасброски, урон падения и итоговое перемещение заклинателя применяются Мастером.</p>
`
  })
];
