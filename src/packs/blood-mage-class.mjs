import {
  MODULE_ID,
  baseDocument,
  fixedAbilityScoreAdvancement,
  hitPointsAdvancement,
  itemGrant,
  scaleValueAdvancement,
  sourceData,
  traitAdvancement,
  uuidFor,
} from "../common.mjs";

const SOURCE = "Маг крови - престиж-класс";
const CLASS_ART = "icons/magic/unholy/orb-hands-pink.webp";
const FEATURE_LABELS = {
  "blood-mage-spellcasting": "Использование заклинаний",
  "blood-magic": "Магия крови",
  "flesh-canvas": "Холст плоти",
  "feast-of-the-fallen": "Пир павших",
  "blood-transfer": "Перенос крови",
  "sanguine-fortitude": "Сангвинистическая стойкость",
  "blood-mage-sacrifice": "Жертва",
  "blood-thrall": "Кровный трэлл",
  "maleficar": "Малефикар",
  "sanguine-strength": "Сангвиническая сила",
};
const SPELL_LABELS = {
  "blood-transfer-spell": "Подчинение крови / Перенос крови",
  "blood-thrall-spell": "Кровный трэлл",
};
const featureLink = (key) => `@UUID[${uuidFor("features", key)}]{${FEATURE_LABELS[key] ?? key}}`;
const spellLink = (key) => `@UUID[${uuidFor("spells", key)}]{${SPELL_LABELS[key] ?? key}}`;

const bloodMageDescription = `
<p>Маг крови обращает собственную жизненную силу в заклинания и власть над телами существ, в жилах которых течет кровь. Этот престиж-класс рассчитан на персонажей, уже способных пользоваться магией 3-го круга, и использует Телосложение как заклинательную характеристику.</p>
<h3>Требования</h3>
<ul>
  <li>Телосложение 13 или выше.</li>
  <li>Существо не должно быть бескровным: конструктом, элементалем, слизью, растением, нежитью, живым конструктом или похожим исключением на усмотрение Мастера.</li>
  <li>Способность накладывать хотя бы одно заклинание 3-го уровня или выше.</li>
  <li>Доступ к темной тайне магии крови: наставнику, трактату или другому сюжетному источнику, одобренному Мастером.</li>
</ul>
<p><strong>Автоматизация Foundry:</strong> при включенной строгой проверке модуль проверяет Телосложение 13, наличие магии 3-го уровня или выше и отсутствие очевидного бескровного типа существа. Сюжетный доступ к тайне магии крови подтверждает Мастер.</p>
<h3>Классовые особенности</h3>
<p>На 1-м уровне вы получаете ${featureLink("blood-mage-spellcasting")}, ${featureLink("blood-magic")} и ${featureLink("flesh-canvas")}. На 2-м уровне вы получаете ${featureLink("feast-of-the-fallen")}. На 3-м уровне вы получаете ${featureLink("blood-transfer")} и ${featureLink("sanguine-fortitude")}; класс также добавляет карточку заклинания ${spellLink("blood-transfer-spell")}. На 4-м уровне вы получаете ${featureLink("blood-mage-sacrifice")}. На 5-м уровне вы получаете ${featureLink("blood-thrall")}, ${featureLink("maleficar")} и ${featureLink("sanguine-strength")}; класс также добавляет карточку заклинания ${spellLink("blood-thrall-spell")}.</p>
<h3>Использование заклинаний</h3>
<p>Маг крови считается полным заклинателем для прогрессии ячеек мультикласса. Заклинательная характеристика для заклинаний мага крови - Телосложение. СЛ спасброска = 8 + бонус мастерства + модификатор Телосложения; модификатор броска атаки = бонус мастерства + модификатор Телосложения. Ваша кровь может служить фокусировкой для заклинаний мага крови.</p>
<p><strong>Известные заклинания мага крови:</strong> 1 на 1-м уровне, 2 на 2-м, 3 на 3-м, 4 на 4-м и 5 на 5-м. При повышении уровня в этом классе вы можете заменить одно известное заклинание мага крови другим из списка класса.</p>
<h3>Список заклинаний мага крови</h3>
<p><strong>1-й уровень:</strong> диссонирующий шепот, жуткий смех Таши, луч болезни, очарование личности, порча, приказ, усыпление.</p>
<p><strong>2-й уровень:</strong> внушение, глухота/слепота, корона безумия, луч слабости, речь златоуста, удержание личности, умиротворение.</p>
<p><strong>3-й уровень:</strong> ${spellLink("blood-transfer-spell")}, прикосновение вампира, притворная смерть, проклятие.</p>
<p><strong>5-й уровень:</strong> ${spellLink("blood-thrall-spell")}.</p>
`;

