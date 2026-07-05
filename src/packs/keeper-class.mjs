import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  subclassAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Хранитель; предоставленный PDF PK_Keeper (2).pdf";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function subclassLink(identifier, label) {
  return `@UUID[${uuidFor("subclasses", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Хранитель / Keeper</h1>
  <p>Хранитель строит класс вокруг особого союзника: зверя, духа, конструкта, призванного существа или другого спутника, который зависит от героя так же, как герой зависит от него.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Интеллект, Мудрость или Харизма 13.</strong></li>
    <li><strong>Уровень персонажа 3.</strong> Для последующих уровней требуются уровни персонажа 4, 6, 8 и 10.</li>
    <li><strong>Владение навыками или инструментами.</strong> Для выбранной специализации требуется владение минимум двумя навыками или инструментами из её списка.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет характеристику 13 и общий уровень 3 при добавлении класса. При выборе специализации он проверяет владение минимум двумя подходящими навыками/инструментами, насколько это возможно по стандартным полям листа dnd5e. Нестандартные инструменты и сюжетное получение союзника подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к8 за каждый уровень Хранителя.</p>
  <p><strong>Хиты на 1-м уровне:</strong> 8 + модификатор Телосложения.</p>
  <p><strong>Хиты на следующих уровнях:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Владение инструментами:</strong> нет.</p>
  <p><strong>Спасброски:</strong> нет.</p>
  <p><strong>Навыки:</strong> нет.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Очки союзника</th>
        <th>Треб. ур.</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("keeper-ward-and-warded", "Страж и подопечный")}, ${featureLink("keeper-ally-talents", "Таланты союзника")}, специализация: ${subclassLink("keeper-golem-maker", "Создатель големов")} / ${subclassLink("keeper-myth-seeker", "Искатель мифов")} / ${subclassLink("keeper-spirit-medium", "Духовный медиум")} / ${subclassLink("keeper-wild-tamer", "Дикий укротитель")}</td><td>6</td><td>3</td></tr>
      <tr><td>2</td><td>${featureLink("strategy-and-synergy", "Стратегия и синергия")}, ${featureLink("united-and-protected", "Едины и защищены")}, умение специализации</td><td>7</td><td>4</td></tr>
      <tr><td>3</td><td>${featureLink("rest-and-recovery", "Отдых и восстановление")}, умение специализации</td><td>9</td><td>6</td></tr>
      <tr><td>4</td><td>Увеличение характеристик, ${featureLink("united-and-protected", "Едины и защищены")} улучшено</td><td>10</td><td>8</td></tr>
      <tr><td>5</td><td>${featureLink("might-and-magic", "Могущество и магия")}, умение специализации</td><td>12</td><td>10</td></tr>
    </tbody>
  </table>
`;

export const keeperClassDocuments = [
  baseDocument({
    key: "keeper-class",
    name: "Хранитель / Keeper",
    type: "class",
    img: "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/GuardianSpirit.png",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "keeper"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–10", SOURCE),
      identifier: "keeper",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("keeper-hit-points"),
        scaleValueAdvancement({
          key: "keeper-ally-points",
          identifier: "ally-points",
          title: "Очки союзника",
          scale: {
            1: { value: 6 },
            2: { value: 7 },
            3: { value: 9 },
            4: { value: 10 },
            5: { value: 12 }
          }
        }),
        scaleValueAdvancement({
          key: "keeper-required-character-level",
          identifier: "required-character-level",
          title: "Требуемый уровень персонажа",
          scale: {
            1: { value: 3 },
            2: { value: 4 },
            3: { value: 6 },
            4: { value: 8 },
            5: { value: 10 }
          }
        }),
        itemGrant({
          key: "keeper-level-1-features",
          level: 1,
          items: ["keeper-ward-and-warded", "keeper-ally-talents"]
        }),
        subclassAdvancement({
          key: "keeper-specialization",
          level: 1,
          title: "Специализация хранителя",
          hint: "Выберите подкласс-специализацию Хранителя: Создатель големов, Искатель мифов, Духовный медиум или Дикий укротитель."
        }),
        itemGrant({
          key: "keeper-level-2-features",
          level: 2,
          items: ["strategy-and-synergy", "united-and-protected"]
        }),
        itemGrant({
          key: "keeper-level-3-features",
          level: 3,
          items: ["rest-and-recovery"]
        }),
        abilityScoreImprovementAdvancement({
          key: "keeper-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "keeper-level-5-features",
          level: 5,
          items: ["might-and-magic"]
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
