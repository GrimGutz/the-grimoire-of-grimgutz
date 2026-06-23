import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  fixedAbilityScoreAdvancement,
  hitPointsAdvancement,
  itemGrant,
  sourceData,
  traitAdvancement
} from "../common.mjs";

const SOURCE = "Престиж-класс: Лесной владыка; Мистический гримуар Jorving, стр. 71–76";

const description = `
  <h1>Престиж-класс: Лесной владыка</h1>
  <p>Лесные владыки — стражи древних рощ и живые воплощения разумной природы. Они защищают леса как самые древние и священные места мира от разрушительного влияния цивилизации.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Мудрость 13.</strong></li>
    <li><strong>Природный путь.</strong> Друид, Следопыт либо природный архетип, например Чародей зелёного сердца.</li>
    <li><strong>Благословение.</strong> Выполнить особое задание и получить благословение трента или дриады.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет общий уровень, Мудрость и наличие класса Друид или Следопыт. Нестандартный природный архетип и благословение подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к8 за каждый уровень Лесного владыки.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Навыки:</strong> Природа.</p>
  <p><strong>Доспехи, оружие, инструменты и спасброски:</strong> новых владений нет.</p>

  <table>
    <thead><tr><th>Уровень</th><th>Особенности</th><th>Заклинания и ячейки</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Древесный родич, Магия природы, Чувство природы</td><td>+1 к базовому классу</td></tr>
      <tr><td>2</td><td>Коракожа</td><td>+1 к базовому классу</td></tr>
      <tr><td>3</td><td>Сила дуба</td><td>+1 к базовому классу</td></tr>
      <tr><td>4</td><td>Увеличение характеристик, Рост ели</td><td>+1 к базовому классу</td></tr>
      <tr><td>5</td><td>Сердце дуба, Лесная мощь, Пустить корни</td><td>+1 к базовому классу</td></tr>
    </tbody>
  </table>
`;

export const forestLordClassDocuments = [
  baseDocument({
    key: "forest-lord-class",
    name: "Лесной владыка",
    type: "class",
    img: "icons/magic/nature/tree-spirit-glow-black-yellow.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "forest-lord"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "forest-lord",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("forest-lord-hit-points"),
        itemGrant({
          key: "forest-lord-level-1-features",
          level: 1,
          items: ["tree-kindred", "nature-magic", "nature-sense"]
        }),
        itemGrant({
          key: "forest-lord-tree-healing",
          level: 1,
          items: ["tree-healing"],
          pack: "spells",
          title: "Древесное лечение"
        }),
        traitAdvancement({
          key: "forest-lord-nature-skill",
          level: 1,
          grants: ["skills:nat"],
          title: "Чувство природы: владение Природой"
        }),
        itemGrant({
          key: "forest-lord-level-2-features",
          level: 2,
          items: ["forest-barkskin"]
        }),
        itemGrant({
          key: "forest-lord-level-3-features",
          level: 3,
          items: ["oak-strength"]
        }),
        fixedAbilityScoreAdvancement({
          key: "forest-lord-oak-strength",
          level: 3,
          fixed: { str: 1 },
          max: 21,
          title: "Сила дуба: Сила +1"
        }),
        abilityScoreImprovementAdvancement({
          key: "forest-lord-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "forest-lord-level-4-features",
          level: 4,
          items: ["spruce-growth"]
        }),
        itemGrant({
          key: "forest-lord-level-5-features",
          level: 5,
          items: ["oak-heart", "forest-might", "take-root"]
        }),
        fixedAbilityScoreAdvancement({
          key: "forest-lord-forest-might",
          level: 5,
          fixed: { str: 1, dex: -2, con: 2 },
          max: 22,
          title: "Лесная мощь: Сила +1, Ловкость −2, Телосложение +2"
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
