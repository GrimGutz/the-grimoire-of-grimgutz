import {
  MODULE_ID,
  baseDocument,
  itemChoice,
  itemGrant,
  itemGrantUuids,
  sourceData,
  traitAdvancement
} from "../common.mjs";
import { SCHOOL_OF_STEEL_SIGNATURES } from "./school-of-steel-features.mjs";

const SOURCE = "Подкласс волшебника: Школа стали; предоставленный PDF Wizzard_School_of_Steel (1).pdf";
const ANIMATE_OBJECTS_UUID = "Compendium.dnd5e.spells.Item.ATo0Eb63TDtnu6iA";

const description = `
  <h1>Волшебник: Школа стали</h1>
  <p>Волшебники Школы стали превращают оружие в продолжение своей воли. Они частично анимируют клинок, копьё или молот, направляют его Интеллектом и используют магию металла для контроля поля боя.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень волшебника</th>
        <th>Особенности</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>2</td><td>Боевая тренировка</td></tr>
      <tr><td>6</td><td>Калечащие удары</td></tr>
      <tr><td>10</td><td>Мастер металла</td></tr>
      <tr><td>14</td><td>Фирменный приём</td></tr>
    </tbody>
  </table>

  <p><strong>Автоматизация Foundry:</strong> подкласс привязан к базовому классу Волшебник и выдаёт особенности через стандартный Advancement на 2-м, 6-м, 10-м и 14-м уровнях. На 2-м уровне выдаётся владение воинским оружием. На 10-м уровне дополнительно выдаётся системное заклинание Оживление предметов. На 14-м уровне менеджер развития предложит выбрать один фирменный приём: Стальной шторм, Имперская досягаемость или Металлист.</p>
`;

export const schoolOfSteelSubclassDocuments = [
  baseDocument({
    key: "school-of-steel-subclass",
    name: "Школа стали",
    type: "subclass",
    img: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
    flags: {
      [MODULE_ID]: {
        wizardSubclass: "school-of-steel"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "school-of-steel",
      classIdentifier: "wizard",
      advancement: [
        traitAdvancement({
          key: "school-steel-martial-weapons",
          level: 2,
          grants: ["weapon:mar"],
          title: "Боевая тренировка: воинское оружие"
        }),
        itemGrant({
          key: "school-steel-level-2",
          level: 2,
          items: ["steel-battle-training"]
        }),
        itemGrant({
          key: "school-steel-level-6",
          level: 6,
          items: ["steel-crippling-strikes"]
        }),
        itemGrant({
          key: "school-steel-level-10",
          level: 10,
          items: ["steel-master-of-metal"]
        }),
        itemGrantUuids({
          key: "school-steel-animate-objects",
          level: 10,
          title: "Мастер металла: Оживление предметов",
          uuids: [ANIMATE_OBJECTS_UUID]
        }),
        itemGrant({
          key: "school-steel-level-14",
          level: 14,
          items: ["steel-signature-technique"]
        }),
        itemChoice({
          key: "school-steel-level-14-signature",
          level: 14,
          items: SCHOOL_OF_STEEL_SIGNATURES,
          title: "Фирменный приём",
          hint: "Выберите один фирменный приём Школы стали."
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "",
        preparation: {}
      }
    }
  })
];
