import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData
} from "../common.mjs";

const SOURCE = "Престиж-класс: Джаггернаут; предоставленный PDF PK_Juggernaut (2).pdf";

const description = `
  <h1>Престиж-класс: Джаггернаут</h1>
  <p>Джаггернауты — персонажи, чьи способности исцелять себя и выдерживать вред превосходят обычную смертность. Их живучесть может быть магической регенерацией, нечестивой силой, божественной стойкостью, звериной природой или простой невозможностью умереть вовремя.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Телосложение 16.</strong></li>
    <li><strong>Уровень персонажа 15.</strong></li>
    <li><strong>Способность исцелять себя.</strong> Классовая особенность, черта или расовая черта должна позволять восстанавливать хиты хотя бы раз за продолжительный отдых.</li>
    <li><strong>Выпавшая 20 на спасброске от смерти.</strong> В прошлом вы должны были вернуться в сознание благодаря натуральной 20 на спасброске от смерти. Мастер может отменить это требование.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Телосложение и общий уровень персонажа. Требование самовосстановления и историю натуральной 20 подтверждает Мастер, потому что они зависят от набора особенностей и истории персонажа.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к12 за каждый уровень Джаггернаута.</p>
  <p><strong>Хиты на 1-м уровне:</strong> 12 + модификатор Телосложения.</p>
  <p><strong>Хиты на следующих уровнях:</strong> 1к12 (или 7) + модификатор Телосложения за каждый уровень Джаггернаута после первого.</p>
  <p><strong>Владение:</strong> Джаггернаут не даёт нового владения бронёй, оружием, инструментами, спасбросками или навыками.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Бонус мастерства</th>
        <th>Особенности</th>
        <th>Бонус регенерации</th>
        <th>Порог хитов</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>+2</td><td>Славное выживание, Регенерирующая душа, Недостаток регенерации</td><td>+1</td><td>1/4</td></tr>
      <tr><td>2</td><td>+2</td><td>Отрицание смерти, Несгибаемость, Что за рана?</td><td>+3</td><td>1/4</td></tr>
      <tr><td>3</td><td>+2</td><td>Объять жизнь, Неподвижный объект, Малая регенерация</td><td>+3</td><td>1/3</td></tr>
      <tr><td>4</td><td>+2</td><td>Улучшение характеристик, Отказ от смерти, Что за раны?</td><td>+6</td><td>1/3</td></tr>
      <tr><td>5</td><td>+3</td><td>Объять жизнь (улучшение), Большая регенерация, Неудержимая сила</td><td>+6</td><td>1/2</td></tr>
    </tbody>
  </table>
`;

export const juggernautClassDocuments = [
  baseDocument({
    key: "juggernaut-class",
    name: "Джаггернаут",
    type: "class",
    img: "icons/skills/wounds/anatomy-organ-heart-red.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "juggernaut"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–5", SOURCE),
      identifier: "juggernaut",
      levels: 1,
      hitDice: "d12",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("juggernaut-hit-points"),
        scaleValueAdvancement({
          key: "juggernaut-regeneration-bonus",
          identifier: "regeneration-bonus",
          title: "Бонус регенерации",
          scale: {
            1: { value: 1 },
            2: { value: 3 },
            3: { value: 3 },
            4: { value: 6 },
            5: { value: 6 }
          }
        }),
        itemGrant({
          key: "juggernaut-level-1-features",
          level: 1,
          items: ["glorious-survival", "regenerating-soul", "regeneration-flaw"]
        }),
        itemGrant({
          key: "juggernaut-level-2-features",
          level: 2,
          items: ["denial-of-death", "unyielding", "what-wound"]
        }),
        itemGrant({
          key: "juggernaut-level-3-features",
          level: 3,
          items: ["embrace-life", "immovable-object", "minor-regeneration"]
        }),
        abilityScoreImprovementAdvancement({
          key: "juggernaut-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "juggernaut-level-4-features",
          level: 4,
          items: ["refusal-of-death", "what-wounds"]
        }),
        itemGrant({
          key: "juggernaut-level-5-features",
          level: 5,
          items: ["embrace-life-improved", "greater-regeneration", "unstoppable-force"]
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
