import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  sourceData,
  traitAdvancement,
  traitChoiceAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Демонолог; предоставленный PDF PK_demonolog (1).pdf";
const ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/DemonicPact.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Демонолог / Demonologist</h1>
  <p>Демонолог изучает Бездну, заключает сделки с младшими демонами и умеет призывать их без обычных ограничений. Чем глубже он погружается в тёмное знание, тем больше его тело и разум становятся похожи на демонические.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Харизма 15.</strong></li>
    <li><strong>Владение навыком Магия или Религия.</strong></li>
    <li><strong>Способность творить заклинания.</strong> Вы должны уметь накладывать хотя бы одно заклинание, позволяющее призывать демонов, например <em>Призыв младших демонов</em> или <em>Призыв Хезроу</em>, либо заклинание, позволяющее путешествовать между планами.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Харизму, владение Магией или Религией и наличие на листе подходящего заклинания призыва демонов/планарного перемещения. Если заклинание хранится под нестандартным названием, Мастер может временно отключить строгую проверку требований.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к6 за каждый уровень Демонолога.</p>
  <p><strong>Хиты за уровень:</strong> 1к6 (или 4) + модификатор Телосложения.</p>
  <p><strong>Спасброски:</strong> Харизма.</p>
  <p><strong>Навыки:</strong> выберите Обман или Запугивание.</p>
  <p><strong>Доспехи, оружие и инструменты:</strong> нет.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Особенности</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("demon-charm", "Очарование демонов")}, ${featureLink("infernal-familiar", "Инфернальный фамильяр")}</td></tr>
      <tr><td>2</td><td>${featureLink("master-summoner", "Мастер призыва")}, ${featureLink("dark-knowledge", "Тёмное знание")}</td></tr>
      <tr><td>3</td><td>${featureLink("demonic-resistance", "Демоническое сопротивление")}, ${featureLink("demonic-vitality", "Демоническая живучесть")}</td></tr>
      <tr><td>4</td><td>${featureLink("demonic-mind", "Демонический разум")}, Улучшение характеристик</td></tr>
      <tr><td>5</td><td>${featureLink("double-summon", "Удвоенный призыв")}, ${featureLink("domination", "Доминация")}</td></tr>
    </tbody>
  </table>
`;

export const demonologistClassDocuments = [
  baseDocument({
    key: "demonologist-class",
    name: "Демонолог / Demonologist",
    type: "class",
    img: ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "demonologist"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "demonologist",
      levels: 1,
      hitDice: "d6",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("demonologist-hit-points"),
        traitAdvancement({
          key: "demonologist-charisma-save",
          level: 1,
          grants: ["saves:cha"],
          title: "Демонолог: спасбросок Харизмы"
        }),
        traitChoiceAdvancement({
          key: "demonologist-skill",
          level: 1,
          pool: ["skills:dec", "skills:itm"],
          count: 1,
          title: "Демонолог: навык",
          hint: "Выберите Обман или Запугивание."
        }),
        itemGrant({
          key: "demonologist-level-1-features",
          level: 1,
          items: ["demon-charm", "infernal-familiar"]
        }),
        itemGrant({
          key: "demonologist-level-2-features",
          level: 2,
          items: ["master-summoner", "dark-knowledge"]
        }),
        traitAdvancement({
          key: "demonologist-abyssal",
          level: 2,
          grants: ["languages:abyssal"],
          title: "Тёмное знание: Бездны"
        }),
        itemGrant({
          key: "demonologist-level-3-features",
          level: 3,
          items: ["demonic-resistance", "demonic-vitality"]
        }),
        itemGrant({
          key: "demonologist-level-4-features",
          level: 4,
          items: ["demonic-mind"]
        }),
        abilityScoreImprovementAdvancement({
          key: "demonologist-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "demonologist-level-5-features",
          level: 5,
          items: ["double-summon", "domination"]
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "cha",
        preparation: {
          formula: ""
        }
      },
      wealth: ""
    }
  })
];
