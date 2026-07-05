import {
  MODULE_ID,
  baseDocument,
  sourceData,
  utilityActivity,
} from "../common.mjs";

const SOURCE = "Маг крови - престиж-класс";
const BLOOD_TRANSFER_ART = "icons/magic/unholy/projectile-smoke-trail-pink.webp";
const BLOOD_THRALL_ART = "icons/magic/control/debuff-energy-hold-levitate-pink.webp";

function activities(...entries) {
  return Object.assign({}, ...entries);
}

function bloodMageSpell({
  key,
  name,
  img,
  level,
  description,
  spellActivities,
}) {
  return baseDocument({
    key,
    name,
    type: "spell",
    img,
    flags: {
      [MODULE_ID]: {
        bloodMageSpell: true,
      },
    },
    system: {
      description: {
        value: description.trim(),
        chat: "",
      },
      source: sourceData("5", SOURCE),
      activation: {
        type: "action",
        condition: "",
        value: 1,
      },
      duration: {
        value: "1",
        units: "minute",
      },
      target: {
        affects: {
          type: "creature",
          count: "1",
          choice: false,
          special: "Существо с кровью, которое вы видите",
        },
        template: {
          count: "",
          contiguous: false,
          type: "",
          size: "",
          width: "",
          height: "",
          units: "",
        },
      },
      range: {
        value: 30,
        units: "ft",
        special: "",
      },
      uses: {
        max: "",
        spent: 0,
        recovery: [],
      },
      level,
      school: "enc",
      materials: {
        value: "Капля крови",
        consumed: false,
        cost: 0,
        supply: 0,
      },
      preparation: {
        mode: "prepared",
        prepared: true,
      },
      properties: ["vocal", "somatic", "material", "concentration"],
      activities: spellActivities,
      identifier: key,
    },
  });
}

export const bloodMageSpellDocuments = [
  bloodMageSpell({
    key: "blood-transfer-spell",
    name: "Подчинение крови / Перенос крови",
    img: BLOOD_TRANSFER_ART,
    level: 3,
    spellActivities: activities(
      utilityActivity({
        key: "blood-transfer-start-turn",
        name: "Урон в начале хода цели",
        activation: "special",
        targetType: "creature",
        targetCount: "1",
        rollFormula: "1d6",
        rollName: "Некротический урон",
        rollVisible: true,
        spellSlot: false,
      }),
      utilityActivity({
        key: "blood-transfer-end",
        name: "Урон при сопротивлении или окончании",
        activation: "special",
        targetType: "creature",
        targetCount: "1",
        rollFormula: "3d6",
        rollName: "Некротический урон",
        rollVisible: true,
        spellSlot: false,
      })
    ),
    description: `
<p>Выберите существо с кровью, которое видите в пределах 30 футов. Цель совершает спасбросок Телосложения. При провале цель становится схваченной и недееспособной, пока ее кровь восстает против нее.</p>
<p>В начале каждого своего хода цель получает 1к6 некротического урона. В конце каждого своего хода она повторяет спасбросок Телосложения, оканчивая эффект при успехе.</p>
<p>Если цель преуспевает в начальном спасброске или эффект на ней заканчивается, она получает 3к6 некротического урона.</p>
<p><strong>На больших уровнях.</strong> Когда вы накладываете это заклинание ячейкой 4-го уровня или выше, вы можете выбрать одну дополнительную цель за каждый уровень ячейки выше 3-го. Все цели должны находиться в пределах 30 футов друг от друга.</p>
`,
  }),
  bloodMageSpell({
    key: "blood-thrall-spell",
    name: "Кровный трэлл",
    img: BLOOD_THRALL_ART,
    level: 5,
    spellActivities: utilityActivity({
      key: "blood-thrall-end",
      name: "Урон при сопротивлении или окончании",
      activation: "special",
      targetType: "creature",
      targetCount: "1",
      rollFormula: "3d6",
      rollName: "Некротический урон",
      rollVisible: true,
      spellSlot: false,
    }),
    description: `
<p>Выберите существо с кровью, которое видите в пределах 30 футов. Цель совершает спасбросок Телосложения. При провале ее воля частично подчиняется вам.</p>
<p>Пока длится заклинание, цель должна тратить свой ход на попытку атаковать ближайшее к ней существо, враждебное вам, и не может атаковать вас или ваших союзников, либо сознательно подвергать вас опасности.</p>
<p>В конце каждого своего хода цель повторяет спасбросок Телосложения, оканчивая эффект при успехе. Если цель преуспевает в начальном спасброске или эффект на ней заканчивается, она получает 3к6 некротического урона.</p>
`,
  }),
];
