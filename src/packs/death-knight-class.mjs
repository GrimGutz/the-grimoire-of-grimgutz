import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  sourceData
} from "../common.mjs";

const SOURCE = "Престиж-класс: Рыцарь смерти; перевод Айвендил, 21.03.2018";

const description = `
  <h1>Престиж-класс: Рыцарь смерти</h1>
  <p>Рыцарь смерти — падший паладин, умерший после нарушения своей клятвы, но прежде чем сумел осознать последствия и искупить содеянное. Он продолжает существование в виде нежити, принимая свою судьбу либо пытаясь положить конец собственным мучениям.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Паладин 5-го уровня.</strong> Персонаж должен был дать священную клятву и некоторое время жить как Паладин.</li>
    <li><strong>Нарушенная клятва.</strong> Персонаж нарушил клятву, разгневал своего бога и не успел либо не пожелал искупить грех.</li>
    <li><strong>Смерть.</strong> Персонаж умер до того, как получил возможность искупить нарушение клятвы.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет наличие минимум пяти уровней Паладина. Нарушение клятвы и смерть являются сюжетными требованиями и подтверждаются Мастером. Строгую проверку можно отключить в настройках мира.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к10 за каждый уровень Рыцаря смерти.</p>
  <p><strong>Хиты за уровень:</strong> 1к10 (или 6) + модификатор Телосложения.</p>
  <p><strong>Спасброски, навыки и оружие:</strong> новых владений нет.</p>

  <table>
    <thead>
      <tr><th>Уровень</th><th>Особенности</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Мистическая сила, Нежить</td></tr>
      <tr><td>2</td><td>Сопротивление магии</td></tr>
      <tr><td>3</td><td>Сильная нежить</td></tr>
      <tr><td>4</td><td>Улучшение характеристик</td></tr>
      <tr><td>5</td><td>Боевая нежить, Дополнительная атака Рыцаря смерти</td></tr>
    </tbody>
  </table>
`;

export const deathKnightClassDocuments = [
  baseDocument({
    key: "death-knight-class",
    name: "Рыцарь смерти",
    type: "class",
    img: "icons/magic/death/undead-skeleton-worn-blue.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "death-knight"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1", SOURCE),
      identifier: "death-knight",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("death-knight-hit-points"),
        itemGrant({
          key: "death-knight-level-1-features",
          level: 1,
          items: ["mystical-power", "undead-nature"]
        }),
        itemGrant({
          key: "death-knight-level-2-features",
          level: 2,
          items: ["death-knight-magic-resistance"]
        }),
        itemGrant({
          key: "death-knight-level-3-features",
          level: 3,
          items: ["strong-undead"]
        }),
        abilityScoreImprovementAdvancement({
          key: "death-knight-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "death-knight-level-5-features",
          level: 5,
          items: ["battle-undead", "death-knight-extra-attack"]
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
