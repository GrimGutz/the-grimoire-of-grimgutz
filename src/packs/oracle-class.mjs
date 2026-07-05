import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Оракул; предоставленный PDF Orakul_-_PK.pdf";
const ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Oracle.png";

const spellSlotScales = {
  1: { 1: 2, 2: 3, 3: 4, 4: 4, 5: 4 },
  2: { 1: 0, 2: 0, 3: 2, 4: 3, 5: 3 },
  3: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 }
};

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function scale(values) {
  return Object.fromEntries(Object.entries(values).map(([level, value]) => [level, { value }]));
}

function slotScale(slotLevel) {
  return scale(spellSlotScales[slotLevel]);
}

const description = `
  <h1>Престиж-класс: Оракул / Oracle</h1>
  <p>Оракул видит и изменяет нити судьбы. Его сила приходит из Астрального плана или от сущностей, управляющих роком, но каждое вмешательство требует соблюдения баланса.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Мудрость 18.</strong></li>
    <li><strong>Интеллект 18.</strong></li>
    <li><strong>Возможность произносить хотя бы одно заклинание 6-го уровня или выше школы Прорицания.</strong></li>
    <li><strong>12-й уровень персонажа.</strong></li>
    <li><strong>Предсказать значительное событие.</strong> Суть события и его последствия определяет Мастер.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Мудрость, Интеллект, общий уровень персонажа и наличие известного/подготовленного заклинания Прорицания 6-го круга или выше на листе. Само значительное пророчество подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Оракула.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Инструменты:</strong> инструменты ткача. <strong>Доспехи, оружие, спасброски и навыки:</strong> нет.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Умения</th><th>Макс. Диссонанс</th><th>Баланс судьбы</th><th>1-й</th><th>2-й</th><th>3-й</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("influence-fates", "Воздействие на судьбы")}</td><td>2</td><td>4</td><td>2</td><td>—</td><td>—</td></tr>
      <tr><td>2</td><td>${featureLink("oracle-first-secret", "Первый секрет Оракула")}</td><td>3</td><td>4</td><td>3</td><td>—</td><td>—</td></tr>
      <tr><td>3</td><td>${featureLink("weaving-connections", "Переплетение связей")}</td><td>4</td><td>3</td><td>4</td><td>2</td><td>—</td></tr>
      <tr><td>4</td><td>Увеличение характеристик, ${featureLink("sense-fate", "Чувство судьбы")}</td><td>5</td><td>3</td><td>4</td><td>3</td><td>—</td></tr>
      <tr><td>5</td><td>${featureLink("oracle-great-secret", "Главный секрет оракула")}</td><td>6</td><td>2</td><td>4</td><td>3</td><td>2</td></tr>
    </tbody>
  </table>
  <p>Ячейки Оракула добавлены как ScaleValue, потому что таблица не совпадает со штатной прогрессией dnd5e и в PDF не описана как обычная прогрессия заклинателя.</p>
`;

export const oracleClassDocuments = [
  baseDocument({
    key: "oracle-class",
    name: "Оракул / Oracle",
    type: "class",
    img: ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "oracle"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–4", SOURCE),
      identifier: "oracle",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("oracle-hit-points"),
        traitAdvancement({
          key: "oracle-weaver-tools",
          level: 1,
          grants: ["tool:weaver"],
          title: "Оракул: инструменты ткача"
        }),
        scaleValueAdvancement({
          key: "oracle-max-dissonance",
          identifier: "max-dissonance",
          title: "Максимум очков Диссонанса",
          scale: scale({ 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 })
        }),
        scaleValueAdvancement({
          key: "oracle-fate-balance",
          identifier: "fate-balance",
          title: "Баланс судьбы",
          scale: scale({ 1: 4, 2: 4, 3: 3, 4: 3, 5: 2 })
        }),
        scaleValueAdvancement({ key: "oracle-spell-slots-1", identifier: "spell-slots-1", scale: slotScale(1), title: "Ячейки 1-го круга" }),
        scaleValueAdvancement({ key: "oracle-spell-slots-2", identifier: "spell-slots-2", scale: slotScale(2), title: "Ячейки 2-го круга" }),
        scaleValueAdvancement({ key: "oracle-spell-slots-3", identifier: "spell-slots-3", scale: slotScale(3), title: "Ячейки 3-го круга" }),
        itemGrant({
          key: "oracle-level-1-features",
          level: 1,
          items: ["influence-fates"]
        }),
        itemGrant({
          key: "oracle-level-2-features",
          level: 2,
          items: ["oracle-first-secret"]
        }),
        itemGrant({
          key: "oracle-level-3-features",
          level: 3,
          items: ["weaving-connections"]
        }),
        abilityScoreImprovementAdvancement({
          key: "oracle-level-4-asi",
          level: 4
        }),
        traitAdvancement({
          key: "oracle-perception",
          level: 4,
          grants: ["skills:prc"],
          title: "Чувство судьбы: Восприятие"
        }),
        itemGrant({
          key: "oracle-level-4-features",
          level: 4,
          items: ["sense-fate"]
        }),
        itemGrant({
          key: "oracle-level-5-features",
          level: 5,
          items: ["oracle-great-secret"]
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "wis",
        preparation: {
          formula: ""
        }
      },
      wealth: ""
    }
  })
];
