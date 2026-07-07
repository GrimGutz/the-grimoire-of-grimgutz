import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemChoice,
  itemGrant,
  scaleValueAdvancement,
  sourceData
} from "../common.mjs";
import { WITCH_BLADE_GREAT_DESIGNS } from "./witch-blade-features.mjs";

const SOURCE = "Престиж-класс: Ведьмин клинок; предоставленный PDF PK_WitchBlade (1).pdf";

const rageScale = { 1: { value: 3 }, 2: { value: 4 }, 3: { value: 5 }, 4: { value: 6 }, 5: { value: 7 } };
const knownSpellScale = { 1: { value: 4 }, 2: { value: 5 }, 3: { value: 6 }, 4: { value: 7 }, 5: { value: 8 } };
const spellSlotScales = {
  1: { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 },
  2: { 1: 3, 2: 4, 3: 5, 4: 5, 5: 5 },
  3: { 1: 0, 2: 0, 3: 3, 4: 4, 5: 4 },
  4: { 1: 0, 2: 0, 3: 0, 4: 3, 5: 3 },
  5: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 }
};

function slotScale(slotLevel) {
  return Object.fromEntries(Object.entries(spellSlotScales[slotLevel]).map(([level, value]) => [level, { value }]));
}

const description = `
  <h1>Престиж-класс: Ведьмин клинок</h1>
  <p>Ведьмины клинки — духи возмездия, выкованные из стали, пламени и изученной магии. Они охотятся на магически одарённых врагов, превращая собственное оружие в проводник чуждой силы.</p>

  <h2>Предварительные требования</h2>
  <ul>
    <li><strong>Сила или Ловкость 15.</strong></li>
    <li><strong>Телосложение 15.</strong></li>
    <li><strong>Интеллект 15.</strong></li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет напечатанные в PDF требования к характеристикам. В PDF не указано отдельное требование общего уровня персонажа; если в вашей кампании все престиж-классы требуют 5-й уровень, это ограничение нужно держать как правило Мастера.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость Хитов:</strong> 1к10 за каждый уровень Ведьминого клинка.</p>
  <p><strong>Хиты на 1-м уровне:</strong> 10 + модификатор Телосложения.</p>
  <p><strong>Хиты на следующих уровнях:</strong> 1к10 (или 6) + модификатор Телосложения за каждый уровень после первого.</p>
  <p><strong>Доспехи, оружие, инструменты, спасброски и навыки:</strong> новых владений нет.</p>
  <p><strong>Снаряжение:</strong> класс не даёт дополнительного снаряжения.</p>

  <table>
    <thead><tr><th>Уровень</th><th>Особенности</th><th>Очки Гнева</th><th>Известные заклинания</th><th>1-й</th><th>2-й</th><th>3-й</th><th>4-й</th><th>5-й</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Чародейство, Охотник на ведьм</td><td>3</td><td>4</td><td>3</td><td>3</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td>2</td><td>Мертвая зона</td><td>4</td><td>5</td><td>4</td><td>4</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td>3</td><td>Печать Ведьминого клинка</td><td>5</td><td>6</td><td>5</td><td>5</td><td>3</td><td>—</td><td>—</td></tr>
      <tr><td>4</td><td>Великий замысел</td><td>6</td><td>7</td><td>6</td><td>5</td><td>4</td><td>3</td><td>—</td></tr>
      <tr><td>5</td><td>Нематериальный вихрь</td><td>7</td><td>8</td><td>7</td><td>5</td><td>4</td><td>3</td><td>2</td></tr>
    </tbody>
  </table>

  <h2>Заклинания Ведьминого клинка</h2>
  <p>Класс может выбирать заклинания волшебника доступного уровня и заклинания Ведьминого клинка из этого модуля. Заклинания с пометкой «только для Добра» или «только для Зла» доступны согласно мировоззрению персонажа.</p>
`;

export const witchBladeClassDocuments = [
  baseDocument({
    key: "witch-blade-class",
    name: "Ведьмин клинок",
    type: "class",
    img: "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/ConsumeMagic.png",
    flags: {
      [MODULE_ID]: {
        prestigeClass: "witch-blade"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–3", SOURCE),
      identifier: "witch-blade",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("witch-blade-hit-points"),
        scaleValueAdvancement({ key: "witch-blade-rage-points", identifier: "rage-points", scale: rageScale, title: "Очки Гнева" }),
        scaleValueAdvancement({ key: "witch-blade-known-spells", identifier: "known-spells", scale: knownSpellScale, title: "Известные заклинания" }),
        scaleValueAdvancement({ key: "witch-blade-spell-slots-1", identifier: "spell-slots-1", scale: slotScale(1), title: "Ячейки 1-го уровня" }),
        scaleValueAdvancement({ key: "witch-blade-spell-slots-2", identifier: "spell-slots-2", scale: slotScale(2), title: "Ячейки 2-го уровня" }),
        scaleValueAdvancement({ key: "witch-blade-spell-slots-3", identifier: "spell-slots-3", scale: slotScale(3), title: "Ячейки 3-го уровня" }),
        scaleValueAdvancement({ key: "witch-blade-spell-slots-4", identifier: "spell-slots-4", scale: slotScale(4), title: "Ячейки 4-го уровня" }),
        scaleValueAdvancement({ key: "witch-blade-spell-slots-5", identifier: "spell-slots-5", scale: slotScale(5), title: "Ячейки 5-го уровня" }),
        itemGrant({ key: "witch-blade-level-1-features", level: 1, items: ["witch-blade-spellcasting", "witch-hunter"] }),
        itemGrant({ key: "witch-blade-level-2-features", level: 2, items: ["dead-zone"] }),
        itemGrant({ key: "witch-blade-level-3-features", level: 3, items: ["witch-blade-seal"] }),
        itemGrant({ key: "witch-blade-level-4-features", level: 4, items: ["great-design"] }),
        itemChoice({
          key: "witch-blade-level-4-great-design",
          level: 4,
          items: WITCH_BLADE_GREAT_DESIGNS,
          title: "Великий замысел",
          hint: "Выберите один боевой стиль Ведьминого клинка."
        }),
        itemGrant({ key: "witch-blade-level-5-features", level: 5, items: ["immaterial-whirlwind"] })
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
