import {
  baseDocument,
  hitPointsAdvancement,
  idFor,
  itemChoice,
  itemGrant,
  sourceData,
  strengthIncreaseAdvancement,
  traitAdvancement
} from "../common.mjs";
import { deathKnightClassDocuments } from "./death-knight-class.mjs";
import { aberrantClassDocuments } from "./aberrant-class.mjs";
import { forestLordClassDocuments } from "./forest-lord-class.mjs";
import { hereticClassDocuments } from "./heretic-class.mjs";
import { leaderClassDocuments } from "./leader-class.mjs";
import { witchBladeClassDocuments } from "./witch-blade-class.mjs";
import { juggernautClassDocuments } from "./juggernaut-class.mjs";
import { soulEaterClassDocuments } from "./soul-eater-class.mjs";
import { guardianClassDocuments } from "./guardian-class.mjs";
import { crusaderClassDocuments } from "./crusader-class.mjs";
import { feyWarriorClassDocuments } from "./fey-warrior-class.mjs";
import { ghostWalkerClassDocuments } from "./ghost-walker-class.mjs";
import { blinkerClassDocuments } from "./blinker-class.mjs";
import { fallenPriestClassDocuments } from "./fallen-priest-class.mjs";
import { plagueDoctorClassDocuments } from "./plague-doctor-class.mjs";
import { insectLordClassDocuments } from "./insect-lord-class.mjs";
import { gamblerClassDocuments } from "./gambler-class.mjs";
import { keeperClassDocuments } from "./keeper-class.mjs";
import { bloodMageClassDocuments } from "./blood-mage-class.mjs";
import { onmyojiClassDocuments } from "./onmyoji-class.mjs";
import { ritualistClassDocuments } from "./ritualist-class.mjs";
import { darkWarriorClassDocuments } from "./dark-warrior-class.mjs";
import { devilWorshipperClassDocuments } from "./devil-worshipper-class.mjs";
import { nethereseArcanistClassDocuments } from "./netherese-arcanist-class.mjs";
import { spiritVesselClassDocuments } from "./spirit-vessel-class.mjs";
import { oracleClassDocuments } from "./oracle-class.mjs";
import { demonologistClassDocuments } from "./demonologist-class.mjs";
import { sanguinistClassDocuments } from "./sanguinist-class.mjs";
import {masterClassDocuments} from "./master-class.mjs";
import {bountyHunterClassDocuments} from "./bounty-hunter-class.mjs";
import {jesterClassDocuments} from "./jester-class.mjs";
import {flagellantClassDocuments} from "./flagellant-class.mjs";

const TECHNIQUES = [
  "adaptability",
  "superior-control",
  "powerful-crushing",
  "powerful-cleaving",
  "indestructibility",
  "smithing",
  "giant-crushing"
];

const description = `
  <h1>Престиж-класс: Сокрушитель</h1>
  <p>Сокрушители отвечают силой на силу, ударом на удар и сталью на сталь. Они используют невероятно большое оружие, способное не только одолеть врага, но и полностью уничтожить его.</p>

  <h2>Требования</h2>
  <ul>
    <li><strong>Сила 18.</strong></li>
    <li><strong>Размер не ниже Среднего.</strong></li>
    <li><strong>Черта «Мастер большого оружия».</strong></li>
    <li><strong>Уровень персонажа 5.</strong></li>
    <li><strong>Массивное оружие.</strong> Вы должны найти такое оружие или получить сведения о нём, а затем найти кузнеца либо выковать оружие самостоятельно.</li>
  </ul>
  <p><strong>Автоматизация Foundry:</strong> при добавлении класса модуль проверяет Силу, общий уровень персонажа, размер, наличие черты «Мастер большого оружия» и массивного оружия. Строгую проверку можно отключить в настройках мира.</p>

  <h2>Классовые особенности</h2>
  <p><strong>Кость хитов:</strong> 1к12 за каждый уровень Сокрушителя.</p>
  <p><strong>Хиты за уровень:</strong> 1к12 (или 7) + модификатор Телосложения.</p>
  <p><strong>Спасброски:</strong> Сила.</p>
  <p><strong>Навыки:</strong> нет.</p>
  <p><strong>Оружие:</strong> массивное оружие.</p>

  <table>
    <thead>
      <tr>
        <th>Уровень</th>
        <th>Особенности</th>
        <th>Известные техники</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Стиль огромного оружия, Убийца гигантов</td><td>—</td></tr>
      <tr><td>2</td><td>Техники Сокрушителя</td><td>1</td></tr>
      <tr><td>3</td><td>Импульс</td><td>2</td></tr>
      <tr><td>4</td><td>Стальная воля</td><td>2</td></tr>
      <tr><td>5</td><td>Стальной гигант</td><td>3</td></tr>
    </tbody>
  </table>

  <h2>Массивное оружие</h2>
  <p>Образцы оружия находятся в компендиуме «Массивное оружие» этого модуля.</p>
`;

