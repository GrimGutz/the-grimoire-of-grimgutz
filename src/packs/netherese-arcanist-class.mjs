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

const SOURCE = "Престиж-класс: Нетерильский арканист; предоставленный PDF PK_NeterilArkanist.pdf";
const CLASS_ART = "modules/the-grimoire-of-grimgutz/assets/character%20arts/Netheril_arcanist.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function spellLink(identifier, label) {
  return `@UUID[${uuidFor("spells", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Нетерильский арканист / Netherese Arcanist</h1>
  <p>Нетерильский арканист изучает наследие древней империи Нетерил и обращается к Плетению так, как это делали архимаги парящих городов. Его гримуар открывает доступ к забытым тайнам, мини-мифалям и Великим заклинаниям.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Волшебник 15-го уровня или Чародей 15-го уровня.</strong></li>
    <li><strong>Интеллект или Харизма 16.</strong></li>
    <li><strong>Владение навыком Магия.</strong></li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет уровень Волшебника или Чародея, Интеллект/Харизму 16 и владение Магией. Происхождение гримуара, наставник, найденный фолиант или другая сюжетная связь с Нетерилом подтверждаются Мастером.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к6 за каждый уровень Нетерильского арканиста.</p>
  <p><strong>Хиты за уровень:</strong> 1к6 (или 4) + модификатор Телосложения.</p>
  <p><strong>Доспехи и оружие:</strong> нет; <strong>инструменты:</strong> каллиграф; <strong>спасброски:</strong> Телосложение или Интеллект; <strong>навыки:</strong> нет.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Особенности</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("scholar-arcanist", "Учёный арканист")}, ${featureLink("netherese-grimoire", "Нетерильский гримуар")}</td></tr>
      <tr><td>2</td><td>${featureLink("mini-mythal", "Мини-мифаль")}</td></tr>
      <tr><td>3</td><td>${featureLink("ancient-knowledge", "Древнее знание")}</td></tr>
      <tr><td>4</td><td>Увеличение характеристик</td></tr>
      <tr><td>5</td><td>${featureLink("great-spells", "Великие заклинания")}</td></tr>
    </tbody>
  </table>

  <h2>Великие заклинания</h2>
  <p>Карточка «Великие заклинания» содержит активности для выбора одного из доступных Великих заклинаний. Справочные карточки заклинаний также добавлены в компендиум заклинаний:</p>
  <ul>
    <li>${spellLink("proctivs-floating-island", "Парящий остров Проктива")}</li>
    <li>${spellLink("amaunators-eternal-sun", "Вечное солнце Амаунатора")}</li>
    <li>${spellLink("fiery-cataract", "Огненная катаракта")}</li>
    <li>${spellLink("diluvial-torrent", "Поток Дилювиаля")}</li>
    <li>${spellLink("horrible-drought", "Ужасная засуха")}</li>
    <li>${spellLink("tolodines-killing-wind", "Смертоносный ветер Толодина")}</li>
    <li>${spellLink("beast-of-a-thousand-legs", "Тварь о тысяче ног")}</li>
  </ul>
`;

export const nethereseArcanistClassDocuments = [
  baseDocument({
    key: "netherese-arcanist-class",
    name: "Нетерильский арканист / Netherese Arcanist",
    type: "class",
    img: CLASS_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "netherese-arcanist"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("15–17", SOURCE),
      identifier: "netherese-arcanist",
      levels: 1,
      hitDice: "d6",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("netherese-arcanist-hit-points"),
        traitAdvancement({
          key: "netherese-arcanist-calligrapher",
          level: 1,
          grants: ["tool:calligrapher"],
          title: "Нетерильский арканист: каллиграф"
        }),
        traitChoiceAdvancement({
          key: "netherese-arcanist-save",
          level: 1,
          pool: ["saves:con", "saves:int"],
          count: 1,
          title: "Нетерильский арканист: спасбросок",
          hint: "Выберите Телосложение или Интеллект."
        }),
        traitAdvancement({
          key: "netherese-arcanist-history",
          level: 1,
          grants: ["skills:his"],
          title: "Учёный арканист: История"
        }),
        traitChoiceAdvancement({
          key: "netherese-arcanist-arcana-expertise",
          level: 1,
          pool: ["skills:arc"],
          count: 1,
          mode: "expertise",
          title: "Учёный арканист: мастерское владение Магией",
          hint: "Требование класса уже предполагает владение Магией."
        }),
        itemGrant({
          key: "netherese-arcanist-level-1-features",
          level: 1,
          items: ["scholar-arcanist", "netherese-grimoire"]
        }),
        itemGrant({
          key: "netherese-arcanist-level-2-features",
          level: 2,
          items: ["mini-mythal"]
        }),
        itemGrant({
          key: "netherese-arcanist-level-3-features",
          level: 3,
          items: ["ancient-knowledge"]
        }),
        abilityScoreImprovementAdvancement({
          key: "netherese-arcanist-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "netherese-arcanist-level-5-features",
          level: 5,
          items: ["great-spells"]
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "int",
        preparation: {
          formula: ""
        }
      },
      wealth: ""
    }
  })
];
