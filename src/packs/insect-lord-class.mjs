import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  sourceData,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Владыка насекомых; предоставленный PDF PK_Insect_lord (1).pdf";
const INSECT_LORD_ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Insect_lord.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Владыка насекомых / Insect Lord</h1>
  <p>Владыка насекомых принимает в своё тело паразитов, хитин, жала и рои, превращая собственную плоть в живой улей. Такой персонаж защищён хитиновыми пластинами, использует насекомых как фамильяров, оружие и разведчиков, а на вершине пути делит разум с развитым роем.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Владение навыками Природа и Скрытность.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Посвящение.</strong> Персонаж должен получить посвящение от разумного насекомоподобного существа, способного общаться с ним.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет общий уровень персонажа и владение навыками Природа и Скрытность. Посвящение подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Владыки насекомых.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
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
      <tr><td>1</td><td>${featureLink("chitinous-carapace", "Хитиновый панцирь")}, ${featureLink("insect-familiar", "Насекомое-фамильяр")}</td></tr>
      <tr><td>2</td><td>${featureLink("insect-natural-weapons", "Природное оружие")}</td></tr>
      <tr><td>3</td><td>${featureLink("blood-drain", "Высасывание крови")}, ${featureLink("crawling-armor", "Шевелящаяся броня")}</td></tr>
      <tr><td>4</td><td>${featureLink("spew-insects", "Изрыгание насекомых")}, Увеличение характеристик</td></tr>
      <tr><td>5</td><td>${featureLink("swarm-mind", "Разум роя")}, ${featureLink("crawling-eye", "Ползучий глаз")}</td></tr>
    </tbody>
  </table>
`;

export const insectLordClassDocuments = [
  baseDocument({
    key: "insect-lord-class",
    name: "Владыка насекомых / Insect Lord",
    type: "class",
    img: INSECT_LORD_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "insect-lord"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–3", SOURCE),
      identifier: "insect-lord",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("insect-lord-hit-points"),
        itemGrant({
          key: "insect-lord-level-1-features",
          level: 1,
          items: ["chitinous-carapace", "insect-familiar"]
        }),
        itemGrant({
          key: "insect-lord-level-2-features",
          level: 2,
          items: ["insect-natural-weapons"]
        }),
        itemGrant({
          key: "insect-lord-level-3-features",
          level: 3,
          items: ["blood-drain", "crawling-armor"]
        }),
        itemGrant({
          key: "insect-lord-level-4-features",
          level: 4,
          items: ["spew-insects"]
        }),
        abilityScoreImprovementAdvancement({
          key: "insect-lord-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "insect-lord-level-5-features",
          level: 5,
          items: ["swarm-mind", "crawling-eye"]
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
