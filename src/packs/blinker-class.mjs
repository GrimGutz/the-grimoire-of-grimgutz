import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Мерцающий; предоставленный PDF PK-_Mertsayuschiy (1).pdf";
const BLINKER_ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/Blink.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Мерцающий / Blinker</h1>
  <p>Мерцающие используют знания пространственного изгиба, чтобы перемещаться рывками через короткие разрывы пространства, сбивать атаки с толку, переносить союзников и возвращаться к заранее отмеченному дому.</p>

  <h2>Предпосылки</h2>
  <ul>
    <li><strong>Интеллект 13.</strong></li>
    <li><strong>Мудрость 13.</strong></li>
    <li><strong>Владение навыком Магия.</strong></li>
    <li><strong>Уровень персонажа 3.</strong></li>
    <li><strong>Завершите специальное задание.</strong> Вы должны выучить эти трюки в древних книгах либо найти учителя, который согласится поделиться знаниями.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Интеллект, Мудрость, общий уровень персонажа и владение Магией. Специальное задание или учителя подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к6 за каждый уровень Мерцающего.</p>
  <p><strong>Хиты за уровень:</strong> 1к6 (или 4) + модификатор Телосложения.</p>
  <p><strong>Владение навыком:</strong> Восприятие.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Мерцаний</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("inner-blink", "Внутреннее Мерцание")}, ${featureLink("turnaround-blink", "Мерцание с разворотом")}</td><td>1</td></tr>
      <tr><td>2</td><td>${featureLink("sideways-shift", "Сдвиг в сторону")}, ${featureLink("blinking-step", "Мерцающий шаг")}</td><td>2</td></tr>
      <tr><td>3</td><td>${featureLink("improved-technique", "Улучшенная техника")}, ${featureLink("blinking-wrist", "Мерцающее запястье")}</td><td>3</td></tr>
      <tr><td>4</td><td>${featureLink("outer-blink", "Внешнее Мерцание")}, ${featureLink("shift-sense", "Чувство сдвига")}</td><td>4</td></tr>
      <tr><td>5</td><td>${featureLink("disappearance", "Исчезновение")}, ${featureLink("miraculous-homecoming", "Чудесное возвращение домой")}</td><td>5</td></tr>
    </tbody>
  </table>
`;

export const blinkerClassDocuments = [
  baseDocument({
    key: "blinker-class",
    name: "Мерцающий / Blinker",
    type: "class",
    img: BLINKER_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "blinker"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "blinker",
      levels: 1,
      hitDice: "d6",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("blinker-hit-points"),
        traitAdvancement({
          key: "blinker-perception",
          level: 1,
          grants: ["skills:prc"],
          title: "Владение навыком Восприятие"
        }),
        scaleValueAdvancement({
          key: "blinker-blinks",
          identifier: "blinks",
          title: "Мерцания",
          scale: {
            1: { value: 1 },
            2: { value: 2 },
            3: { value: 3 },
            4: { value: 4 },
            5: { value: 5 }
          }
        }),
        itemGrant({
          key: "blinker-level-1-features",
          level: 1,
          items: ["inner-blink", "turnaround-blink"]
        }),
        itemGrant({
          key: "blinker-level-2-features",
          level: 2,
          items: ["sideways-shift", "blinking-step"]
        }),
        itemGrant({
          key: "blinker-level-3-features",
          level: 3,
          items: ["improved-technique", "blinking-wrist"]
        }),
        itemGrant({
          key: "blinker-level-4-features",
          level: 4,
          items: ["outer-blink", "shift-sense"]
        }),
        itemGrant({
          key: "blinker-level-5-features",
          level: 5,
          items: ["disappearance", "miraculous-homecoming"]
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
