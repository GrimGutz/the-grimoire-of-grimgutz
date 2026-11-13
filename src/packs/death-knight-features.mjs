import { activeEffect, feature, folder, idFor, utilityActivity } from "../common.mjs";

const SOURCE = "Престиж-класс: Рыцарь смерти; перевод Айвендил, 21.03.2018";
const MAIN_FOLDER = idFor("folder:death-knight-features");

export const deathKnightFolders = [
  folder({ key: "death-knight-features", name: "Рыцарь смерти: классовые особенности", sort: 800000 })
];

function description(body, automation) {
  return `
    ${body}
    <hr>
    <p><strong>Автоматизация Foundry:</strong> ${automation}</p>
  `;
}

function deathKnightFeature(options) {
  return feature({
    ...options,
    folder: MAIN_FOLDER,
    sourcePage: "1",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      deathKnightFeature: true,
      ...(options.automation ?? {})
    }
  });
}

export const deathKnightDocuments = [
  deathKnightFeature({
    key: "mystical-power",
    name: "Мистическая сила",
    img: "icons/magic/unholy/strike-body-life-soul-purple.webp",
    level: 1,
    requirements: "Рыцарь смерти 1",
    description: description(`
      <p>Для определения количества и уровня ячеек заклинаний, количества подготавливаемых заклинаний и запаса «Наложения рук» каждый уровень Рыцаря смерти считается уровнем Паладина.</p>
      <p>Других способностей Паладина эти уровни не предоставляют.</p>
    `, "модуль объединяет уровни Паладина и Рыцаря смерти при расчёте ячеек, формулы подготовки заклинаний и максимума «Наложения рук». Рыцарь смерти не отображается как отдельный заклинательный класс.")
  }),
  deathKnightFeature({
    key: "undead-nature",
    name: "Нежить",
    img: "icons/magic/death/skull-humanoid-crown-white-blue.webp",
    level: 1,
    requirements: "Рыцарь смерти 1",
    effects: [
      activeEffect({
        key: "death-knight-undead-nature",
        name: "Рыцарь смерти: Нежить",
        img: "icons/magic/death/skull-humanoid-crown-white-blue.webp",
        changes: [
          { key: "system.details.type.value", type: "override", value: "undead", priority: 100 },
          { key: "system.attributes.senses.ranges.darkvision", type: "upgrade", value: "120", priority: 20 },
          { key: "system.traits.di.value", type: "custom", value: "poison", priority: 20 },
          { key: "system.traits.ci.value", type: "custom", value: "poisoned", priority: 20 },
          { key: "system.traits.ci.value", type: "custom", value: "diseased", priority: 20 }
        ]
      })
    ],
    description: description(`
      <p>Ваш тип существа становится <strong>нежитью</strong>. Вы не нуждаетесь в еде, воде и воздухе и вместо сна можете 8 часов заниматься лёгкой деятельностью.</p>
      <p>Вы получаете иммунитет к яду и болезням, а также темновидение 120 футов.</p>
      <p>Заклинания и зелья лечения больше не восстанавливают вам хиты. Собственное «Наложение рук» продолжает действовать.</p>
    `, "переносимый эффект устанавливает тип «нежить», темновидение 120 футов и иммунитеты к урону ядом, отравлению и болезням. При использовании Midi-QOL лечение от заклинаний и лечебных зелий для Рыцаря смерти обнуляется; собственное «Наложение рук» разрешено. Потребности в пище, воде, воздухе и сне учитываются повествовательно.")
  }),
  deathKnightFeature({
    key: "death-knight-magic-resistance",
    name: "Сопротивление магии",
    img: "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp",
    level: 2,
    requirements: "Рыцарь смерти 2",
    effects: [
      activeEffect({
        key: "death-knight-magic-resistance",
        name: "Рыцарь смерти: Сопротивление магии",
        img: "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp",
        changes: [
          { key: "flags.midi-qol.magicResistance.all", type: "custom", value: "true", priority: 20 }
        ]
      })
    ],
    description: description(`
      <p>Вы совершаете с преимуществом спасброски против заклинаний и других магических эффектов.</p>
    `, "при активных Midi-QOL и DAE переносимый эффект автоматически даёт преимущество на спасброски, которые Midi-QOL определяет как магические. Без Midi-QOL преимущество выбирается в диалоге броска вручную.")
  }),
  deathKnightFeature({
    key: "strong-undead",
    name: "Сильная нежить",
    img: "icons/magic/death/undead-skeleton-worn-blue.webp",
    level: 3,
    requirements: "Рыцарь смерти 3",
    effects: [
      activeEffect({
        key: "death-knight-strong-undead",
        name: "Рыцарь смерти: Сильная нежить",
        img: "icons/magic/death/undead-skeleton-worn-blue.webp",
        changes: [
          { key: "system.traits.di.value", type: "custom", value: "necrotic", priority: 20 },
          { key: "system.traits.ci.value", type: "custom", value: "exhaustion", priority: 20 },
          { key: "system.traits.ci.value", type: "custom", value: "frightened", priority: 20 }
        ]
      })
    ],
    description: description(`
      <p>Вы получаете иммунитет к некротическому урону, истощению и эффектам страха.</p>
    `, "переносимый эффект автоматически добавляет иммунитет к некротическому урону, истощению и состоянию «испуган»; активные состояния, к которым появился иммунитет, система игнорирует.")
  }),
  deathKnightFeature({
    key: "battle-undead",
    name: "Боевая нежить",
    img: "icons/magic/death/undead-skeleton-fire-green.webp",
    level: 5,
    requirements: "Рыцарь смерти 5",
    activities: utilityActivity({
      key: "battle-undead-reminder",
      name: "Применить ауру Боевой нежити",
      activation: "special",
      rangeValue: 60,
      targetType: "ally",
      targetChoice: true,
      condition: "Вы не недееспособны; цель является нежитью"
    }),
    description: description(`
      <p>Пока вы не недееспособны, вы и выбранные вами существа-нежить в пределах 60 футов имеете преимущество на спасброски против эффектов, направленных непосредственно против нежити.</p>
    `, "движок аур автоматически создаёт привязанную к токену область радиусом 60 футов и отмечает дружественную нежить внутри. Отметка снимается при выходе или недееспособности источника. Преимущество выбирается только против эффектов, направленных непосредственно против нежити: эту условную часть подтверждает Мастер, обычные спасброски преимущества не получают.")
  }),
  deathKnightFeature({
    key: "death-knight-extra-attack",
    name: "Дополнительная атака Рыцаря смерти",
    img: "icons/skills/melee/spear-tips-triple-orange.webp",
    level: 5,
    requirements: "Рыцарь смерти 5",
    description: description(`
      <p>Когда вы совершаете действие Атака в свой ход, вы можете совершить ещё одну дополнительную атаку.</p>
      <p>Эта способность складывается с «Дополнительной атакой» Паладина. Обычно Паладин 5 / Рыцарь смерти 5 совершает три атаки действием Атака.</p>
    `, "особенность добавляется на лист и явно указывает итоговое количество атак. D&D5e и Midi-QOL не формируют единое действие «Атака» из нескольких оружейных активностей, поэтому дополнительные атаки выполняются повторным использованием нужной атаки оружием.")
  })
];
