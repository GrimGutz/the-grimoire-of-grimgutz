import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  scaleValueAdvancement,
  sourceData
} from "../common.mjs";
import {
  HERETIC_BASE_POWERS,
  HERETIC_DISTORTIONS,
  HERETIC_FORBIDDEN_TALENTS,
  HERETIC_LEVEL_FIVE_POWERS,
  HERETIC_LEVEL_THREE_POWERS,
  HERETIC_MARKS
} from "./heretic-features.mjs";

const SOURCE = "Престиж-класс: Еретик; предоставленный PDF PK_Heretic.pdf";

const description = `
  <h1>Престиж-класс: Еретик</h1>
  <p>Еретик не заключает договор ради тёмной силы: он обращает уже поразившую его магическую порчу в новые оккультные таланты. По мере роста силы растёт и физическая либо духовная порча персонажа.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Магическая порча.</strong> Персонаж находится под воздействием формы магической порчи, которую подтверждает Мастер.</li>
    <li><strong>Интеллект, Мудрость или Харизма 13.</strong></li>
    <li><strong>Уровень персонажа 4.</strong></li>
    <li><strong>Мировоззрение.</strong> Персонаж не может быть законно-добрым, если Мастер не отменит это требование.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет общий уровень, характеристики и явно указанное законно-доброе мировоззрение. Наличие магической порчи подтверждается Мастером. Строгую проверку можно отключить в настройках мира.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к8 за каждый уровень Еретика.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Инструменты, спасброски и навыки:</strong> новых владений нет.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Особенности</th><th>Очки оккультизма</th><th>Гнусные силы</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Оккультные дары, Отмеченный порчей, Гнусные силы</td><td>2</td><td>3</td></tr>
      <tr><td>2</td><td>Запретный талант</td><td>4</td><td>4</td></tr>
      <tr><td>3</td><td>—</td><td>7</td><td>6</td></tr>
      <tr><td>4</td><td>Искажённое тело</td><td>9</td><td>6</td></tr>
      <tr><td>5</td><td>Запретный талант</td><td>13</td><td>7</td></tr>
    </tbody>
  </table>
`;

const powersThroughThree = [...HERETIC_BASE_POWERS, ...HERETIC_LEVEL_THREE_POWERS];
const allPowers = [...powersThroughThree, ...HERETIC_LEVEL_FIVE_POWERS];

export const hereticClassDocuments = [
  baseDocument({
    key: "heretic-class",
    name: "Еретик",
    type: "class",
    img: "icons/magic/unholy/hand-claw-glow-orange.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "heretic"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–7", SOURCE),
      identifier: "heretic",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("heretic-hit-points"),
        scaleValueAdvancement({
          key: "heretic-occult-points",
          identifier: "occult-points",
          title: "Очки оккультизма",
          scale: {
            1: { value: 2 },
            2: { value: 4 },
            3: { value: 7 },
            4: { value: 9 },
            5: { value: 13 }
          }
        }),
        itemGrant({
          key: "heretic-level-1-features",
          level: 1,
          items: ["occult-gifts", "marked-by-corruption", "vile-powers"]
        }),
        itemChoice({
          key: "heretic-level-1-marks",
          level: 1,
          items: HERETIC_MARKS,
          count: 3,
          title: "Отмеченный порчей",
          hint: "Выберите три постоянных дара порчи."
        }),
        itemChoice({
          key: "heretic-level-1-powers",
          level: 1,
          items: HERETIC_BASE_POWERS,
          count: 3,
          title: "Гнусные силы",
          hint: "Выберите три силы. Хотя бы одна должна быть Нечестивой силой, Нечестивой карой или Нечестивой мощью."
        }),
        itemGrant({
          key: "heretic-level-2-features",
          level: 2,
          items: ["forbidden-talent"]
        }),
        itemChoice({
          key: "heretic-level-2-talent",
          level: 2,
          items: HERETIC_FORBIDDEN_TALENTS,
          title: "Запретный талант",
          hint: "Выберите один запретный талант."
        }),
        itemChoice({
          key: "heretic-level-2-power",
          level: 2,
          items: HERETIC_BASE_POWERS,
          title: "Гнусная сила",
          hint: "Выберите четвёртую известную силу."
        }),
        itemChoice({
          key: "heretic-level-3-powers",
          level: 3,
          items: powersThroughThree,
          count: 2,
          title: "Гнусные силы",
          hint: "Выберите две дополнительные силы; доступны силы с требованием Еретик 3."
        }),
        itemGrant({
          key: "heretic-level-4-features",
          level: 4,
          items: ["distorted-body"]
        }),
        itemChoice({
          key: "heretic-level-4-mark",
          level: 4,
          items: HERETIC_MARKS,
          title: "Искажённое тело: дополнительный дар порчи",
          hint: "Выберите ещё один дар из списка «Отмеченного порчей»."
        }),
        itemChoice({
          key: "heretic-level-4-distortion",
          level: 4,
          items: HERETIC_DISTORTIONS,
          title: "Искажённое тело",
          hint: "Выберите одну постоянную черту искажённого тела."
        }),
        itemChoice({
          key: "heretic-level-5-talent",
          level: 5,
          items: HERETIC_FORBIDDEN_TALENTS,
          title: "Запретный талант",
          hint: "Выберите второй запретный талант."
        }),
        itemChoice({
          key: "heretic-level-5-power",
          level: 5,
          items: allPowers,
          title: "Гнусная сила",
          hint: "Выберите седьмую известную силу; доступны силы с требованием Еретик 5."
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
