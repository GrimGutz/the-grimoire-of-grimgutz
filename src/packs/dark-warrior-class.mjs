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

const SOURCE = "Престиж-класс: Воин тьмы; предоставленный PDF PK_DarkWarrior (1).pdf";
const CLASS_ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Dark_warrior.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Воин тьмы / Dark Warrior</h1>
  <p>Воины тьмы, иногда называемые тёмными рыцарями, практикуют чёрную магию. Они изучают тёмные учения и ужасные таинства, чтобы соединить физическую силу, оккультные ритуалы и холодную воинскую дисциплину.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Сила 15.</strong></li>
    <li><strong>Владение навыком Магия.</strong></li>
    <li><strong>Аколит.</strong> Персонаж должен вынести неделю болезненных и травмирующих тёмных ритуалов, проведённых в одиночестве, тайна которых требует месяцев изучения и успешных исследований.</li>
  </ul>
  <p>В процессе становления Воином тьмы персонаж наносит себе ритуальные татуировки и шрамы, покрывающие его с головы до ног. Их нельзя скрыть иначе, кроме как полными латами или глухой одеждой.</p>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Силу 15 и владение Магией. Недельный ритуал, исследования, татуировки и шрамы подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к10 за каждый уровень Воина тьмы.</p>
  <p><strong>Хиты за уровень:</strong> 1к10 (или 6) + модификатор Телосложения.</p>
  <p><strong>Доспехи:</strong> нет; <strong>оружие:</strong> боевое оружие, щиты; <strong>инструменты:</strong> нет.</p>
  <p><strong>Спасброски:</strong> Харизма.</p>
  <p><strong>Навыки:</strong> Атлетика или Акробатика.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Умения</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("black-magic-oil", "Масло чёрной магии")}</td></tr>
      <tr><td>2</td><td>${featureLink("black-magic-elixir", "Эликсир чёрной магии")}</td></tr>
      <tr><td>3</td><td>${featureLink("improved-black-oil", "Улучшенное чёрное масло")}</td></tr>
      <tr><td>4</td><td>${featureLink("improved-black-elixir", "Улучшенный эликсир")}, Увеличение характеристик</td></tr>
      <tr><td>5</td><td>${featureLink("dark-resistance", "Тёмное сопротивление")}, ${featureLink("blackening-weapon", "Очернение оружия")}</td></tr>
    </tbody>
  </table>
`;

export const darkWarriorClassDocuments = [
  baseDocument({
    key: "dark-warrior-class",
    name: "Воин тьмы / Dark Warrior",
    type: "class",
    img: CLASS_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "dark-warrior"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "dark-warrior",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("dark-warrior-hit-points"),
        traitAdvancement({
          key: "dark-warrior-charisma-save",
          level: 1,
          grants: ["saves:cha"],
          title: "Воин тьмы: спасбросок Харизмы"
        }),
        traitAdvancement({
          key: "dark-warrior-weapons-and-shields",
          level: 1,
          grants: ["weapon:mar", "armor:shl"],
          title: "Воин тьмы: боевое оружие и щиты"
        }),
        traitChoiceAdvancement({
          key: "dark-warrior-skill-choice",
          level: 1,
          pool: ["skills:ath", "skills:acr"],
          count: 1,
          title: "Воин тьмы: навык",
          hint: "Выберите Атлетику или Акробатику."
        }),
        itemGrant({
          key: "dark-warrior-level-1-features",
          level: 1,
          items: ["black-magic-oil"]
        }),
        itemGrant({
          key: "dark-warrior-level-2-features",
          level: 2,
          items: ["black-magic-elixir"]
        }),
        itemGrant({
          key: "dark-warrior-level-3-features",
          level: 3,
          items: ["improved-black-oil"]
        }),
        itemGrant({
          key: "dark-warrior-level-4-features",
          level: 4,
          items: ["improved-black-elixir"]
        }),
        abilityScoreImprovementAdvancement({
          key: "dark-warrior-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "dark-warrior-level-5-features",
          level: 5,
          items: ["dark-resistance", "blackening-weapon"]
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
