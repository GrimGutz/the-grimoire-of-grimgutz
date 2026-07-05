import {
  activeEffect,
  feature,
  folder,
  utilityActivity,
  uuidFor,
} from "../common.mjs";

const SOURCE = "Маг крови - престиж-класс";
const BLOOD_MAGE_FOLDER = "d21fd8c2e3594895";
const BLOOD_MAGE_ART = "icons/magic/unholy/orb-hands-pink.webp";
const BLOOD_MAGIC_ART = "icons/magic/unholy/hand-claw-fire-blue.webp";
const BLOOD_SPELL_ART = "icons/magic/unholy/projectile-smoke-trail-pink.webp";
const FLESH_ART = "icons/magic/life/crosses-trio-red.webp";
const FEAST_ART = "icons/magic/death/skull-energy-light-white.webp";
const FORTITUDE_ART = "icons/magic/control/buff-strength-muscle-damage-red.webp";
const SACRIFICE_ART = "icons/magic/unholy/silhouette-robe-evil-power.webp";
const THRALL_ART = "icons/magic/control/debuff-energy-hold-levitate-pink.webp";
const MALEFICAR_ART = "icons/magic/symbols/rune-sigil-red-orange.webp";
const STRENGTH_ART = "icons/magic/control/buff-flight-wings-runes-red.webp";

const SPELL_LABELS = {
  "blood-transfer-spell": "Подчинение крови / Перенос крови",
  "blood-thrall-spell": "Кровный трэлл",
};
const spellLink = (key) => `@UUID[${uuidFor("spells", key)}]{${SPELL_LABELS[key] ?? key}}`;

export const bloodMageFolders = [
  folder({ key: "blood-mage-features", name: "Маг крови: классовые особенности", sort: 1100000 })
];

function bloodMageFeature({ key, name, img, level, description, activities = {}, effects = [] }) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: "Маг крови",
    folder: BLOOD_MAGE_FOLDER,
    sourcePage: "1-5",
    sourceCustom: SOURCE,
    description: description.trim(),
    activities,
    effects,
    automation: {
      feature: key,
      bloodMageFeature: true,
      requiredLevel: level,
    },
  });
}

function bloodMagicCostActivity(slotLevel, formula) {
  return utilityActivity({
    key: `blood-magic-cost-${slotLevel}`,
    name: `Цена крови: ячейка ${slotLevel}-го уровня`,
    action: "apply-blood-magic-cost",
    actionData: {
      bloodMagicSlotLevel: slotLevel,
      bloodMagicFormula: formula,
    },
    activation: "special",
    condition: "Вы используете Магию крови для заклинания без дорогостоящего материального компонента.",
    spellSlot: false,
  });
}

const bloodMagicActivities = Object.assign(
  {},
  ...[
    [1, "2d8"],
    [2, "3d8"],
    [3, "5d8"],
    [4, "6d8"],
    [5, "7d8"],
  ].map(([slotLevel, formula]) => bloodMagicCostActivity(slotLevel, formula))
);

