import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  sourceData,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Падший жрец; предоставленный PDF PK_FallenPriest (1).pdf";
const FALLEN_PRIEST_ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/TwistedFaith.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Падший жрец / Fallen Priest</h1>
  <p>Падшие жрецы отринулли служение богам, но не отказались от божественной силы. Вместо молитв они крадут искры благодати из чужих каналов веры и используют их как собственную магию.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Владение навыком Религия.</strong> Для падшего жреца знание божественного не означает веру в него.</li>
    <li><strong>Отступничество.</strong> Персонаж должен был иметь возможность творить божественную магию не ниже 3-го круга, а затем навсегда потерять её, отринув веру или лишившись благодати.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет владение Религией. Предыдущий доступ к божественной магии 3-го круга и окончательное отступничество подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Падшего жреца.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Владение:</strong> класс не даёт новых владений доспехами, оружием, инструментами, спасбросками или навыками.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("fallen-priest-heretic", "Еретик")}, ${featureLink("fallen-priest-spellcasting", "Чтение заклинаний")}, ${featureLink("fallen-priest-turn-undead", "Изгнание нежити")}</td></tr>
      <tr><td>2</td><td>${featureLink("divine-resistance", "Сопротивление божественному")}</td></tr>
      <tr><td>3</td><td>${featureLink("absorb-power", "Поглощение силы")}</td></tr>
      <tr><td>4</td><td>${featureLink("divine-copying", "Копирование божественного")}, Увеличение характеристик</td></tr>
      <tr><td>5</td><td>${featureLink("arcane-copying", "Копирование арканы")}</td></tr>
    </tbody>
  </table>
`;

export const fallenPriestClassDocuments = [
  baseDocument({
    key: "fallen-priest-class",
    name: "Падший жрец / Fallen Priest",
    type: "class",
    img: FALLEN_PRIEST_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "fallen-priest"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "fallen-priest",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("fallen-priest-hit-points"),
        itemGrant({
          key: "fallen-priest-level-1-features",
          level: 1,
          items: ["fallen-priest-heretic", "fallen-priest-spellcasting", "fallen-priest-turn-undead"]
        }),
        itemGrant({
          key: "fallen-priest-level-2-features",
          level: 2,
          items: ["divine-resistance"]
        }),
        itemGrant({
          key: "fallen-priest-level-3-features",
          level: 3,
          items: ["absorb-power"]
        }),
        itemGrant({
          key: "fallen-priest-level-4-features",
          level: 4,
          items: ["divine-copying"]
        }),
        abilityScoreImprovementAdvancement({
          key: "fallen-priest-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "fallen-priest-level-5-features",
          level: 5,
          items: ["arcane-copying"]
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
