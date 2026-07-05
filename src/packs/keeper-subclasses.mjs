import {
  MODULE_ID,
  baseDocument,
  itemGrant,
  sourceData,
  uuidFor
} from "../common.mjs";

const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const SOURCE = "Престиж-класс: Хранитель; предоставленный PDF PK_Keeper (2).pdf";

function featureLink(identifier, label) {
  return `@UUID[${uuidFor("features", identifier)}]{${label}}`;
}

function description({
  title,
  summary,
  requirements,
  feature,
  featureLabel
}) {
  return `
    <h1>Хранитель: ${title}</h1>
    <p>${summary}</p>
    <h2>Требования специализации</h2>
    <p>${requirements}</p>
    <h2>Особенности специализации</h2>
    <p>Подробные правила специализации находятся в карточке ${featureLink(feature, featureLabel)}. Эта карточка содержит особенности союзника и улучшения на 1-м, 2-м, 3-м и 5-м уровнях Хранителя.</p>
    <p><strong>Автоматизация Foundry:</strong> это стандартный подкласс dnd5e, привязанный к классу <strong>keeper</strong> через <code>system.classIdentifier</code>. При выборе подкласса модуль проверяет требования специализации по навыкам/инструментам, а Advancement подкласса выдаёт соответствующую карточку особенности специализации.</p>
  `;
}

function keeperSubclass({
  key,
  name,
  img,
  specializationKey,
  feature,
  featureLabel,
  summary,
  requirements
}) {
  return baseDocument({
    key,
    name,
    type: "subclass",
    img,
    flags: {
      [MODULE_ID]: {
        keeperSubclass: specializationKey,
        keeperSpecialization: specializationKey
      }
    },
    system: {
      description: {
        value: description({
          title: name,
          summary,
          requirements,
          feature,
          featureLabel
        }),
        chat: ""
      },
      source: sourceData("1–10", SOURCE),
      identifier: key,
      classIdentifier: "keeper",
      advancement: [
        itemGrant({
          key: `${key}-level-1-feature`,
          level: 1,
          items: [feature],
          title: "Особенность специализации"
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

export const keeperSubclassDocuments = [
  keeperSubclass({
    key: "keeper-golem-maker",
    name: "Создатель големов",
    img: `${WOW}/Abilities/GolemThunderClap.png`,
    specializationKey: "golem",
    feature: "golem-maker",
    featureLabel: "Специализация: Создатель големов",
    requirements: "Владение минимум двумя из списка: Магия, Расследование, Медицина, Религия, алхимические принадлежности или инструменты ремонтника.",
    summary: "Создатели големов создают и контролируют неестественных союзников: конструктов, элементалей, слизей или нежить."
  }),
  keeperSubclass({
    key: "keeper-myth-seeker",
    name: "Искатель мифов",
    img: `${WOW}/Spells/ArcaneIntellect.png`,
    specializationKey: "myth",
    feature: "myth-seeker-keeper",
    featureLabel: "Специализация: Искатель мифов",
    requirements: "Владение минимум двумя из списка: Обращение с животными, Магия, Обман, Религия, набор фальсификатора или любой игровой набор.",
    summary: "Искатели мифов заключают связь с легендарными, небесными, драконьими, фейскими, инфернальными или иными мифическими союзниками."
  }),
  keeperSubclass({
    key: "keeper-spirit-medium",
    name: "Духовный медиум",
    img: `${WOW}/Spells/SpiritLink.png`,
    specializationKey: "spirit",
    feature: "spirit-medium-keeper",
    featureLabel: "Специализация: Духовный медиум",
    requirements: "Владение минимум двумя из списка: Магия, Обман, История, Проницательность, Религия или любой музыкальный инструмент.",
    summary: "Духовные медиумы связывают себя с призраками, фамильярами или иными духами, которые действуют как их союзники."
  }),
  keeperSubclass({
    key: "keeper-wild-tamer",
    name: "Дикий укротитель",
    img: `${WOW}/Abilities/BeastMastery.png`,
    specializationKey: "wild",
    feature: "wild-tamer-keeper",
    featureLabel: "Специализация: Дикий укротитель",
    requirements: "Владение минимум двумя из списка: Обращение с животными, Проницательность, Природа, Выживание, набор травника или любой музыкальный инструмент.",
    summary: "Дикие укротители заслуживают послушание зверей, драконов, монстров, растений или других существ природного происхождения."
  })
];
