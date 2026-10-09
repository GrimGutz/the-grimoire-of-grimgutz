import {
  MODULE_ID,
  baseDocument,
  sourceData,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Ведьмин клинок; предоставленный PDF PK_WitchBlade (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";

function activities(...entries) {
  return Object.assign({}, ...entries);
}

function spell({
  key,
  name,
  img,
  level,
  school,
  alignment,
  activation = "action",
  activationCondition = "",
  rangeValue = null,
  rangeUnits = "ft",
  rangeSpecial = "",
  durationValue = "",
  durationUnits = "inst",
  targetType = "",
  targetCount = "",
  templateType = "",
  templateSize = "",
  materials = "",
  properties = ["vocal", "somatic"],
  description,
  spellActivities = {}
}) {
  return baseDocument({
    key,
    name,
    type: "spell",
    img,
    flags: {
      [MODULE_ID]: {
        witchBladeSpell: true,
        alignment
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("3–5", SOURCE),
      activation: {
        type: activation,
        condition: activationCondition,
        value: ["action", "reaction"].includes(activation) ? 1 : null
      },
      duration: {
        value: durationValue,
        units: durationUnits
      },
      target: {
        affects: {
          type: targetType,
          count: targetCount,
          choice: false,
          special: ""
        },
        template: {
          count: "",
          contiguous: false,
          type: templateType,
          size: templateSize,
          width: "",
          height: "",
          units: templateType ? "ft" : ""
        }
      },
      range: {
        value: rangeValue,
        units: rangeValue == null ? (rangeSpecial ? "" : "self") : rangeUnits,
        special: rangeSpecial
      },
      uses: {
        max: "",
        spent: 0,
        recovery: []
      },
      level,
      school,
      materials: {
        value: materials,
        consumed: false,
        cost: 0,
        supply: 0
      },
      preparation: {
        mode: "prepared",
        prepared: true
      },
      properties,
      activities: spellActivities,
      identifier: key
    }
  });
}

export const witchBladeSpellDocuments = [
  spell({
    key: "deus-ex-ferrum",
    name: "Бог из стали",
    img: `${WOW}/Spells/BladedArmor.png`,
    level: 3,
    school: "abj",
    alignment: "good",
    rangeSpecial: "На себя (60 футов)",
    durationValue: "1",
    durationUnits: "minute",
    targetType: "ally",
    targetCount: "@classes.witch-blade.levels",
    properties: ["vocal", "somatic", "concentration"],
    spellActivities: utilityActivity({ key: "deus-ex-ferrum", name: "Связать разум с доспехами", activation: "action", rangeValue: 60, targetType: "ally", targetCount: "@classes.witch-blade.levels" }),
    description: "<p><strong>Только для Добра.</strong></p><p>Вы и количество союзников, равное вашему уровню Ведьминого клинка, получаете сопротивление дробящему, колющему и рубящему урону и не можете быть ошеломлены или сбиты с ног.</p><hr><p><strong>Автоматизация Foundry:</strong> активность отмечает цели и дистанцию; сопротивления и иммунитеты накладываются вручную или временным DAE-эффектом.</p>"
  }),
  spell({
    key: "avenging-flame",
    name: "Мстительное пламя",
    img: `${WOW}/Spells/BlueFire.png`,
    level: 2,
    school: "evo",
    alignment: "good",
    activation: "reaction",
    activationCondition: "Союзник получает урон от рукопашной атаки оружием",
    rangeValue: 30,
    targetType: "creature",
    targetCount: "1",
    spellActivities: utilityActivity({ key: "avenging-flame", name: "Дальнобойная атака заклинанием", activation: "reaction", condition: "Союзник получает урон от рукопашной атаки оружием", rangeValue: 30, targetType: "creature", targetCount: "1", rollFormula: "3d8", rollName: "Урон излучением", rollVisible: true }),
    description: "<p><strong>Только для Добра.</strong></p><p>Когда союзнику причиняют вред рукопашной атакой оружием, совершите дальнобойную атаку заклинанием по виновному существу. При попадании цель получает 3к8 урона излучением.</p><p><strong>На более высоких уровнях.</strong> При ячейке 3-го уровня или выше урон увеличивается на 1к8 за каждый уровень ячейки выше 2-го.</p>"
  }),
  spell({
    key: "gate-of-infinity",
    name: "Врата бесконечности",
    img: `${WOW}/Spells/ArcaneTorrent.png`,
    level: 5,
    school: "con",
    alignment: "good",
    rangeSpecial: "На себя (10 футов)",
    targetType: "ally",
    spellActivities: utilityActivity({ key: "gate-of-infinity", name: "Протащить союзников через реальность", activation: "action", rangeValue: 10, targetType: "ally" }),
    description: "<p><strong>Только для Добра.</strong></p><p>Вы и все желающие союзники в пределах 10 футов исчезаете и появляетесь в пустом пространстве в пределах 300 футов от ваших начальных местоположений.</p><hr><p><strong>Автоматизация Foundry:</strong> активность отмечает радиус союзников; перемещение токенов выполняется вручную.</p>"
  }),
  spell({
    key: "feather-of-judgement",
    name: "Перо правосудия",
    img: "icons/magic/holy/projectiles-blades-salvo-yellow.webp",
    level: 4,
    school: "div",
    alignment: "good",
    rangeValue: 60,
    targetType: "creature",
    targetCount: "1",
    spellActivities: utilityActivity({ key: "feather-of-judgement", name: "Суд молнией", activation: "action", rangeValue: 60, targetType: "creature", targetCount: "1", rollFormula: "10d6", rollName: "Урон молнией", rollVisible: true }),
    description: "<p><strong>Только для Добра.</strong></p><p>Если цель злая, она совершает спасбросок Телосложения, получая 10к6 урона молнией при провале или половину при успехе. Если цель добрая или нейтральная, ничего не происходит.</p><p><strong>На более высоких уровнях.</strong> При ячейке 5-го уровня или выше урон увеличивается на 1к6 за каждый уровень ячейки выше 4-го.</p>"
  }),
  spell({
    key: "jaws-of-the-star-devourer",
    name: "Челюсти пожирателя звезд",
    img: `${WOW}/Spells/BlueFireNova.png`,
    level: 1,
    school: "enc",
    alignment: "good",
    rangeSpecial: "На себя (30 футов)",
    durationValue: "1",
    durationUnits: "round",
    targetType: "ally",
    spellActivities: utilityActivity({ key: "jaws-of-the-star-devourer", name: "Космическое инферно", activation: "action", rangeValue: 30, targetType: "ally", rollFormula: "1d6 + 1d6", rollName: "Дополнительный урон огнём и излучением", rollVisible: true }),
    description: "<p><strong>Только для Добра.</strong></p><p>Вы и союзники в пределах 30 футов в этом раунде наносите всеми атаками оружием дополнительные 1к6 урона огнём и 1к6 урона излучением.</p><p><strong>На более высоких уровнях.</strong> При ячейке 2-го уровня или выше заклинание длится на 1 дополнительный раунд.</p>"
  }),
  spell({
    key: "chaos-bolt-witch",
    name: "Колдовская стрела",
    img: `${WOW}/Abilities/ChaosBolt.png`,
    level: 2,
    school: "con",
    alignment: "evil",
    rangeSpecial: "На себя (90-футовая линия)",
    templateType: "line",
    templateSize: "90",
    targetType: "creature",
    spellActivities: utilityActivity({ key: "chaos-bolt-witch", name: "Линия хаотической силы", activation: "action", rollFormula: "6d6", rollName: "Урон силовым полем", rollVisible: true }),
    description: "<p><strong>Только для Зла.</strong></p><p>Все существа в линии 90 футов длиной и 5 футов шириной совершают спасбросок Ловкости, получая 6к6 урона силовым полем при провале и половину при успехе.</p><p><strong>На более высоких уровнях.</strong> При ячейке 3-го уровня или выше урон увеличивается на 2к6 за каждый уровень ячейки выше 2-го.</p><hr><p><strong>Автоматизация Foundry:</strong> разместите линию с началом на своём токене. Midi-QOL выбирает цели, проводит спасброски Ловкости и затем открывает бросок урона. Повышение уровня ячейки добавляет 2к6 за уровень. Отмена размещения не расходует ячейку.</p>"
  }),
  spell({
    key: "blood-lance",
    name: "Кровавое копье",
    img: `${WOW}/Weapons/Blood_02.png`,
    level: 3,
    school: "nec",
    alignment: "evil",
    rangeValue: 60,
    targetType: "creature",
    targetCount: "1",
    materials: "пинта вашей собственной крови, которую заклинание вытягивает",
    properties: ["vocal", "somatic", "material"],
    spellActivities: activities(
      utilityActivity({ key: "blood-lance-self", name: "Цена крови", activation: "action", rollFormula: "2d8", rollName: "Некротический урон себе", rollVisible: true }),
      utilityActivity({ key: "blood-lance-attack", name: "Дальнобойная атака кровью", activation: "action", rangeValue: 60, targetType: "creature", targetCount: "1", rollFormula: "8d8", rollName: "Некротический урон цели", rollVisible: true })
    ),
    description: "<p><strong>Только для Зла.</strong></p><p>Вы получаете 2к8 некротического урона, который не может быть уменьшен. Затем совершаете дальнобойную атаку заклинанием; при попадании цель получает 8к8 некротического урона и становится отравленной.</p>"
  }),
  spell({
    key: "hint",
    name: "Намек",
    img: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
    level: 4,
    school: "div",
    alignment: "evil",
    activation: "minute",
    durationValue: "10",
    durationUnits: "minute",
    materials: "пепел гуманоида, которого вы убили, и капля крови цели",
    properties: ["vocal", "somatic", "material"],
    spellActivities: utilityActivity({ key: "hint", name: "Заложить дезинформацию", activation: "minute" }),
    description: "<p><strong>Только для Зла.</strong></p><p>Вы устанавливаете связь с судьбой цели и закладываете дезинформацию в её будущее. Дезинформация не может причинить физический вред. Цель может осознать влияние проверкой Магии Сл 20; Сл уменьшается на 1 за каждую встреченную дезинформацию.</p><hr><p><strong>Автоматизация Foundry:</strong> заклинание описательное; проверки и последствия ведёт Мастер.</p>"
  }),
  spell({
    key: "gift-of-chaos",
    name: "Дар хаоса",
    img: `${WOW}/Spells/Arcane04.png`,
    level: 1,
    school: "enc",
    alignment: "evil",
    rangeSpecial: "На себя (30 футов)",
    targetType: "ally",
    spellActivities: utilityActivity({ key: "gift-of-chaos", name: "Определить мутацию", activation: "action", rangeValue: 30, targetType: "ally", rollFormula: "1d6", rollName: "Мутация", rollVisible: true }),
    description: "<p><strong>Только для Зла.</strong></p><p>Все союзники в пределах 30 футов мутируют. Нежелающее существо может совершить спасбросок Харизмы. Мутацию снимают только Великое восстановление или Снятие проклятия.</p><ol><li>Когти: нельзя использовать двуручное оружие, два когтя 1к4 рубящего.</li><li>Пилозубый язык: атака языком 1к4 колющего и краткосрочное безумие.</li><li>Щупальце: атака 1к6 дробящего.</li><li>Второй рот: вербальные заклинания с временем 1 действие можно накладывать бонусным действием; долгосрочное безумие.</li><li>Крылья: 2к10 колющего урона и скорость полёта 30 футов.</li><li>Улей демонов: скорость 0; в начале каждого хода появляется 1к4 шипастых дьяволов.</li></ol>"
  }),
  spell({
    key: "cacophonic-scream",
    name: "Какофонический вопль",
    img: `${WOW}/Spells/DeathScream.png`,
    level: 5,
    school: "ill",
    alignment: "evil",
    rangeSpecial: "На себя (30-футовый конус)",
    durationValue: "1",
    durationUnits: "minute",
    templateType: "cone",
    templateSize: "30",
    targetType: "creature",
    properties: ["vocal", "somatic", "concentration"],
    spellActivities: utilityActivity({ key: "cacophonic-scream", name: "Вопль", activation: "action", rollFormula: "4d8", rollName: "Психический урон", rollVisible: true }),
    description: "<p><strong>Только для Зла.</strong></p><p>Все существа в 30-футовом конусе совершают спасбросок Мудрости. При провале существо получает 4к8 психического урона и очаровано вами на время действия; при успехе получает половину урона и не очаровано.</p><hr><p><strong>Автоматизация Foundry:</strong> разместите конус с началом на своём токене. Midi-QOL выбирает цели, проводит спасброски Мудрости и затем открывает бросок 4к8 урона. При успехе — половина урона; очарование накладывается только при провале и связано с минутной концентрацией. Отмена размещения не расходует ячейку.</p>"
  })
];
