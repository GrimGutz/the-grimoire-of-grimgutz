import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitChoiceAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Сангвинист; предоставленный PDF САНГВИНИСТ_PK (1).pdf";
const ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/BloodTap.png";

const FEATURE_LABELS = {
  "sanguinist-blood-magic": "Кровавая магия",
  hematurgy: "Гематургия",
  "sanguinist-spellcasting": "Накладывание заклинаний",
  "student-of-blood": "Ученик крови",
  "sanguine-power": "Багровая сила",
  "vital-restoration": "Жизненное восстановление",
  "blood-compatibility": "Кровавая совместимость",
  "ritual-sacrifice": "Ритуальное жертвоприношение",
  "crimson-mastery": "Багровое мастерство",
  "my-own-blood": "Моя собственная кровь",
  "blood-of-others": "Кровь других",
  "arterial-puppetry": "Артериальная марионетка",
  "blood-backlash": "Кровавая обратная связь",
  bloodletting: "Кровопускание",
  contusion: "Ушиб",
  "crimson-fury": "Багровая ярость",
  "sanguine-storm": "Багровая буря",
  transfusion: "Переливание",
  vampirism: "Вампиризм"
};

const COMPATIBILITY_CHOICES = ["my-own-blood", "blood-of-others"];
const CRIMSON_MASTERY_CHOICES = [
  "arterial-puppetry",
  "blood-backlash",
  "bloodletting",
  "contusion",
  "crimson-fury",
  "sanguine-storm",
  "transfusion",
  "vampirism"
];

function featureLink(identifier, label = FEATURE_LABELS[identifier] ?? identifier) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function scale(values) {
  return Object.fromEntries(Object.entries(values).map(([level, value]) => [level, { value }]));
}

const description = `
  <h1>Престиж-класс: Сангвинист / Sanguinist</h1>
  <p>Сангвинисты — заклинатели, посвятившие часть своих изысканий изучению кровавой магии и тайн самой крови. Они извлекают силу из собственной жизненной энергии и крови врагов, превращая её в заклинания, ритуалы и багровые техники.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Интеллект, Мудрость или Харизма 15.</strong></li>
    <li><strong>11-й уровень персонажа.</strong></li>
    <li><strong>Накладывание заклинаний или Договор магии.</strong> У вас должны быть ячейки заклинаний от классовой особенности.</li>
    <li><strong>Hematurgy, Blood Rites, Pact of the Blood или черта Blood Mage.</strong> Вы должны уже уметь использовать кровавую магию.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет одну ментальную характеристику 15, общий уровень персонажа 11 и наличие ячеек заклинаний/пакт-магии. Наличие сторонней кровавой магии проверяется по названиям/идентификаторам features на листе; если она записана нестандартно, Мастер может временно отключить строгую проверку.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Сангвиниста.</p>
  <p><strong>Хиты на 1-м уровне:</strong> 8 + модификатор Телосложения.</p>
  <p><strong>Хиты на следующих уровнях:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Владения:</strong> инструменты — нет; спасброски — нет; навыки — выберите Магию, Запугивание, Медицину, Природу или Религию.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Особенности</th><th>Исп. Кровавой магии</th><th>Известно кровавых заклинаний</th><th>1-й</th><th>2-й</th><th>3-й</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("sanguinist-blood-magic")}, ${featureLink("hematurgy")}, ${featureLink("sanguinist-spellcasting")}, ${featureLink("student-of-blood")}</td><td>2</td><td>2</td><td>2</td><td>—</td><td>—</td></tr>
      <tr><td>2</td><td>${featureLink("sanguine-power")}, ${featureLink("vital-restoration")}</td><td>3</td><td>2</td><td>3</td><td>—</td><td>—</td></tr>
      <tr><td>3</td><td>${featureLink("blood-compatibility")}</td><td>5</td><td>3</td><td>4</td><td>2</td><td>—</td></tr>
      <tr><td>4</td><td>Улучшение характеристик, ${featureLink("ritual-sacrifice")}</td><td>7</td><td>3</td><td>4</td><td>3</td><td>—</td></tr>
      <tr><td>5</td><td>${featureLink("crimson-mastery")}</td><td>10</td><td>4</td><td>4</td><td>3</td><td>2</td></tr>
    </tbody>
  </table>

  <p><strong>Кровавая совместимость:</strong> на 3-м уровне выберите ${featureLink("my-own-blood", "Моя собственная кровь")} или ${featureLink("blood-of-others", "Кровь других")}.</p>
  <p><strong>Багровое мастерство:</strong> на 5-м уровне выберите две техники: ${CRIMSON_MASTERY_CHOICES.map(identifier => featureLink(identifier)).join(", ")}.</p>
`;

