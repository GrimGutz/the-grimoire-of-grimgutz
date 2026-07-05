import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Призрачный Странник; предоставленный PDF PK_-Prizrachny_strannik (1).pdf";
const GHOST_WALKER_ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Soul_traveler.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Призрачный Странник / Ghost Walker</h1>
  <p>Призрачные Странники балансируют между жизнью, смертью и Эфирным Планом. Они могут становиться полудухами, проходить сквозь преграды, вселяться в тела других существ и на короткое время возвращать павших как спектральных союзников.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Телосложение 13.</strong></li>
    <li><strong>Харизма 13.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Владение навыком Магия или Религия.</strong></li>
    <li><strong>Поиграй со Смертью.</strong> Персонаж должен пережить смерть или почти пережить её: например умереть и вернуться через <em>Возрождение</em>, <em>Воскрешение</em> или <em>Исполнение желаний</em>, либо выбросить натуральную 20 на спасброске от смерти.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Телосложение, Харизму, общий уровень персонажа и владение Магией или Религией. Сюжетное требование встречи со смертью подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Призрачного Странника.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Владение:</strong> класс не даёт новых владений инструментами, спасбросками или оружием.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Использований Формы Духа</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("touched-by-death", "Тронутый Смертью")}, ${featureLink("spirit-form", "Форма Духа")}</td><td>2</td></tr>
      <tr><td>2</td><td>${featureLink("possession", "Одержимость")}, ${featureLink("ghost-step", "Призрачный Шаг")}</td><td>2</td></tr>
      <tr><td>3</td><td>${featureLink("otherworldly-presence", "Потустороннее Присутствие")}</td><td>3</td></tr>
      <tr><td>4</td><td>${featureLink("drain-soul", "Высосать Душу")}, ${featureLink("kindred-spirit", "Родственный Дух")}</td><td>3</td></tr>
      <tr><td>5</td><td>${featureLink("unfinished-business", "Незаконченное Дело")}</td><td>4</td></tr>
    </tbody>
  </table>
`;

export const ghostWalkerClassDocuments = [
  baseDocument({
    key: "ghost-walker-class",
    name: "Призрачный Странник / Ghost Walker",
    type: "class",
    img: GHOST_WALKER_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "ghost-walker"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–4", SOURCE),
      identifier: "ghost-walker",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("ghost-walker-hit-points"),
        scaleValueAdvancement({
          key: "ghost-walker-spirit-form-uses",
          identifier: "spirit-form-uses",
          title: "Использований Формы Духа",
          scale: {
            1: { value: 2 },
            2: { value: 2 },
            3: { value: 3 },
            4: { value: 3 },
            5: { value: 4 }
          }
        }),
        itemGrant({
          key: "ghost-walker-level-1-features",
          level: 1,
          items: ["touched-by-death", "spirit-form"]
        }),
        itemGrant({
          key: "ghost-walker-level-2-features",
          level: 2,
          items: ["possession", "ghost-step"]
        }),
        itemGrant({
          key: "ghost-walker-level-3-features",
          level: 3,
          items: ["otherworldly-presence"]
        }),
        itemGrant({
          key: "ghost-walker-level-4-features",
          level: 4,
          items: ["drain-soul", "kindred-spirit"]
        }),
        itemGrant({
          key: "ghost-walker-level-5-features",
          level: 5,
          items: ["unfinished-business"]
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
