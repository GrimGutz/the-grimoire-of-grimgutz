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

const SOURCE = "Престиж-класс: Ритуалист; предоставленный PDF Ritualist_-_PK (1).pdf";
const CLASS_ICON = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/DarkRitual.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Ритуалист / Ritualist</h1>
  <p>Ритуалисты направляют потусторонние энергии, вызывают духов из запредельного и используют мистические связующие ритуалы, подчиняющие этих духов своей воле.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Телосложение 13.</strong></li>
    <li><strong>Мудрость 13.</strong></li>
    <li><strong>5-й уровень персонажа.</strong></li>
    <li><strong>Специальная задача.</strong> Вы должны участвовать в ритуале и взять под контроль духа, используя знания и тренировки другого Ритуалиста или тайные книги.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Телосложение 13, Мудрость 13 и 5-й уровень персонажа. Сюжетный ритуал подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Ритуалиста.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Спасброски:</strong> Телосложение.</p>
  <p><strong>Навыки:</strong> нет.</p>
  <p><strong>Оружие:</strong> простое оружие.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Ритуальные очки</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("binding-ritual", "Ритуал привязки")}, ${featureLink("spirit-sight", "Духовное зрение")}</td><td>2</td></tr>
      <tr><td>2</td><td>${featureLink("mind-body-and-soul", "Разум, тело и душа")}, ${featureLink("protective-ritual", "Ритуал защиты")}</td><td>3</td></tr>
      <tr><td>3</td><td>${featureLink("spirit-channel", "Канал духов")}</td><td>3</td></tr>
      <tr><td>4</td><td>Увеличение характеристик</td><td>4</td></tr>
      <tr><td>5</td><td>${featureLink("ethereal-wanderer", "Эфирный странник")}</td><td>5</td></tr>
    </tbody>
  </table>
`;

export const ritualistClassDocuments = [
  baseDocument({
    key: "ritualist-class",
    name: "Ритуалист / Ritualist",
    type: "class",
    img: CLASS_ICON,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "ritualist"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–3", SOURCE),
      identifier: "ritualist",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("ritualist-hit-points"),
        traitAdvancement({
          key: "ritualist-con-save",
          level: 1,
          grants: ["saves:con"],
          title: "Ритуалист: спасбросок Телосложения"
        }),
        traitAdvancement({
          key: "ritualist-simple-weapons",
          level: 1,
          grants: ["weapon:sim"],
          title: "Ритуалист: простое оружие"
        }),
        scaleValueAdvancement({
          key: "ritualist-ritual-points",
          identifier: "ritual-points",
          title: "Ритуальные очки",
          scale: {
            1: { value: 2 },
            2: { value: 3 },
            3: { value: 3 },
            4: { value: 4 },
            5: { value: 5 }
          }
        }),
        itemGrant({
          key: "ritualist-level-1-features",
          level: 1,
          items: ["binding-ritual", "spirit-sight"]
        }),
        itemGrant({
          key: "ritualist-level-2-features",
          level: 2,
          items: ["mind-body-and-soul", "protective-ritual"]
        }),
        itemGrant({
          key: "ritualist-level-3-features",
          level: 3,
          items: ["spirit-channel"]
        }),
        abilityScoreImprovementAdvancement({
          key: "ritualist-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "ritualist-level-5-features",
          level: 5,
          items: ["ethereal-wanderer"]
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
