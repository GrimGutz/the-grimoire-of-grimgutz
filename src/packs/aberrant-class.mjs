import {
  MODULE_ID,
  abilityScoreImprovementAdvancement,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  itemGrantUuids,
  scaleValueAdvancement,
  sourceData,
  traitChoiceAdvancement
} from "../common.mjs";

const SOURCE = "Престиж-класс: Абберант; перевод Айвендил, 16.06.2018";

const description = `
  <h1>Престиж-класс: Абберант</h1>
  <p>Абберанты проходят мучительный ритуал преобразования, усиливающий тело и всё сильнее отдаляющий их от обычных представителей своего народа.</p>
  <h2>Требования</h2>
  <ul>
    <li><strong>Телосложение 17.</strong></li>
    <li><strong>Сила или Ловкость 15.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Редкие травы или магия.</strong></li>
    <li><strong>Особая задача.</strong> Заслужить право на ритуал либо самостоятельно найти его секрет.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет характеристики и общий уровень. Компоненты, знания и завершение ритуала подтверждает Мастер.</p>
  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к10 за уровень Абберанта.</p>
  <p><strong>Хиты за уровень:</strong> 1к10 (или 6) + модификатор Телосложения.</p>
  <p><strong>Оружие:</strong> одно простое или воинское оружие на выбор.</p>
  <table>
    <thead><tr><th>Уровень</th><th>Особенности</th><th>Смертельная точность</th><th>Рефлексы чудовища</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Смертельная точность, Рефлексы чудовища</td><td>к4</td><td>+5 футов</td></tr>
      <tr><td>2</td><td>Чувство арканы, Токсичная кровь</td><td>к6</td><td>+10 футов</td></tr>
      <tr><td>3</td><td>Энергичная природа</td><td>к8</td><td>+10 футов</td></tr>
      <tr><td>4</td><td>Увеличение характеристик</td><td>к10</td><td>+15 футов</td></tr>
      <tr><td>5</td><td>Финальные изменения</td><td>к12</td><td>+15 футов</td></tr>
    </tbody>
  </table>
`;

export const aberrantClassDocuments = [
  baseDocument({
    key: "aberrant-class",
    name: "Абберант",
    type: "class",
    img: "icons/creatures/abilities/mouth-teeth-rows-red.webp",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "aberrant"
      }
    },
    system: {
      description: { value: description, chat: "" },
      source: sourceData("1–2", SOURCE),
      identifier: "aberrant",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("aberrant-hit-points"),
        scaleValueAdvancement({
          key: "aberrant-deadly-precision",
          identifier: "deadly-precision",
          title: "Кость Смертельной точности",
          type: "dice",
          scale: {
            1: { number: null, faces: 4, modifiers: [] },
            2: { number: null, faces: 6, modifiers: [] },
            3: { number: null, faces: 8, modifiers: [] },
            4: { number: null, faces: 10, modifiers: [] },
            5: { number: null, faces: 12, modifiers: [] }
          }
        }),
        scaleValueAdvancement({
          key: "aberrant-monster-reflexes",
          identifier: "monster-reflexes",
          title: "Рефлексы чудовища",
          scale: {
            1: { value: 5 },
            2: { value: 10 },
            3: { value: 10 },
            4: { value: 15 },
            5: { value: 15 }
          }
        }),
        traitChoiceAdvancement({
          key: "aberrant-weapon",
          level: 1,
          pool: ["weapon:sim:*", "weapon:mar:*"],
          title: "Владение оружием",
          hint: "Выберите одно простое или воинское оружие."
        }),
        itemGrant({
          key: "aberrant-level-1",
          level: 1,
          items: ["deadly-precision", "monster-reflexes", "unnatural-traits"]
        }),
        itemGrant({
          key: "aberrant-level-2",
          level: 2,
          items: ["arcane-sense", "toxic-blood"]
        }),
        itemGrantUuids({
          key: "aberrant-arcane-spells",
          level: 2,
          title: "Чувство арканы",
          uuids: [
            "Compendium.dnd5e.spells.Item.ghXTfe7sgCbgf1Q8",
            "Compendium.dnd5e.spells.Item.3OZnNhunvRtPOQmH"
          ]
        }),
        itemGrant({
          key: "aberrant-level-3",
          level: 3,
          items: ["vigorous-nature"]
        }),
        abilityScoreImprovementAdvancement({
          key: "aberrant-level-4-asi",
          level: 4
        }),
        itemGrant({
          key: "aberrant-level-5",
          level: 5,
          items: ["final-changes"]
        }),
        itemChoice({
          key: "aberrant-final-change",
          level: 5,
          items: ["final-changes-strength", "final-changes-dexterity"],
          title: "Финальные изменения",
          hint: "Выберите постоянное увеличение Силы или Ловкости."
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "",
        preparation: { formula: "" }
      },
      wealth: ""
    }
  })
];
