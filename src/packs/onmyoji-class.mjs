import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  uuidFor,
} from "../common.mjs";

const SOURCE = "Престиж-класс: Онмёджи; предоставленный PDF PK_-_Onmyodzhi.pdf";
const CLASS_ART = "icons/magic/holy/yin-yang-balance-symbol.webp";

const FEATURE_LABELS = {
  "onmyoji-ki": "Ки",
  "shikigami-talisman": "Талисман Шикигами",
  "purification-rite": "Обряд Очищения",
  "shikigami-ghost-hunter": "Шикигами Призрачный Охотник",
  "spirit-place": "Место Духа",
  "spirit-alcohol": "Дух Алкоголя",
  "spirit-book": "Дух Книги",
  "spirit-fire": "Дух Огня",
  "spirit-food": "Дух Еды",
  "spirit-mountain": "Дух Горы",
  "spirit-steel": "Дух Стали",
  "spirit-water": "Дух Воды",
  "spirit-wood": "Дух Дерева",
  "spirit-wealth": "Дух Богатства",
  "spirit-wind": "Дух Ветра",
};

const featureLink = (key) => `@UUID[${uuidFor("features", key)}]{${FEATURE_LABELS[key] ?? key}}`;

const SPIRITS = [
  "spirit-alcohol",
  "spirit-book",
  "spirit-fire",
  "spirit-food",
  "spirit-mountain",
  "spirit-steel",
  "spirit-water",
  "spirit-wood",
  "spirit-wealth",
  "spirit-wind",
];

const description = `
<p>Онмёджи, также известный как Спиритуалист или Экзорцист, сохраняет духовный баланс и взаимодействует с духами-ками, обитающими в вещах, местах и стихиях. Этот престиж-класс использует Мудрость для СЛ способностей Онмёджи и ресурс Ки для чар Мировых Духов.</p>
<h3>Требования</h3>
<ul>
  <li>Мудрость 15.</li>
  <li>Харизма 13.</li>
  <li>Владение навыком Религия.</li>
  <li>5-й уровень персонажа.</li>
  <li>Сюжетное задание: столкнуться и поговорить с любым Мировым Духом. Для достижения 5-го уровня класса требуется уничтожить одну разумную нежить.</li>
</ul>
<p><strong>Автоматизация Foundry:</strong> при включенной строгой проверке модуль проверяет Мудрость, Харизму, владение Религией и общий уровень персонажа. Сюжетные условия подтверждает Мастер.</p>
<h3>Классовые особенности</h3>
<table><thead><tr><th>Уровень</th><th>Особенности</th><th>Очки Ки</th></tr></thead><tbody>
  <tr><td>1</td><td>${featureLink("onmyoji-ki")}, ${featureLink("shikigami-talisman")}, выбор трех Мировых Духов</td><td>1</td></tr>
  <tr><td>2</td><td>${featureLink("purification-rite")}</td><td>2</td></tr>
  <tr><td>3</td><td>${featureLink("shikigami-ghost-hunter")}</td><td>3</td></tr>
  <tr><td>4</td><td>Увеличение характеристик</td><td>4</td></tr>
  <tr><td>5</td><td>${featureLink("spirit-place")}</td><td>5</td></tr>
</tbody></table>
<h3>Мировые Духи</h3>
<p>На 1-м уровне вы выбираете три Мировых Духа: ${SPIRITS.map(featureLink).join(", ")}. Вы можете использовать их Малые Чары за 1 Ки или десятиминутный ритуал. С 3-го уровня вы можете использовать их Великие Чары за 3 Ки. С 5-го уровня вы получаете постоянные Пассивные Чары выбранных духов.</p>
`;

export const onmyojiClassDocuments = [
  baseDocument({
    key: "onmyoji",
    name: "Онмёджи / Onmyoji",
    type: "class",
    img: CLASS_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "onmyoji",
      },
    },
    system: {
      description: {
        value: description.trim(),
        chat: "",
      },
      source: sourceData("1-3", SOURCE),
      identifier: "onmyoji",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("onmyoji-hit-points"),
        traitAdvancement({
          key: "onmyoji-tools",
          level: 1,
          title: "Владение инструментами Онмёджи",
          grants: ["tool:herb", "tool:calligrapher"],
        }),
        traitAdvancement({
          key: "onmyoji-longbow",
          level: 1,
          title: "Владение длинным луком",
          grants: ["weapon:mar:longbow"],
        }),
        scaleValueAdvancement({
          key: "onmyoji-ki-points",
          identifier: "ki-points",
          title: "Очки Ки",
          scale: {
            1: { value: 1 },
            2: { value: 2 },
            3: { value: 3 },
            4: { value: 4 },
            5: { value: 5 },
          },
        }),
        itemGrant({
          key: "onmyoji-level-1-features",
          title: "Особенности Онмёджи 1-го уровня",
          level: 1,
          items: ["onmyoji-ki", "shikigami-talisman"],
        }),
        itemChoice({
          key: "onmyoji-world-spirits",
          title: "Мировые Духи",
          hint: "Выберите трех Мировых Духов. На 1-м уровне доступны их Малые Чары, на 3-м - Великие Чары, на 5-м - Пассивные Чары.",
          level: 1,
          count: 3,
          items: SPIRITS,
        }),
        itemGrant({
          key: "onmyoji-level-2-features",
          title: "Особенности Онмёджи 2-го уровня",
          level: 2,
          items: ["purification-rite"],
        }),
        itemGrant({
          key: "onmyoji-level-3-features",
          title: "Особенности Онмёджи 3-го уровня",
          level: 3,
          items: ["shikigami-ghost-hunter"],
        }),
        abilityScoreImprovementAdvancement({
          key: "onmyoji-level-4-asi",
          level: 4,
        }),
        itemGrant({
          key: "onmyoji-level-5-features",
          title: "Особенности Онмёджи 5-го уровня",
          level: 5,
          items: ["spirit-place"],
        }),
      ],
      saves: [],
      skills: {
        number: 0,
        choices: [],
        value: [],
      },
      spellcasting: {
        progression: "none",
        ability: "wis",
        preparation: {
          formula: "",
        },
      },
      wealth: "",
      primaryAbility: {
        value: [],
        all: false,
      },
    },
  }),
];
