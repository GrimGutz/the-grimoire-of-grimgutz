import {
  feature,
  folder,
  idFor,
  utilityActivity,
} from "../common.mjs";

const SOURCE = "Престиж-класс: Онмёджи; предоставленный PDF PK_-_Onmyodzhi.pdf";
const MAIN_FOLDER = idFor("folder:onmyoji-features");
const SPIRITS_FOLDER = idFor("folder:onmyoji-world-spirits");

const ICONS = {
  ki: "icons/magic/holy/yin-yang-balance-symbol.webp",
  shikigami: "icons/commodities/materials/parchment-secrets.webp",
  purification: "icons/magic/holy/barrier-shield-winged-blue.webp",
  hunter: "icons/magic/control/debuff-energy-hold-levitate-pink.webp",
  place: "icons/magic/holy/angel-winged-humanoid-blue.webp",
  alcohol: "icons/consumables/drinks/alcohol-spirits-bottle-blue.webp",
  book: "icons/sundries/books/book-eye-pink.webp",
  fire: "icons/magic/fire/dagger-rune-enchant-flame-red.webp",
  food: "icons/consumables/food/bowl-stew-brown.webp",
  mountain: "icons/commodities/stone/boulder-grey.webp",
  steel: "icons/commodities/metal/fragments-steel-barbed.webp",
  water: "icons/magic/water/elemental-water.webp",
  wood: "icons/magic/nature/tree-spirit-green.webp",
  wealth: "icons/commodities/currency/coin-embossed-crown-gold.webp",
  wind: "icons/magic/air/air-wave-gust-blue.webp",
};

export const onmyojiFolders = [
  folder({ key: "onmyoji-features", name: "Онмёджи: классовые особенности", sort: 1110000 }),
  folder({ key: "onmyoji-world-spirits", name: "Онмёджи: Мировые Духи", sort: 1111000 }),
];

function automationDescription(body, automation) {
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
      { period: "lr", type: "recoverAll" },
    ],
  };
}

