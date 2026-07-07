import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Страж; предоставленный PDF PK_Guardian.pdf";
const GUARDIAN_ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/GuardianSpirit.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const RETRIBUTIONS = [
  "divine-retribution",
  "furious-retribution",
  "leaping-retribution",
  "martial-retribution",
  "planar-retribution",
  "spellcasting-retribution",
  "threatening-retribution"
];

const description = `
  <h1>Престиж-класс: Страж</h1>
  <p>Стражи направляют свой боевой опыт, стойкость и талант на защиту других. Одни защищают тех, кому верны, другие считают саму жизнь достойной защиты.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Телосложение 15.</strong></li>
    <li><strong>Уровень персонажа 6.</strong></li>
    <li><strong>Дополнительная атака или владение щитами.</strong></li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Телосложение, общий уровень персонажа и наличие особенности «Дополнительная атака» или владения щитами. Строгую проверку можно отключить в настройках мира.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к10 за каждый уровень Стража.</p>
  <p><strong>Хиты за уровень:</strong> 1к10 (или 6) + модификатор Телосложения.</p>
  <p><strong>Владение:</strong> класс не даёт новых владений инструментами, спасбросками или навыками.</p>
  <p><strong>Снаряжение:</strong> класс не даёт нового снаряжения.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Атак Метки</th>
        <th>Метки</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("guardian-calling", "Призвание стража")}, ${featureLink("guardian-mark", "Метка стража")}</td><td>2</td><td>2</td></tr>
      <tr><td>2</td><td>${featureLink("protection-specialization", "Специализация защиты")}, ${featureLink("endure-pain", "Выдержать боль")}</td><td>2</td><td>3</td></tr>
      <tr><td>3</td><td>${featureLink("powerful-retribution", "Мощное возмездие")}, ${featureLink("steadfastness", "Непоколебимость")}</td><td>3</td><td>3</td></tr>
      <tr><td>4</td><td>Улучшение характеристик</td><td>3</td><td>4</td></tr>
      <tr><td>5</td><td>${featureLink("powerful-retribution-improved", "Мощное возмездие (улучшение)")}, ${featureLink("guardian-unyielding", "Несгибаемость")}</td><td>4</td><td>4</td></tr>
    </tbody>
  </table>
`;

export const guardianClassDocuments = [
  baseDocument({
    key: "guardian-class",
    name: "Страж / Guardian",
    type: "class",
    img: GUARDIAN_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "guardian"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–5", SOURCE),
      identifier: "guardian",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("guardian-hit-points"),
        scaleValueAdvancement({
          key: "guardian-mark-attacks",
          identifier: "mark-attacks",
          title: "Атак Метки",
          scale: {
            1: { value: 2 },
            2: { value: 2 },
            3: { value: 3 },
            4: { value: 3 },
            5: { value: 4 }
          }
        }),
        scaleValueAdvancement({
          key: "guardian-marks",
          identifier: "marks",
          title: "Метки",
          scale: {
            1: { value: 2 },
            2: { value: 3 },
            3: { value: 3 },
            4: { value: 4 },
            5: { value: 4 }
          }
        }),
        itemGrant({
          key: "guardian-level-1-features",
          level: 1,
          items: ["guardian-calling", "guardian-mark"]
        }),
        itemGrant({
          key: "guardian-level-2-features",
          level: 2,
          items: ["protection-specialization", "endure-pain"]
        }),
        itemChoice({
          key: "guardian-protection-specialization",
          level: 2,
          items: ["sacrificial-throw", "protective-magic"],
          title: "Специализация защиты",
          hint: "Выберите один стиль защиты: Жертвенный бросок или Защитная магия."
        }),
        itemGrant({
          key: "guardian-level-3-features",
          level: 3,
          items: ["powerful-retribution", "steadfastness"]
        }),
        itemChoice({
          key: "guardian-powerful-retributions",
          level: 3,
          items: RETRIBUTIONS,
          count: 2,
          title: "Приёмы Мощного возмездия",
          hint: "Выберите два приёма. При получении нового уровня Стража замену одного приёма выполните вручную."
        }),
        abilityScoreImprovementAdvancement({
          key: "guardian-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "guardian-level-5-features",
          level: 5,
          items: ["powerful-retribution-improved", "guardian-unyielding"]
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
