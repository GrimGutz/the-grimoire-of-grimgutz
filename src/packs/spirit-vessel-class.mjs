import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  subclassAdvancement,
  traitAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Сосуд Духа; предоставленный PDF PK-_Sosud_Dukha (2).pdf";
const ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Sosud_ducha.png";

const SPIRIT_SUBCLASSES = [
  ["spirit-vessel-aberration", "Абберация"],
  ["spirit-vessel-celestial", "Небожитель / Celestial"],
  ["spirit-vessel-elemental-earth", "Элементаль: Земля"],
  ["spirit-vessel-elemental-air", "Элементаль: Воздух"],
  ["spirit-vessel-elemental-fire", "Элементаль: Огонь"],
  ["spirit-vessel-elemental-water", "Элементаль: Вода"],
  ["spirit-vessel-fey", "Фея"],
  ["spirit-vessel-fiend", "Исчадие"],
  ["spirit-vessel-undead", "Нежить"]
];

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function subclassLink(identifier, label) {
  return `@UUID[${uuidFor("subclasses", identifier)}]{${label}}`;
}

function scale(values) {
  return Object.fromEntries(Object.entries(values).map(([level, value]) => [level, { value }]));
}

const description = `
  <h1>Престиж-класс: Сосуд Духа / Spirit Vessel</h1>
  <p>Сосуд Духа делит тело с могущественным духом. Это не обычная одержимость: герой и дух сосуществуют, спорят за контроль и усиливают друг друга.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Мудрость 13.</strong></li>
    <li><strong>Харизма 13.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Новый друг.</strong> Вы нашли, призвали или иначе обнаружили духа с показателем опасности не ниже 2. Что считается духом, а также договор, приглашение или борьбу за контроль подтверждает Мастер.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Мудрость, Харизму и общий уровень персонажа. Сюжетное получение духа подтверждает Мастер. Тип духа реализован как стандартный подкласс dnd5e на 1-м уровне Сосуда Духа.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к6 за каждый уровень Сосуда Духа.</p>
  <p><strong>Хиты за уровень:</strong> 1к6 (или 4) + модификатор Телосложения.</p>
  <p><strong>Инструменты, спасброски, оружие:</strong> нет. ${featureLink("halved-ego", "Уполовиненное эго")} отдельно выдаёт владение спасбросками Интеллекта и Харизмы через Advancement.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Особенности</th><th>Известно заклинаний</th><th>Ячейки</th><th>Уровень ячеек</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("halved-ego", "Уполовиненное эго")}, ${featureLink("pact-magic-spirit-vessel", "Магия договора")}, ${featureLink("spirit-type", "Тип Духа")}</td><td>2</td><td>1</td><td>1</td></tr>
      <tr><td>2</td><td>Особенность духа, ${featureLink("concentrated-strike", "Концентрированный удар")}</td><td>3</td><td>2</td><td>1</td></tr>
      <tr><td>3</td><td>Особенность духа</td><td>4</td><td>2</td><td>2</td></tr>
      <tr><td>4</td><td>${featureLink("spirit-ability-improvement", "Улучшение характеристики")}, ${featureLink("flow-state", "Поток")}</td><td>5</td><td>2</td><td>2</td></tr>
      <tr><td>5</td><td>${featureLink("metaphysical-incarnation", "Метафизическое воплощение")}</td><td>6</td><td>2</td><td>3</td></tr>
    </tbody>
  </table>

  <h2>Тип духа</h2>
  <p>Выберите один подкласс-дух: ${SPIRIT_SUBCLASSES.map(([identifier, label]) => subclassLink(identifier, label)).join(", ")}.</p>
  <p>Для элементаля варианты стихии вынесены в отдельные подклассы. Это сделано намеренно: так Foundry может однозначно выдать пассивные эффекты сопротивлений, иммунитетов, скоростей и финального повышения характеристики.</p>
`;

export const spiritVesselClassDocuments = [
  baseDocument({
    key: "spirit-vessel-class",
    name: "Сосуд Духа / Spirit Vessel",
    type: "class",
    img: ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "spirit-vessel"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–5", SOURCE),
      identifier: "spirit-vessel",
      levels: 1,
      hitDice: "d6",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("spirit-vessel-hit-points"),
        scaleValueAdvancement({
          key: "spirit-vessel-known-spells",
          identifier: "known-spells",
          title: "Известные заклинания",
          scale: scale({ 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 })
        }),
        scaleValueAdvancement({
          key: "spirit-vessel-pact-slots",
          identifier: "pact-slots",
          title: "Ячейки Магии договора",
          scale: scale({ 1: 1, 2: 2, 3: 2, 4: 2, 5: 2 })
        }),
        scaleValueAdvancement({
          key: "spirit-vessel-pact-slot-level",
          identifier: "pact-slot-level",
          title: "Уровень ячеек Магии договора",
          scale: scale({ 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 })
        }),
        traitAdvancement({
          key: "spirit-vessel-saves",
          level: 1,
          grants: ["saves:int", "saves:cha"],
          title: "Двойное сопротивление: спасброски"
        }),
        itemGrant({
          key: "spirit-vessel-level-1-features",
          level: 1,
          items: ["halved-ego", "pact-magic-spirit-vessel", "spirit-type"]
        }),
        subclassAdvancement({
          key: "spirit-vessel-spirit-type",
          level: 1,
          title: "Тип духа",
          hint: "Выберите духа внутри Сосуда: абберация, небожитель, один из элементалей, фея, исчадие или нежить."
        }),
        itemGrant({
          key: "spirit-vessel-level-2-features",
          level: 2,
          items: ["concentrated-strike"]
        }),
        itemGrant({
          key: "spirit-vessel-level-4-features",
          level: 4,
          items: ["spirit-ability-improvement", "flow-state"]
        }),
        itemGrant({
          key: "spirit-vessel-level-5-features",
          level: 5,
          items: ["metaphysical-incarnation"]
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