export const bloodMageDocuments = [
  bloodMageFeature({
    key: "blood-mage-spellcasting",
    name: "Использование заклинаний",
    img: BLOOD_MAGE_ART,
    level: 1,
    description: `
<p>Класс Мага крови открывает отдельный источник заклинаний. Ваша заклинательная характеристика для заклинаний мага крови - Телосложение. СЛ спасброска равна 8 + бонус мастерства + модификатор Телосложения; модификатор атаки заклинанием равен бонусу мастерства + модификатору Телосложения.</p>
<p>Маг крови считается полным заклинателем при определении ячеек заклинаний мультикласса. Известные заклинания мага крови: 1 на 1-м уровне, 2 на 2-м, 3 на 3-м, 4 на 4-м и 5 на 5-м. При получении уровня в классе вы можете заменить одно известное заклинание мага крови другим из списка класса.</p>
<p>Ваша кровь может служить фокусировкой для заклинаний мага крови.</p>
`,
  }),
  bloodMageFeature({
    key: "blood-magic",
    name: "Магия крови",
    img: BLOOD_MAGIC_ART,
    level: 1,
    activities: bloodMagicActivities,
    description: `
<p>Вы можете накладывать известное или подготовленное вами заклинание при помощи магии крови, если у заклинания нет дорогостоящего материального компонента. Заклинание лечения нельзя накладывать этим способом, если оно восстанавливает ваши хиты.</p>
<p>Для использования вам нужно иметь доступ к рукопашному оружию, наносящему рубящий или колющий урон, и свободную руку. Вы игнорируете соматические и материальные компоненты заклинания и не тратите ячейку заклинания.</p>
<p>Вместо этого вы получаете некротический урон, который нельзя уменьшить и который проходит сквозь временные хиты и другие эффекты с отдельным запасом хитов. Ваш максимум хитов уменьшается на то же значение до завершения продолжительного отдыха. Выбранный уровень ячейки должен быть доступен вам и не может быть выше вашего уровня в классе Мага крови.</p>
<table><thead><tr><th>Уровень ячейки</th><th>Урон</th></tr></thead><tbody><tr><td>1</td><td>9 или 2к8</td></tr><tr><td>2</td><td>14 или 3к8</td></tr><tr><td>3</td><td>23 или 5к8</td></tr><tr><td>4</td><td>27 или 6к8</td></tr><tr><td>5</td><td>32 или 7к8</td></tr></tbody></table>
<p><strong>Автоматизация:</strong> активности цены крови бросают соответствующий урон, уменьшают текущие хиты напрямую и создают эффект снижения максимума хитов до продолжительного отдыха. Проверку компонентов, лечения, оружия, свободной руки и доступности конкретной ячейки подтверждает игрок или Мастер.</p>
`,
  }),
  bloodMageFeature({
    key: "flesh-canvas",
    name: "Холст плоти",
    img: FLESH_ART,
    level: 1,
    description: `
<p>На 1-м уровне старые шрамы младше года полностью исцеляются. Во время короткого или продолжительного отдыха все порезы, рассечения и поверхностные повреждения, полученные менее 24 часов назад, полностью заживают.</p>
<p>Во время отдыха вы можете сосредоточиться на одной ране, чтобы исцеляющие эффекты не закрывали ее.</p>
`,
  }),
  bloodMageFeature({
    key: "feast-of-the-fallen",
    name: "Пир павших",
    img: FEAST_ART,
    level: 2,
    activities: utilityActivity({
      key: "feast-of-the-fallen",
      name: "Поглотить силу трупа",
      activation: "action",
      rangeValue: 60,
      targetType: "object",
      targetCount: "1",
      targetChoice: true,
      spellSlot: false,
    }),
    description: `
<p>Действием вы поглощаете остатки жизненной силы из трупов рядом с вами. Большая часть трупа должна находиться в пределах 60 футов, существо должно было иметь кровь, умереть не более 24 часов назад и еще не быть целью этой особенности.</p>
<p>Ваш максимум хитов восстанавливается в направлении обычного максимума на значение, зависящее от размера и костей хитов трупа: маленький или средний - 1 кость хитов, большой - 2 кости хитов, огромный - 3 кости хитов, громадный - 5 костей хитов.</p>
<p>На 4-м уровне вы можете использовать эту особенность бонусным действием. На 5-м уровне при использовании вы можете дополнительно восстановить текущие хиты на величину восстановленного максимума хитов; это дополнительное исцеление доступно один раз до завершения продолжительного отдыха.</p>
`,
  }),
  bloodMageFeature({
    key: "blood-transfer",
    name: "Перенос крови",
    img: BLOOD_SPELL_ART,
    level: 3,
    description: `
<p>Начиная с 3-го уровня вы можете использовать заклинание ${spellLink("blood-transfer-spell")} при помощи особенности Магия крови. Вы не можете использовать это заклинание другим способом, если оно не известно вам как заклинание волшебника или из другого источника.</p>
`,
  }),
  bloodMageFeature({
    key: "sanguine-fortitude",
    name: "Сангвинистическая стойкость",
    img: FORTITUDE_ART,
    level: 3,
    effects: [
      activeEffect({
        key: "blood-mage-sanguine-fortitude",
        name: "Сангвинистическая стойкость",
        img: FORTITUDE_ART,
        changes: [
          {
            key: "system.traits.ci.value",
            type: "custom",
            value: "diseased",
            priority: 20,
          },
        ],
      }),
    ],
    description: `
<p>Начиная с 3-го уровня вы получаете иммунитет к болезням. Болезни, уже действовавшие на вас, излечиваются.</p>
<p><strong>Автоматизация:</strong> модуль добавляет иммунитет к состоянию diseased через переносимый пассивный эффект.</p>
`,
  }),
  bloodMageFeature({
    key: "blood-mage-sacrifice",
    name: "Жертва",
    img: SACRIFICE_ART,
    level: 4,
    activities: utilityActivity({
      key: "blood-mage-sacrifice",
      name: "Жертва",
      action: "roll-blood-mage-sacrifice",
      activation: "action",
      rangeValue: 60,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      spellSlot: false,
    }),
    description: `
<p>Действием выберите союзное существо с кровью, которое вы видите в пределах 60 футов. Цель не обязана быть союзником, если она находится под действием вашего ${spellLink("blood-transfer-spell")} или ${spellLink("blood-thrall-spell")}. Цель совершает спасбросок Телосложения против СЛ ваших заклинаний мага крови.</p>
<p>При провале цель получает 4к8 некротического урона, а ее максимум хитов уменьшается на величину полученного урона до завершения продолжительного отдыха. Вы восстанавливаете хиты в размере нанесенного урона. При успехе цель не получает урон, вы не исцеляетесь, и цель понимает, что вы применили эту особенность.</p>
<p>На 5-м уровне, если цель умирает или теряет сознание из-за этой особенности, вы дополнительно восстанавливаете 2к8 хитов.</p>
<p><strong>Автоматизация:</strong> активность бросает 4к8 урона, а на 5-м уровне дополнительно показывает 2к8 возможного исцеления. Спасбросок, выбор цели, уменьшение максимума хитов цели и восстановление хитов применяются вручную.</p>
`,
  }),
  bloodMageFeature({
    key: "blood-thrall",
    name: "Кровный трэлл",
    img: THRALL_ART,
    level: 5,
    description: `
<p>Начиная с 5-го уровня вы можете использовать заклинание ${spellLink("blood-thrall-spell")} при помощи особенности Магия крови. Вы не можете использовать это заклинание другим способом, если оно не известно вам как заклинание из другого источника.</p>
`,
  }),
  bloodMageFeature({
    key: "maleficar",
    name: "Малефикар",
    img: MALEFICAR_ART,
    level: 5,
    description: `
<p>Вы получаете изъян: "Меня преследуют из-за моего величия".</p>
`,
  }),
  bloodMageFeature({
    key: "sanguine-strength",
    name: "Сангвиническая сила",
    img: STRENGTH_ART,
    level: 5,
    description: `
<p>Ваше Телосложение увеличивается на 2, а максимум этого значения становится 22, если он уже не был выше.</p>
<p><strong>Автоматизация:</strong> прибавка к Телосложению добавлена как advancement класса на 5-м уровне.</p>
`,
  }),
];