export const bloodMageClassDocuments = [
  baseDocument({
    key: "blood-mage",
    name: "Маг крови",
    type: "class",
    img: CLASS_ART,
    source: SOURCE,
    system: {
      description: {
        value: bloodMageDescription.trim(),
        chat: "",
      },
      source: sourceData("1-5", SOURCE),
      identifier: "blood-mage",
      levels: 1,
      hitDice: "d8",
      hitDiceUsed: 0,
      saves: [],
      skills: {
        number: 0,
        choices: [],
        value: [],
      },
      spellcasting: {
        progression: "full",
        ability: "con",
        preparation: {
          formula: "",
        },
      },
      wealth: "",
      primaryAbility: {
        value: [],
        all: false,
      },
      advancement: [
      hitPointsAdvancement("blood-mage-hit-points"),
      traitAdvancement({
        key: "blood-mage-dagger-training",
        level: 1,
        title: "Владение оружием мага крови",
        grants: ["weapon:sim:dagger"],
      }),
      scaleValueAdvancement({
        key: "blood-mage-known-spells",
        identifier: "known-spells",
        title: "Известные заклинания мага крови",
        type: "number",
        scale: {
          1: { value: 1 },
          2: { value: 2 },
          3: { value: 3 },
          4: { value: 4 },
          5: { value: 5 },
        },
      }),
      itemGrant({
        key: "blood-mage-level-1-features",
        title: "Особенности мага крови 1-го уровня",
        level: 1,
        items: ["blood-mage-spellcasting", "blood-magic", "flesh-canvas"],
      }),
      itemGrant({
        key: "blood-mage-level-2-features",
        title: "Особенности мага крови 2-го уровня",
        level: 2,
        items: ["feast-of-the-fallen"],
      }),
      itemGrant({
        key: "blood-mage-level-3-features",
        title: "Особенности мага крови 3-го уровня",
        level: 3,
        items: ["blood-transfer", "sanguine-fortitude"],
      }),
      itemGrant({
        key: "blood-mage-level-3-spells",
        title: "Заклинание мага крови 3-го уровня",
        level: 3,
        items: ["blood-transfer-spell"],
        pack: "spells",
      }),
      itemGrant({
        key: "blood-mage-level-4-features",
        title: "Особенности мага крови 4-го уровня",
        level: 4,
        items: ["blood-mage-sacrifice"],
      }),
      itemGrant({
        key: "blood-mage-level-5-features",
        title: "Особенности мага крови 5-го уровня",
        level: 5,
        items: ["blood-thrall", "maleficar", "sanguine-strength"],
      }),
      itemGrant({
        key: "blood-mage-level-5-spells",
        title: "Заклинание мага крови 5-го уровня",
        level: 5,
        items: ["blood-thrall-spell"],
        pack: "spells",
      }),
      fixedAbilityScoreAdvancement({
        key: "blood-mage-sanguine-strength-advancement",
        level: 5,
        title: "Сангвиническая сила",
        fixed: {
          con: 2,
        },
        max: 22,
      }),
      ],
    },
    flags: {
      [MODULE_ID]: {
        prestigeClass: "blood-mage",
      },
    },
    effects: [],
  }),
];
