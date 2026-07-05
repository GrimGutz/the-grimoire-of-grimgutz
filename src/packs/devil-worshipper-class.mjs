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

const SOURCE = "Престиж-класс: Дьяволопоклонник; предоставленный PDF PK_DevilContract (1).pdf";
const CLASS_ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Devil_contracter.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Дьяволопоклонник / Devil Worshipper</h1>
  <p>Дьяволопоклонник посвятил судьбу силам Ада. Закладывая душу в обмен на прижизненные блага, он получает силу, знания и покровительство дьявола, но после смерти обречён на вечное служение.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Заклинатель.</strong> Вы должны быть способны произносить заклинания по меньшей мере 3-го круга.</li>
    <li><strong>Владение Магией или Религией.</strong> Вы должны обладать знаниями о том, как устроен Ад.</li>
    <li><strong>Контракт с дьяволом.</strong> Вы должны заключить сделку с дьяволом, заложив душу в обмен на силу и знания. После смерти ваша душа отправится в Ад, что лишает вас возможности реинкарнации или воскрешения.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет способность накладывать заклинание 3-го круга или выше и владение Магией или Религией. Сам контракт с дьяволом, условия сделки и последствия для души подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к6 за каждый уровень Дьяволопоклонника.</p>
  <p><strong>Хиты за уровень:</strong> 1к6 (или 4) + модификатор Телосложения.</p>
  <p><strong>Доспехи:</strong> нет. <strong>Оружие:</strong> кинжалы. <strong>Инструменты:</strong> нет.</p>
  <p><strong>Спасброски:</strong> нет.</p>
  <p><strong>Навыки:</strong> Убеждение или Запугивание.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Умения</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("devil-spellcasting-ability", "Базовая характеристика заклинаний")}, ${featureLink("hellfire", "Адское пламя")}, ${featureLink("imp-familiar", "Бесовский фамильяр")}</td></tr>
      <tr><td>2</td><td>${featureLink("devil-sight", "Зрение дьявола")}, ${featureLink("dark-luck", "Тёмная удача")}, ${featureLink("quiet-whisper", "Тихий шёпот")}</td></tr>
      <tr><td>3</td><td>${featureLink("empowered-charms", "Усиленные чары")}, ${featureLink("hellfire-fury", "Ярость адского огня")}</td></tr>
      <tr><td>4</td><td>Увеличение характеристик</td></tr>
      <tr><td>5</td><td>${featureLink("devilish-glaive", "Дьявольская гвизарма")}, ${featureLink("aura-of-devastated-souls", "Аура опустошённых душ")}</td></tr>
    </tbody>
  </table>
`;

export const devilWorshipperClassDocuments = [
  baseDocument({
    key: "devil-worshipper-class",
    name: "Дьяволопоклонник / Devil Worshipper",
    type: "class",
    img: CLASS_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "devil-worshipper"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "devil-worshipper",
      levels: 1,
      hitDice: "d6",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("devil-worshipper-hit-points"),
        traitAdvancement({
          key: "devil-worshipper-dagger-training",
          level: 1,
          grants: ["weapon:sim:dagger"],
          title: "Дьяволопоклонник: кинжалы"
        }),
        traitChoiceAdvancement({
          key: "devil-worshipper-skill-choice",
          level: 1,
          pool: ["skills:per", "skills:itm"],
          count: 1,
          title: "Дьяволопоклонник: навык",
          hint: "Выберите Убеждение или Запугивание."
        }),
        itemGrant({
          key: "devil-worshipper-level-1-features",
          level: 1,
          items: ["devil-spellcasting-ability", "hellfire", "imp-familiar"]
        }),
        itemGrant({
          key: "devil-worshipper-level-2-features",
          level: 2,
          items: ["devil-sight", "dark-luck", "quiet-whisper"]
        }),
        itemGrant({
          key: "devil-worshipper-level-3-features",
          level: 3,
          items: ["empowered-charms", "hellfire-fury"]
        }),
        abilityScoreImprovementAdvancement({
          key: "devil-worshipper-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "devil-worshipper-level-5-features",
          level: 5,
          items: ["devilish-glaive", "aura-of-devastated-souls"]
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