export const folders = [];

export const documents = [
  baseDocument({
    key: "crusher-class",
    name: "Сокрушитель",
    type: "class",
    img: "icons/skills/melee/strike-sword-steel-yellow.webp",
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: sourceData("1–3"),
      identifier: "crusher",
      levels: 1,
      hitDice: "d12",
      hitDiceUsed: 0,
      advancement: [
        hitPointsAdvancement(),
        itemGrant({
          key: "level-1-features",
          level: 1,
          items: ["great-weapon-style", "giant-killer"]
        }),
        itemChoice({
          key: "level-1-style",
          level: 1,
          items: ["cleaving", "crushing"],
          title: "Стиль огромного оружия",
          hint: "Выберите Раскалывание или Сокрушение."
        }),
        traitAdvancement({
          key: "strength-save",
          level: 1,
          grants: ["saves:str"],
          title: "Владение спасброском Силы"
        }),
        itemGrant({
          key: "level-2-features",
          level: 2,
          items: ["crusher-techniques"]
        }),
        itemChoice({
          key: "level-2-technique",
          level: 2,
          items: TECHNIQUES,
          title: "Техника Сокрушителя",
          hint: "Выберите одну технику, требованиям которой вы соответствуете."
        }),
        itemGrant({
          key: "level-3-features",
          level: 3,
          items: ["momentum"]
        }),
        itemChoice({
          key: "level-3-technique",
          level: 3,
          items: TECHNIQUES,
          title: "Техника Сокрушителя",
          hint: "Выберите ещё одну технику, требованиям которой вы соответствуете."
        }),
        itemGrant({
          key: "level-4-features",
          level: 4,
          items: ["steel-will"]
        }),
        itemGrant({
          key: "level-5-features",
          level: 5,
          items: ["steel-giant"]
        }),
        itemChoice({
          key: "level-5-technique",
          level: 5,
          items: TECHNIQUES,
          title: "Техника Сокрушителя",
          hint: "Выберите третью технику, требованиям которой вы соответствуете."
        }),
        strengthIncreaseAdvancement()
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
  }),
  ...leaderClassDocuments,
  ...deathKnightClassDocuments,
  ...hereticClassDocuments,
  ...forestLordClassDocuments,
  ...aberrantClassDocuments,
  ...witchBladeClassDocuments,
  ...juggernautClassDocuments,
  ...soulEaterClassDocuments,
  ...guardianClassDocuments,
  ...crusaderClassDocuments,
  ...feyWarriorClassDocuments,
  ...ghostWalkerClassDocuments,
  ...blinkerClassDocuments,
  ...fallenPriestClassDocuments,
  ...plagueDoctorClassDocuments,
  ...insectLordClassDocuments,
  ...gamblerClassDocuments,
  ...keeperClassDocuments,
  ...bloodMageClassDocuments,
  ...onmyojiClassDocuments,
  ...ritualistClassDocuments,
  ...darkWarriorClassDocuments,
  ...devilWorshipperClassDocuments,
  ...nethereseArcanistClassDocuments,
  ...spiritVesselClassDocuments,
  ...oracleClassDocuments,
  ...demonologistClassDocuments,
  ...sanguinistClassDocuments,
  ...masterClassDocuments,
  ...bountyHunterClassDocuments,
  ...jesterClassDocuments,
  ...flagellantClassDocuments
];