function onmyojiFeature({
  key,
  name,
  img,
  level,
  description,
  automation,
  uses = null,
  activities = {},
  folder = MAIN_FOLDER,
  extraAutomation = {},
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Онмёджи ${level}`,
    folder,
    uses,
    activities,
    automation: {
      feature: key,
      onmyojiFeature: true,
      minimumLevel: level,
      ...extraAutomation,
    },
    sourcePage: "1-3",
    sourceCustom: SOURCE,
    description: automation
      ? automationDescription(description.trim(), automation)
      : description.trim(),
  });
}

function kiActivity({
  key,
  name,
  cost,
  formula = "",
  rollName = "",
  activation = "special",
  condition = "",
  rangeValue = null,
  targetType = "",
  targetCount = "",
}) {
  return utilityActivity({
    key,
    name,
    action: "use-onmyoji-ki",
    actionData: {
      onmyojiKiCost: cost,
      onmyojiRollFormula: formula,
      onmyojiRollName: rollName,
    },
    activation,
    condition,
    rangeValue,
    targetType,
    targetCount,
    targetChoice: Boolean(targetType),
    spellSlot: false,
  });
}

function spiritFeature({
  key,
  name,
  subtitle,
  img,
  minor,
  great,
  passive,
  minorFormula = "",
  minorRoll = "",
  greatFormula = "",
  greatRoll = "",
}) {
  return onmyojiFeature({
    key,
    name,
    img,
    level: 1,
    folder: SPIRITS_FOLDER,
    extraAutomation: {
      onmyojiSpiritFeature: true,
    },
    activities: {
      ...kiActivity({
        key: `${key}-minor`,
        name: `Малая Чара: ${subtitle}`,
        cost: 1,
        formula: minorFormula,
        rollName: minorRoll,
      }),
      ...kiActivity({
        key: `${key}-great`,
        name: `Великая Чара: ${subtitle}`,
        cost: 3,
        formula: greatFormula,
        rollName: greatRoll,
      }),
    },
    description: `
<h3>${subtitle}</h3>
<p><strong>Малая Чара:</strong> ${minor}</p>
<p><strong>Великая Чара:</strong> ${great}</p>
<p><strong>Пассивная Чара:</strong> ${passive}</p>
`,
    automation: "активности Малой и Великой Чары тратят Ки с карточки «Ки». Пассивная Чара становится доступна на 5-м уровне Онмёджи и применяется вручную, если эффект зависит от выбранного духа.",
  });
}

export const onmyojiDocuments = [
  onmyojiFeature({
    key: "onmyoji-ki",
    name: "Ки",
    img: ICONS.ki,
    level: 1,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "onmyoji-sync-ki",
      name: "Синхронизировать Ки",
      action: "sync-onmyoji-resources",
      activation: "special",
      spellSlot: false,
    }),
    description: `
<p>Начиная с 1-го уровня вы используете таинственную энергию Ки. Количество очков Ки равно вашему уровню Онмёджи: 1 на 1-м уровне, 2 на 2-м, 3 на 3-м, 4 на 4-м и 5 на 5-м. Потраченные очки восстанавливаются после короткого или длительного отдыха.</p>
<p>Некоторые способности Онмёджи требуют спасбросок. СЛ спасброска = 8 + бонус мастерства + модификатор Мудрости.</p>
`,
    automation: "карточка хранит текущий запас Ки как uses.max и синхронизирует его с уровнем Онмёджи. Активности Мировых Духов списывают Ки через эту карточку.",
  }),
  onmyojiFeature({
    key: "shikigami-talisman",
    name: "Талисман Шикигами",
    img: ICONS.shikigami,
    level: 1,
    description: `
<p>На 1-м уровне вы вызываете и привязываете личного духа при помощи бумажного талисмана. Этот дух называется Шикигами и считается хранителем в соответствии с заклинанием «Поиск фамильяра».</p>
<p>Если Шикигами уничтожен, его нельзя призвать снова, пока вы не создадите новое бумажное тело за 2 зм и 10 минут. Шикигами считается фамильяром-совой с двумя изменениями: его КД равен 13, и он может проходить через двери и окна, не защищенные магически.</p>
`,
    automation: "создание и управление отдельным актером Шикигами выполняется вручную. Карточка хранит правила отличий от стандартного фамильяра.",
  }),
  onmyojiFeature({
    key: "purification-rite",
    name: "Обряд Очищения",
    img: ICONS.purification,
    level: 2,
    uses: shortRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "purification-sanctuary",
        name: "Офуда: Святилище",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false,
      }),
      ...utilityActivity({
        key: "purification-undead",
        name: "Офуда: уничтожить нежить",
        activation: "action",
        condition: "Нежить с ПО не выше половины уровня Онмёджи, округляя вверх",
        consumeItemUse: true,
        targetType: "creature",
        targetCount: "1",
        targetChoice: true,
        spellSlot: false,
      }),
      ...utilityActivity({
        key: "purification-damage",
        name: "Офуда: очищающий урон",
        activation: "action",
        consumeItemUse: true,
        targetType: "creature",
        targetCount: "1",
        targetChoice: true,
        spellSlot: false,
        rollFormula: "3d6 + 3d6",
        rollName: "Дробящий и огненный урон",
        rollVisible: true,
      }),
    },
    description: `
<p>На 2-м уровне вы научились создавать и напитывать духовной силой офуда - особые бумажные печати. Количество использований равно модификатору Мудрости и восстанавливается после короткого отдыха.</p>
<ul>
  <li>Используйте «Святилище» как заклинание.</li>
  <li>Совершите атаку ближнего или дальнего боя, чтобы прикрепить офуда на нежить с показателем опасности не выше половины вашего уровня Онмёджи, округляя вверх. Существо совершает спасбросок Телосложения против вашей СЛ. При провале нежить уничтожается.</li>
  <li>Совершите атаку ближнего или дальнего боя, чтобы прикрепить офуда на любую цель. Цель совершает спасбросок Ловкости. При провале получает 3к6 дробящего и 3к6 огненного урона, при успехе - половину.</li>
</ul>
`,
    automation: "модуль синхронизирует количество использований с модификатором Мудрости. Активность очищающего урона бросает 3к6 + 3к6; атака, спасбросок, проверка ПО нежити и уничтожение цели выполняются вручную.",
  }),
  onmyojiFeature({
    key: "shikigami-ghost-hunter",
    name: "Шикигами Призрачный Охотник",
    img: ICONS.hunter,
    level: 3,
    activities: utilityActivity({
      key: "shikigami-attack",
      name: "Приказать Шикигами атаковать",
      activation: "bonus",
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      spellSlot: false,
    }),
    description: `
<p>Начиная с 3-го уровня ваш Шикигами может принять форму любого среднего зверя с показателем опасности не выше 1/4, и ему больше не требуется бумажное тело. Его характеристики равны характеристикам выбранной формы, кроме КД 13.</p>
<p>Шикигами может атаковать один раз, если вы используете для этого бонусное действие. Пока Шикигами существует, ваш максимум хитов нельзя уменьшить. Если вы отпускаете Шикигами как фамильяра, его существование остается полупрозрачной духовной пеленой, повышающей ваш КД на 2.</p>
<p>Также вы можете использовать Великие Чары выбранных духов за 3 Ки.</p>
`,
    automation: "активность напоминает о бонусном действии для атаки Шикигами. Форма зверя, КД, защита максимума хитов и условный бонус КД применяются вручную.",
  }),
  onmyojiFeature({
    key: "spirit-place",
    name: "Место Духа",
    img: ICONS.place,
    level: 5,
    description: `
<p>Получив 5-й уровень, вы достигаете вершины духовного баланса со своим Шикигами. Хиты Шикигами удваиваются, его КД становится 15, и каждый раз, когда он атакует, он использует ваш модификатор атаки для всех своих атак и бросков урона.</p>
<p>Пока Шикигами существует, вы получаете полный иммунитет к параличу. Если вы отпускаете Шикигами как фамильяра, его существование остается в форме виспов, которые добавляют модификатор Мудрости к вашим атакам как урон светом.</p>
<p>Также вы можете использовать постоянные Пассивные Чары трех духов, выбранных для Талисмана Шикигами.</p>
`,
    automation: "улучшения Шикигами, иммунитет к параличу, урон светом от виспов и Пассивные Чары зависят от текущего состояния Шикигами и выбранных духов, поэтому применяются вручную.",
  }),
  spiritFeature({
    key: "spirit-alcohol",
    name: "Дух Алкоголя",
    subtitle: "Узы",
    img: ICONS.alcohol,
    minor: "в следующий раз, когда вы атакуете, весь урон этой атаки считается психическим.",
    great: "число целей, равное вашему модификатору Мудрости, минимум 1, совершает спасбросок Харизмы. При провале цели считаются дружественными в течение 10 минут.",
    passive: "ваш показатель Харизмы становится равен показателю Мудрости, если он меньше.",
  }),
  spiritFeature({
    key: "spirit-book",
    name: "Дух Книги",
    subtitle: "Знание",
    img: ICONS.book,
    minor: "вы можете совершить следующий бросок, основанный на Интеллекте, с преимуществом.",
    great: "выберите любую комбинацию из 3 навыков или инструментов; вы получаете владение ими на 1 минуту.",
    passive: "выберите любую комбинацию из 3 навыков или инструментов; вы получаете владение ими постоянно.",
  }),
  spiritFeature({
    key: "spirit-fire",
    name: "Дух Огня",
    subtitle: "Очищение",
    img: ICONS.fire,
    minor: "в следующий раз, когда вы атакуете, вы можете нанести 2к6 огненного урона.",
    great: "вы находитесь под эффектом «Облачения Огня» в течение 1 минуты.",
    passive: "вы получаете иммунитет к огню.",
    minorFormula: "2d6",
    minorRoll: "Огненный урон",
  }),
  spiritFeature({
    key: "spirit-food",
    name: "Дух Еды",
    subtitle: "Подкрепление",
    img: ICONS.food,
    minor: "вы можете совершить следующий бросок, основанный на Телосложении, с преимуществом.",
    great: "вы получаете все преимущества длительного отдыха.",
    passive: "вам больше не нужна еда или вода.",
  }),
  spiritFeature({
    key: "spirit-mountain",
    name: "Дух Горы",
    subtitle: "Устойчивость",
    img: ICONS.mountain,
    minor: "когда вы должны получить урон от любого источника, бросьте 1к12 + модификатор Мудрости и уменьшите урон на эту сумму.",
    great: "вы получаете сопротивление дробящему, колющему и рубящему урону от немагического оружия и оружия не из адамантина на 1 минуту.",
    passive: "безоружные атаки наносят на одну кость урона больше.",
    minorFormula: "1d12 + @abilities.wis.mod",
    minorRoll: "Уменьшение урона",
  }),
  spiritFeature({
    key: "spirit-steel",
    name: "Дух Стали",
    subtitle: "Темперамент",
    img: ICONS.steel,
    minor: "вы можете совершить следующий бросок, основанный на Силе, с преимуществом.",
    great: "вы невосприимчивы к страху на 1 минуту, получаете 2к10 временных хитов, а атаки оружием наносят одну дополнительную кость урона.",
    passive: "вы получаете владение всем воинским оружием.",
    greatFormula: "2d10",
    greatRoll: "Временные хиты",
  }),
  spiritFeature({
    key: "spirit-water",
    name: "Дух Воды",
    subtitle: "Чистота",
    img: ICONS.water,
    minor: "вы можете исцелить одну цель на 1к8 + модификатор Мудрости.",
    great: "вы можете использовать «Полное исцеление» в соответствии с заклинанием.",
    passive: "всякий раз, когда вы восстанавливаете хиты, вы получаете максимальный результат броска.",
    minorFormula: "1d8 + @abilities.wis.mod",
    minorRoll: "Исцеление",
  }),
  spiritFeature({
    key: "spirit-wood",
    name: "Дух Дерева",
    subtitle: "Осознание",
    img: ICONS.wood,
    minor: "вы можете говорить с растениями в течение 1 минуты, как при заклинании «Разговор с растениями».",
    great: "вы можете использовать «Высшее восстановление» в соответствии с заклинанием.",
    passive: "вы получаете истинное зрение в пределах 30 футов.",
  }),
  spiritFeature({
    key: "spirit-wealth",
    name: "Дух Богатства",
    subtitle: "Самодостаточный",
    img: ICONS.wealth,
    minor: "вы можете совершить следующий бросок, основанный на Харизме, с преимуществом.",
    great: "вы можете найти у себя в рюкзаке или карманах несколько предметов небольшой стоимости.",
    passive: "раз в день вы можете перебросить любой к20 и выбрать лучший бросок.",
  }),
  spiritFeature({
    key: "spirit-wind",
    name: "Дух Ветра",
    subtitle: "Свобода",
    img: ICONS.wind,
    minor: "вы можете совершить следующий бросок, основанный на Ловкости, с преимуществом.",
    great: "вы находитесь под эффектом «Облачения Ветра» в течение 1 минуты.",
    passive: "ваша скорость движения увеличивается на 10 футов.",
  }),
];
