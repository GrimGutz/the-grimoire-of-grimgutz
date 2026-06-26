import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  traitChoiceAdvancement
} from "../common.mjs";

const SOURCE = "Престиж-класс: Пожиратель душ; предоставленный PDF PK_Souleater (2).pdf";

const description = `
  <h1>Престиж-класс: Пожиратель душ</h1>
  <p>Пожиратель душ — чудовищное существо, питающееся самой сущностью жизненной силы. Даже изначально доброе существо может обратиться ко злу и стать пожирателем душ, добровольно или против своей воли.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Побывать на краю смерти.</strong> Вы должны были дважды провалить спасбросок от смерти и быть спасённым в последний момент.</li>
    <li><strong>Завершить особый ритуал.</strong> Вы должны найти и завершить специальный ритуал, позволяющий стать пожирателем душ.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет общий уровень персонажа. Событие на грани смерти и завершение ритуала подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к8 за каждый уровень Пожирателя душ.</p>
  <p><strong>Хиты на каждом уровне:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Доспехи:</strong> лёгкие доспехи, щиты.</p>
  <p><strong>Оружие:</strong> нет.</p>
  <p><strong>Инструменты:</strong> любой инструмент на выбор.</p>
  <p><strong>Спасброски и навыки:</strong> нет.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Умения</th>
        <th>Разрыв души</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Разрыв души</td><td>1к4</td></tr>
      <tr><td>2</td><td>Поглощение души</td><td>2к4</td></tr>
      <tr><td>3</td><td>Обмен душами</td><td>3к4</td></tr>
      <tr><td>4</td><td>Осколок души</td><td>4к4</td></tr>
      <tr><td>5</td><td>Сила души</td><td>5к4</td></tr>
    </tbody>
  </table>
`;

export const soulEaterClassDocuments = [
  baseDocument({
    key: "soul-eater-class",
    name: "Пожиратель душ",
    type: "class",
    img: "icons/magic/death/skull-energy-light-purple.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "soul-eater"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "soul-eater",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("soul-eater-hit-points"),
        scaleValueAdvancement({
          key: "soul-eater-soul-rend",
          identifier: "soul-rend",
          title: "Разрыв души",
          type: "dice",
          scale: {
            1: { number: 1, faces: 4, modifiers: [] },
            2: { number: 2, faces: 4, modifiers: [] },
            3: { number: 3, faces: 4, modifiers: [] },
            4: { number: 4, faces: 4, modifiers: [] },
            5: { number: 5, faces: 4, modifiers: [] }
          }
        }),
        traitAdvancement({
          key: "soul-eater-armor",
          level: 1,
          grants: ["armor:lgt", "armor:shl"],
          title: "Владение доспехами Пожирателя душ"
        }),
        traitChoiceAdvancement({
          key: "soul-eater-tool",
          level: 1,
          pool: [
            "tool:art:*",
            "tool:game:*",
            "tool:music:*",
            "tool:disg",
            "tool:forg",
            "tool:herb",
            "tool:navg",
            "tool:pois",
            "tool:thief"
          ],
          title: "Владение инструментом",
          hint: "Выберите любой инструмент."
        }),
        itemGrant({
          key: "soul-eater-level-1",
          level: 1,
          items: ["soul-rend"]
        }),
        itemGrant({
          key: "soul-eater-level-2",
          level: 2,
          items: ["soul-absorption"]
        }),
        itemGrant({
          key: "soul-eater-level-3",
          level: 3,
          items: ["soul-exchange"]
        }),
        itemGrant({
          key: "soul-eater-level-4",
          level: 4,
          items: ["soul-shard"]
        }),
        itemGrant({
          key: "soul-eater-level-5",
          level: 5,
          items: ["soul-power"]
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
