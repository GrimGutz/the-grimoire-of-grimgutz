import {
  MODULE_ID,
  baseDocument,
  itemGrant,
  sourceData,
  uuidFor
} from "../common.mjs";

const SOURCE = "Престиж-класс: Сосуд Духа; предоставленный PDF PK-_Sosud_Dukha (2).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function description({ name, summary, feature, featureLabel }) {
  return `
    <h1>Сосуд Духа: ${name}</h1>
    <p>${summary}</p>
    <p>Подробные правила духа находятся в карточке ${featureLink(feature, featureLabel)}.</p>
    <p><strong>Автоматизация Foundry:</strong> это стандартный подкласс dnd5e, привязанный к классу <strong>spirit-vessel</strong> через <code>system.classIdentifier</code>. Advancement подкласса выдаёт feature-карточку духа на 1-м уровне, а runtime применяет пассивные эффекты этой карточки по уровню Сосуда Духа.</p>
  `;
}

function spiritSubclass({
  key,
  name,
  spirit,
  img,
  feature,
  featureLabel,
  summary
}) {
  return baseDocument({
    key,
    name,
    type: "subclass",
    img,
    flags: {
      [MODULE_ID]: {
        spiritVesselSubclass: spirit
      }
    },
    system: {
      description: {
        value: description({ name, summary, feature, featureLabel }),
        chat: ""
      },
      source: sourceData("2–4", SOURCE),
      identifier: key,
      classIdentifier: "spirit-vessel",
      advancement: [
        itemGrant({
          key: `${key}-level-1-feature`,
          level: 1,
          items: [feature],
          title: "Особенности духа"
        })
      ],
      spellcasting: {
        progression: "none",
        ability: "",
        preparation: {}
      }
    }
  });
}

export const spiritVesselSubclassDocuments = [
  spiritSubclass({
    key: "spirit-vessel-aberration",
    name: "Абберация",
    spirit: "aberration",
    img: `${WOW}/Abilities/StudentOfTheMind.png`,
    feature: "spirit-aberration",
    featureLabel: "Дух: Абберация",
    summary: "Внутри вас обитает чуждый разум. Он даёт телепатию, скрытое очарование и защиту от психического давления."
  }),
  spiritSubclass({
    key: "spirit-vessel-celestial",
    name: "Небожитель / Celestial",
    spirit: "celestial",
    img: `${WOW}/Spells/GuardianSpirit.png`,
    feature: "spirit-celestial",
    featureLabel: "Дух: Небожитель",
    summary: "Небесный дух даёт крылья, темновидение, сияющую защиту и божественную стойкость против страха и чар."
  }),
  spiritSubclass({
    key: "spirit-vessel-elemental-earth",
    name: "Элементаль: Земля",
    spirit: "elemental-earth",
    img: `${WOW}/Spells/EarthElemental_Totem.png`,
    feature: "spirit-elemental-earth",
    featureLabel: "Дух: Элементаль Земли",
    summary: "Дух земли укрепляет тело, открывает путь сквозь грунт и защищает от дробящих ударов и окаменения."
  }),
  spiritSubclass({
    key: "spirit-vessel-elemental-air",
    name: "Элементаль: Воздух",
    spirit: "elemental-air",
    img: `${WOW}/Miscellaneous/Primal_Air.png`,
    feature: "spirit-elemental-air",
    featureLabel: "Дух: Элементаль Воздуха",
    summary: "Дух воздуха поднимает вас в полёт и защищает от колющих ударов и холода."
  }),
  spiritSubclass({
    key: "spirit-vessel-elemental-fire",
    name: "Элементаль: Огонь",
    spirit: "elemental-fire",
    img: `${WOW}/Miscellaneous/Primal_Fire.png`,
    feature: "spirit-elemental-fire",
    featureLabel: "Дух: Элементаль Огня",
    summary: "Дух огня ускоряет вас и насыщает тело сопротивлением огню и молнии."
  }),
  spiritSubclass({
    key: "spirit-vessel-elemental-water",
    name: "Элементаль: Вода",
    spirit: "elemental-water",
    img: `${WOW}/Spells/SummonWaterElemental.png`,
    feature: "spirit-elemental-water",
    featureLabel: "Дух: Элементаль Воды",
    summary: "Дух воды ведёт ваши движения, даёт плавание и защищает от режущего и кислотного урона."
  }),
  spiritSubclass({
    key: "spirit-vessel-fey",
    name: "Фея",
    spirit: "fey",
    img: `${WOW}/Spells/FeralSpirit.png`,
    feature: "spirit-fey",
    featureLabel: "Дух: Фея",
    summary: "Фейский дух говорит через Грёзу, помогает очаровывать существ и защищает от силового урона, яда и чар."
  }),
  spiritSubclass({
    key: "spirit-vessel-fiend",
    name: "Исчадие",
    spirit: "fiend",
    img: `${WOW}/Spells/Shadowfiend.png`,
    feature: "spirit-fiend",
    featureLabel: "Дух: Исчадие",
    summary: "Дух нижних планов учит пламени, окружает тело огнём и в итоге делает вас невосприимчивым к огню."
  }),
  spiritSubclass({
    key: "spirit-vessel-undead",
    name: "Нежить",
    spirit: "undead",
    img: `${WOW}/Spells/SenseUndead.png`,
    feature: "spirit-undead",
    featureLabel: "Дух: Нежить",
    summary: "Мёртвый дух замедляет старение, открывает взгляд на Эфирный план, пугает врагов и защищает от яда."
  })
];
