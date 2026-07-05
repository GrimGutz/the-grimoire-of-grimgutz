import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  sourceData,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Харроуер; предоставленный PDF PK_Gambler.pdf";
const GAMBLER_ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Gambler.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Харроуер / Gambler</h1>
  <p>Харроуер овладел искусством использования карт не только для предсказания будущего, но и как оружия. Его Колода Астральных Тайн наносит урон, контролирует поле боя и позволяет манипулировать собственной удачей.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Ловкость 13.</strong></li>
    <li><strong>Интеллект 13.</strong></li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Ловкость и Интеллект. Если Мастер требует сюжетное обучение гаданию, азартным играм или владению Колодой Астральных Тайн, это подтверждается вручную.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Харроуера.</p>
  <p><strong>Хиты на 1-м уровне:</strong> 8 + модификатор Телосложения.</p>
  <p><strong>Хиты на следующих уровнях:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Владение доспехами:</strong> нет.</p>
  <p><strong>Владение оружием:</strong> нет.</p>
  <p><strong>Инструменты:</strong> нет.</p>
  <p><strong>Спасброски:</strong> нет.</p>
  <p><strong>Навыки:</strong> нет.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("astral-deck", "Колода Астральных Тайн")}</td></tr>
      <tr><td>2</td><td>${featureLink("deal-them", "Сдавай Их")}</td></tr>
      <tr><td>3</td><td>${featureLink("rogues-are-lucky", "Плутам везёт")}</td></tr>
      <tr><td>4</td><td>${featureLink("up-the-sleeve", "В Рукаве")}</td></tr>
      <tr><td>5</td><td>${featureLink("aces-beat", "Тузы бьют")}</td></tr>
    </tbody>
  </table>
`;

export const gamblerClassDocuments = [
  baseDocument({
    key: "gambler-class",
    name: "Харроуер / Gambler",
    type: "class",
    img: GAMBLER_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "gambler"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–3", SOURCE),
      identifier: "gambler",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("gambler-hit-points"),
        itemGrant({
          key: "gambler-level-1-features",
          level: 1,
          items: ["astral-deck"]
        }),
        itemGrant({
          key: "gambler-level-2-features",
          level: 2,
          items: ["deal-them"]
        }),
        itemGrant({
          key: "gambler-level-3-features",
          level: 3,
          items: ["rogues-are-lucky"]
        }),
        itemGrant({
          key: "gambler-level-4-features",
          level: 4,
          items: ["up-the-sleeve"]
        }),
        itemGrant({
          key: "gambler-level-5-features",
          level: 5,
          items: ["aces-beat"]
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "int",
        preparation: {
          formula: ""
        }
      },
      wealth: ""
    }
  })
];
