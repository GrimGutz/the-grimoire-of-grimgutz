import {
  MODULE_ID,
  baseDocument,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Чумной маг; предоставленный PDF PK_PlagueDoc (1).pdf";
const PLAGUE_DOCTOR_ART = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/BlackPlague.png";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

const description = `
  <h1>Престиж-класс: Чумной маг / Plague Doctor</h1>
  <p>Чумные маги превращают пережитую болезнь в оружие. Они собирают инфекции, скрытно наносят заражённые удары, создают разумные вирусные агенты и в конце пути могут распылить собственное тело в форму эпидемии.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Телосложение 15.</strong></li>
    <li><strong>Владение навыком Медицина.</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Выжить после инфекции.</strong> Персонаж должен пережить естественное смертельное заболевание либо инфекцию из магического источника.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> модуль проверяет Телосложение, общий уровень персонажа и владение Медициной. Выживание после инфекции подтверждает Мастер.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к10 за каждый уровень Чумного мага.</p>
  <p><strong>Хиты за уровень:</strong> 1к10 (или 6) + модификатор Телосложения.</p>
  <p><strong>Владение доспехами:</strong> лёгкие доспехи.</p>
  <p><strong>Владение оружием:</strong> любое оружие со свойством «лёгкое». Это владение отмечается вручную для конкретного оружия, потому что dnd5e хранит владения по типам/base item, а не по свойству оружия.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Скрытая атака</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>${featureLink("plague-sneak-attack", "Скрытая атака")}, ${featureLink("disease-carrier", "Разносчик заболеваний")}</td><td>2к6</td></tr>
      <tr><td>2</td><td>${featureLink("ragged-armor", "Оборванец")}, ${featureLink("touch-of-disease", "Касание болезни")}</td><td>2к6</td></tr>
      <tr><td>3</td><td>${featureLink("smart-infection", "Умная инфекция")}</td><td>2к6</td></tr>
      <tr><td>4</td><td>${featureLink("infect-wounds", "Инфицирование ран")}</td><td>3к6</td></tr>
      <tr><td>5</td><td>${featureLink("disease-form", "Форма болезни")}</td><td>3к6</td></tr>
    </tbody>
  </table>
`;

export const plagueDoctorClassDocuments = [
  baseDocument({
    key: "plague-doctor-class",
    name: "Чумной маг / Plague Doctor",
    type: "class",
    img: PLAGUE_DOCTOR_ART,
    flags: {
      [MODULE_ID]: {
        prestigeClass: "plague-doctor"
      }
    },
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–2", SOURCE),
      identifier: "plague-doctor",
      levels: 1,
      hitDice: "d10",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement("plague-doctor-hit-points"),
        traitAdvancement({
          key: "plague-doctor-light-armor",
          level: 1,
          grants: ["armor:lgt"],
          title: "Владение лёгкими доспехами"
        }),
        scaleValueAdvancement({
          key: "plague-doctor-sneak-attack",
          identifier: "sneak-attack",
          title: "Скрытая атака",
          scale: {
            1: { value: "2d6" },
            2: { value: "2d6" },
            3: { value: "2d6" },
            4: { value: "3d6" },
            5: { value: "3d6" }
          },
          type: "dice"
        }),
        itemGrant({
          key: "plague-doctor-level-1-features",
          level: 1,
          items: ["plague-sneak-attack", "disease-carrier"]
        }),
        itemGrant({
          key: "plague-doctor-level-2-features",
          level: 2,
          items: ["ragged-armor", "touch-of-disease"]
        }),
        itemGrant({
          key: "plague-doctor-level-3-features",
          level: 3,
          items: ["smart-infection"]
        }),
        itemGrant({
          key: "plague-doctor-level-4-features",
          level: 4,
          items: ["infect-wounds"]
        }),
        itemGrant({
          key: "plague-doctor-level-5-features",
          level: 5,
          items: ["disease-form"]
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
