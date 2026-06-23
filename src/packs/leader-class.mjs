import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  sourceData,
  traitChoiceAdvancement
} from "../common.mjs";
import {
  LEADER_EXPERTISE_BENEFITS,
  LEADER_PRESENCES,
  LEADER_STRATAGEMS
} from "./leader-features.mjs";

const SOURCE = "Престиж-класс: Лидер; Legends of Prestige and Prowess v1.2; предоставленный PDF Leader.pdf";

const description = `
  <h1>Престиж-класс: Лидер</h1>
  <p>Лидер поддерживает союзников немагическими приказами, координацией, вдохновением и точным выбором момента. Способности класса рассчитаны на персонажа, который следит за позиционированием союзников и врагов и выбирает подходящую стратагему.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Интеллект, Мудрость или Харизма 13.</strong></li>
    <li><strong>Мудрость 11 и Харизма 11.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Командование другими.</strong> Обычно требуется возглавлять организацию не менее чем из пяти человек либо изменить мировоззрение NPC на своё; Мастер может разрешить иной критерий.</li>
    <li><strong>Владение навыком лидерства.</strong> Хотя бы один из навыков: Обращение с животными, Обман, История, Проницательность, Запугивание, Расследование, Религия, Выступление или Убеждение.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет характеристики, общий уровень и владение хотя бы одним допустимым навыком. Требование «Командование другими» проверяется Мастером, поскольку оно зависит от сюжета. Формулы особенностей Лидера используют бонус мастерства из таблицы класса (+2 на уровнях 1–4, +3 на уровне 5), не изменяя общий бонус мастерства персонажа. Строгую проверку можно отключить в настройках мира.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к8 за каждый уровень Лидера.</p>
  <p><strong>Хиты за уровень:</strong> 1к8 (или 5) + модификатор Телосложения.</p>
  <p><strong>Доспехи, оружие, инструменты и спасброски:</strong> нет.</p>
  <p><strong>Навыки:</strong> выберите Проницательность, Запугивание, Расследование или Убеждение.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Бонус мастерства</th>
        <th>Особенности</th>
        <th>Стратагемы</th>
        <th>Проблеск гения</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>+2</td><td>Стратагемы командования</td><td>2</td><td>—</td></tr>
      <tr><td>2</td><td>+2</td><td>Мгновение славы, Проблеск гения</td><td>2</td><td>1</td></tr>
      <tr><td>3</td><td>+2</td><td>Экспертность лидерства, Идеальная координация</td><td>3</td><td>1</td></tr>
      <tr><td>4</td><td>+2</td><td>Улучшение характеристик</td><td>3</td><td>2</td></tr>
      <tr><td>5</td><td>+3</td><td>Присутствие лидера</td><td>4</td><td>2</td></tr>
    </tbody>
  </table>
`;

export const leaderClassDocuments = [
  baseDocument({
    key: "leader-class",
    name: "Лидер",
    type: "class",
    img: "icons/skills/social/diplomacy-unity-alliance.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "leader"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–6", SOURCE),
      identifier: "leader",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("leader-hit-points"),
        traitChoiceAdvancement({
          key: "leader-skill",
          level: 1,
          pool: ["skills:ins", "skills:itm", "skills:inv", "skills:per"],
          title: "Владение навыком Лидера",
          hint: "Выберите Проницательность, Запугивание, Расследование или Убеждение."
        }),
        itemGrant({
          key: "leader-level-1-features",
          level: 1,
          items: ["leader-command-stratagems"]
        }),
        itemChoice({
          key: "leader-level-1-stratagems",
          level: 1,
          items: LEADER_STRATAGEMS,
          count: 2,
          title: "Стратагемы командования",
          hint: "Выберите две известные стратагемы."
        }),
        itemGrant({
          key: "leader-level-2-features",
          level: 2,
          items: ["moment-of-glory", "glimpse-of-genius"]
        }),
        itemGrant({
          key: "leader-level-3-features",
          level: 3,
          items: ["leadership-expertise", "perfect-coordination"]
        }),
        traitChoiceAdvancement({
          key: "leader-expertise",
          level: 3,
          pool: [
            "skills:ani",
            "skills:dec",
            "skills:his",
            "skills:ins",
            "skills:itm",
            "skills:inv",
            "skills:prf",
            "skills:per",
            "skills:rel",
            "tool:navg",
            "tool:game:*",
            "tool:music:*"
          ],
          mode: "expertise",
          title: "Экспертность лидерства",
          hint: "Выберите допустимый навык или инструмент, которым персонаж уже владеет."
        }),
        itemChoice({
          key: "leader-expertise-benefit",
          level: 3,
          items: LEADER_EXPERTISE_BENEFITS,
          title: "Преимущество Экспертности лидерства",
          hint: "Выберите одно постоянное преимущество."
        }),
        itemChoice({
          key: "leader-level-3-stratagem",
          level: 3,
          items: LEADER_STRATAGEMS,
          title: "Стратагема командования",
          hint: "Выберите третью известную стратагему."
        }),
        abilityScoreImprovementAdvancement({
          key: "leader-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "leader-level-5-features",
          level: 5,
          items: ["leader-presence"]
        }),
        itemChoice({
          key: "leader-level-5-presence",
          level: 5,
          items: LEADER_PRESENCES,
          title: "Присутствие лидера",
          hint: "Выберите одно постоянное присутствие."
        }),
        itemChoice({
          key: "leader-level-5-stratagem",
          level: 5,
          items: LEADER_STRATAGEMS,
          title: "Стратагема командования",
          hint: "Выберите четвёртую известную стратагему."
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
