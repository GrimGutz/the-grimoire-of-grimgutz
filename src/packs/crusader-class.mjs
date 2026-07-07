import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  traitChoiceAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Крестоносец; предоставленный PDF PK_Krestonosets (1).pdf";
const CRUSADER_ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/Crusade.png";

const spellSlotScales = {
  1: { 1: 2, 2: 3, 3: 4, 4: 4, 5: 4 },
  2: { 1: 0, 2: 0, 3: 2, 4: 3, 5: 3 },
  3: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 }
};

function slotScale(slotLevel) {
  return Object.fromEntries(Object.entries(spellSlotScales[slotLevel]).map(([level, value]) => [level, { value }]));
}

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Крестоносец / Crusader</h1>
  <p>Крестоносцы — несгибаемые защитники веры и закона. Эти живые крепости используют непробиваемую броню, святые чудеса и фанатичную решимость, чтобы идти сквозь врагов и защищать союзников.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Сила 13.</strong></li>
    <li><strong>Харизма 13.</strong></li>
    <li><strong>Владение навыком Религия.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Законное мировоззрение.</strong></li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Силу, Харизму, общий уровень персонажа, владение Религией и законное мировоззрение по строке мировоззрения листа. Строгую проверку можно отключить в настройках мира.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к8 за каждый уровень Крестоносца.</p>
  <p><strong>Хиты на каждом уровне:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Доспехи:</strong> лёгкая и средняя броня, щиты.</p>
  <p><strong>Оружие:</strong> три любых воинских оружия.</p>
  <p><strong>Спасброски и навыки:</strong> нет.</p>
  <p><strong>Снаряжение:</strong> святой символ и молитвенник с чудесами.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Умения</th><th>1-й</th><th>2-й</th><th>3-й</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("crusader-miracles", "Чудеса Крестоносца")}, ${featureLink("crusader-rage", "Ярость")}, ${featureLink("crusader-aegis", "Эгида крестоносца")}</td><td>2</td><td>—</td><td>—</td></tr>
      <tr><td>2</td><td>${featureLink("divine-devotion", "Божественная преданность")}</td><td>3</td><td>—</td><td>—</td></tr>
      <tr><td>3</td><td>${featureLink("consecration", "Освящение")}</td><td>4</td><td>2</td><td>—</td></tr>
      <tr><td>4</td><td>Увеличение характеристик</td><td>4</td><td>3</td><td>—</td></tr>
      <tr><td>5</td><td>${featureLink("condemnation", "Осуждение")}</td><td>4</td><td>3</td><td>2</td></tr>
    </tbody>
  </table>

  <h2>Подготовка и сотворение заклинаний</h2>
  <p>Вы подготавливаете число заклинаний Крестоносца, равное модификатору Харизмы + уровню Крестоносца. Уровень заклинания не должен превышать уровень самой высокой имеющейся у вас ячейки Крестоносца. Заклинательная характеристика — Харизма.</p>
  <p>Список заклинаний Крестоносца из PDF сохранён в карточке ${featureLink("crusader-miracles", "Чудеса Крестоносца")}.</p>
`;

export const crusaderClassDocuments = [
  baseDocument({
    key: "crusader-class",
    name: "Крестоносец / Crusader",
    type: "class",
    img: CRUSADER_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "crusader"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "crusader",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("crusader-hit-points"),
        scaleValueAdvancement({
          key: "crusader-rage-reduction",
          identifier: "rage-reduction",
          title: "Кость снижения урона Ярости",
          type: "dice",
          scale: {
            1: { number: 1, faces: 6, modifiers: [] },
            2: { number: 1, faces: 6, modifiers: [] },
            3: { number: 1, faces: 8, modifiers: [] },
            4: { number: 1, faces: 8, modifiers: [] },
            5: { number: 1, faces: 10, modifiers: [] }
          }
        }),
        scaleValueAdvancement({ key: "crusader-spell-slots-1", identifier: "spell-slots-1", scale: slotScale(1), title: "Ячейки 1-го круга" }),
        scaleValueAdvancement({ key: "crusader-spell-slots-2", identifier: "spell-slots-2", scale: slotScale(2), title: "Ячейки 2-го круга" }),
        scaleValueAdvancement({ key: "crusader-spell-slots-3", identifier: "spell-slots-3", scale: slotScale(3), title: "Ячейки 3-го круга" }),
        traitAdvancement({
          key: "crusader-armor",
          level: 1,
          grants: ["armor:lgt", "armor:med", "armor:shl"],
          title: "Владение доспехами Крестоносца"
        }),
        traitChoiceAdvancement({
          key: "crusader-martial-weapons",
          level: 1,
          pool: ["weapon:mar:*"],
          count: 3,
          title: "Владение воинским оружием",
          hint: "Выберите три любых воинских оружия."
        }),
        itemGrant({
          key: "crusader-level-1-features",
          level: 1,
          items: ["crusader-miracles", "crusader-rage", "crusader-aegis"]
        }),
        itemGrant({
          key: "crusader-level-2-features",
          level: 2,
          items: ["divine-devotion"]
        }),
        itemGrant({
          key: "crusader-level-3-features",
          level: 3,
          items: ["consecration"]
        }),
        abilityScoreImprovementAdvancement({
          key: "crusader-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "crusader-level-5-features",
          level: 5,
          items: ["condemnation"]
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "cha",
        preparation: {
          formula: "@abilities.cha.mod + @classes.crusader.levels"
        }
      },
      wealth: ""
    }
  })
];