export const sanguinistClassDocuments = [
  baseDocument({
    key: "sanguinist-class",
    name: "Сангвинист / Sanguinist",
    type: "class",
    img: ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "sanguinist"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–5", SOURCE),
      identifier: "sanguinist",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("sanguinist-hit-points"),
        traitChoiceAdvancement({
          key: "sanguinist-skill",
          level: 1,
          pool: ["skills:arc", "skills:itm", "skills:med", "skills:nat", "skills:rel"],
          count: 1,
          title: "Сангвинист: навык",
          hint: "Выберите Магию, Запугивание, Медицину, Природу или Религию."
        }),
        scaleValueAdvancement({
          key: "sanguinist-blood-magic-uses",
          identifier: "blood-magic-uses",
          title: "Использований Кровавой магии",
          scale: scale({ 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 })
        }),
        scaleValueAdvancement({
          key: "sanguinist-known-blood-spells",
          identifier: "known-blood-spells",
          title: "Известно Кровавых заклинаний",
          scale: scale({ 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 })
        }),
        scaleValueAdvancement({
          key: "sanguinist-spell-slots-1",
          identifier: "spell-slots-1",
          title: "Ячейки 1-го круга",
          scale: scale({ 1: 2, 2: 3, 3: 4, 4: 4, 5: 4 })
        }),
        scaleValueAdvancement({
          key: "sanguinist-spell-slots-2",
          identifier: "spell-slots-2",
          title: "Ячейки 2-го круга",
          scale: scale({ 1: 0, 2: 0, 3: 2, 4: 3, 5: 3 })
        }),
        scaleValueAdvancement({
          key: "sanguinist-spell-slots-3",
          identifier: "spell-slots-3",
          title: "Ячейки 3-го круга",
          scale: scale({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 })
        }),
        itemGrant({
          key: "sanguinist-level-1-features",
          level: 1,
          items: ["sanguinist-blood-magic", "hematurgy", "sanguinist-spellcasting", "student-of-blood"]
        }),
        itemGrant({
          key: "sanguinist-level-2-features",
          level: 2,
          items: ["sanguine-power", "vital-restoration"]
        }),
        itemGrant({
          key: "sanguinist-level-3-features",
          level: 3,
          items: ["blood-compatibility"]
        }),
        itemChoice({
          key: "sanguinist-blood-compatibility-choice",
          level: 3,
          items: COMPATIBILITY_CHOICES,
          title: "Кровавая совместимость",
          hint: "Выберите одно постоянное преимущество. Его можно заменить при получении уровня Сангвиниста или уровня с Улучшением характеристик."
        }),
        abilityScoreImprovementAdvancement({
          key: "sanguinist-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "sanguinist-level-4-features",
          level: 4,
          items: ["ritual-sacrifice"]
        }),
        itemGrant({
          key: "sanguinist-level-5-features",
          level: 5,
          items: ["crimson-mastery"]
        }),
        itemChoice({
          key: "sanguinist-crimson-mastery-choice",
          level: 5,
          items: CRIMSON_MASTERY_CHOICES,
          count: 2,
          title: "Багровое мастерство",
          hint: "Выберите две техники кровавой магии."
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "",
        preparation: {
          formula: ""
        }
      },
      wealth: ""
    }
  })
];
