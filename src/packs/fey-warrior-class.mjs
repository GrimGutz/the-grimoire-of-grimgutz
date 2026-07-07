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
  traitChoiceAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Воитель фей; предоставленный PDF PK_Feyskiy_voitel (1).pdf";
const FEY_WARRIOR_ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/GiftoftheWild.png";

const FEY_TRAITS = [
  "fey-blood",
  "fey-eyes",
  "fey-appearance",
  "fey-speed",
  "irresistible-charms",
  "fey-indomitable-life",
  "healing-adept",
  "graceful-fighter"
];

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Воитель фей / Fey Warrior</h1>
  <p>Воители фей — смертные, преображённые чуждой магией Страны Фей. Их тела и кровь меняются, даруя причудливые черты, неуловимое очарование и связь с Глубокой грёзой.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Ловкость 13.</strong></li>
    <li><strong>Харизма 13.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Неделя в Стране Фей.</strong> Вы должны были провести там не меньше недели, питаясь едой и водой этой страны.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Ловкость, Харизму и общий уровень персонажа. Пребывание в Стране Фей подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к10 за каждый уровень Воителя фей.</p>
  <p><strong>Хиты за уровень:</strong> 1к10 (или 6) + модификатор Телосложения.</p>
  <p><strong>Спасброски:</strong> Харизма.</p>
  <p><strong>Навыки:</strong> Магия, Убеждение или Внимательность.</p>
  <p><strong>Оружие:</strong> одно воинское оружие.</p>

  <table>
    <thead><tr><th>Уровень</th><th>Умения</th><th>Заговоры</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("fey-transformation", "Трансформация в фею")}, ${featureLink("fey-warrior-cantrips", "Заговоры")}, ${featureLink("call-of-feywild", "Зов Страны Фей")}</td><td>1</td></tr>
      <tr><td>2</td><td>${featureLink("charming-defense", "Очаровательная защита")}, Черта феи</td><td>1</td></tr>
      <tr><td>3</td><td>${featureLink("chimeric-weapon", "Химерическое оружие")}, Черта феи</td><td>2</td></tr>
      <tr><td>4</td><td>${featureLink("permanent-manifestation", "Постоянное проявление")}, Увеличение характеристик, ${featureLink("fey-magic", "Магия фей")}</td><td>2</td></tr>
      <tr><td>5</td><td>${featureLink("fey-skin", "Фейская кожа")}, Черта феи</td><td>3</td></tr>
    </tbody>
  </table>
`;

export const feyWarriorClassDocuments = [
  baseDocument({
    key: "fey-warrior-class",
    name: "Воитель фей / Fey Warrior",
    type: "class",
    img: FEY_WARRIOR_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "fey-warrior"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–5", SOURCE),
      identifier: "fey-warrior",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("fey-warrior-hit-points"),
        scaleValueAdvancement({
          key: "fey-warrior-cantrips-scale",
          identifier: "cantrips",
          title: "Заговоры",
          scale: {
            1: { value: 1 },
            2: { value: 1 },
            3: { value: 2 },
            4: { value: 2 },
            5: { value: 3 }
          }
        }),
        traitAdvancement({
          key: "fey-warrior-charisma-save",
          level: 1,
          grants: ["saves:cha"],
          title: "Владение спасброском Харизмы"
        }),
        traitChoiceAdvancement({
          key: "fey-warrior-skill",
          level: 1,
          pool: ["skills:arc", "skills:per", "skills:prc"],
          title: "Владение навыком Воителя фей",
          hint: "Выберите Магию, Убеждение или Внимательность."
        }),
        traitChoiceAdvancement({
          key: "fey-warrior-weapon",
          level: 1,
          pool: ["weapon:mar:*"],
          title: "Владение оружием",
          hint: "Выберите одно воинское оружие."
        }),
        itemGrant({
          key: "fey-warrior-level-1-features",
          level: 1,
          items: ["fey-transformation", "fey-warrior-cantrips", "call-of-feywild", "fey-mask"]
        }),
        itemGrant({
          key: "fey-warrior-level-2-features",
          level: 2,
          items: ["charming-defense"]
        }),
        itemChoice({
          key: "fey-warrior-level-2-trait",
          level: 2,
          items: FEY_TRAITS,
          title: "Черта феи",
          hint: "Выберите одну черту феи."
        }),
        itemGrant({
          key: "fey-warrior-level-3-features",
          level: 3,
          items: ["chimeric-weapon"]
        }),
        itemChoice({
          key: "fey-warrior-level-3-trait",
          level: 3,
          items: FEY_TRAITS,
          title: "Черта феи",
          hint: "Выберите ещё одну черту феи."
        }),
        itemGrant({
          key: "fey-warrior-level-4-features",
          level: 4,
          items: ["permanent-manifestation", "fey-magic"]
        }),
        abilityScoreImprovementAdvancement({
          key: "fey-warrior-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "fey-warrior-level-5-features",
          level: 5,
          items: ["fey-skin"]
        }),
        itemChoice({
          key: "fey-warrior-level-5-trait",
          level: 5,
          items: FEY_TRAITS,
          title: "Черта феи",
          hint: "Выберите третью черту феи."
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "cha",
        preparation: {
          formula: ""
        }
      },
      wealth: ""
    }
  })
];
