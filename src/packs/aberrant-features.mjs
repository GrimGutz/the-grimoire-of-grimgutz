import { activeEffect, feature, folder, idFor, utilityActivity } from "../common.mjs";

const SOURCE = "Престиж-класс: Абберант; перевод Айвендил, 16.06.2018";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:aberrant-features");
const TRAIT_FOLDER = idFor("folder:aberrant-unnatural-traits");

export const aberrantFolders = [
  folder({ key: "aberrant-features", name: "Абберант: классовые особенности", sort: 1500000 }),
  folder({ key: "aberrant-unnatural-traits", name: "Абберант: неестественные черты", sort: 1600000 })
];

function aberrantFeature(options) {
  return feature({
    ...options,
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      aberrantFeature: true,
      ...(options.automation ?? {})
    }
  });
}

const unnaturalTraits = [
  aberrantFeature({
    key: "aberrant-claws",
    name: "Неестественная черта: Когти",
    img: "icons/creatures/claws/claw-talons-glowing-orange.webp",
    requirements: "Абберант; с разрешения Мастера",
    folder: TRAIT_FOLDER,
    automation: { unnaturalTrait: true },
    activities: utilityActivity({
      key: "aberrant-claws-damage",
      name: "Урон когтями",
      activation: "special",
      rollFormula: "1d6 + @abilities.str.mod",
      rollName: "Режущий урон когтями",
      rollVisible: true
    }),
    description: `<p>Ваши когти являются природным оружием. Безоружный удар когтями наносит 1к6 + модификатор Силы режущего урона.</p><hr><p><strong>Автоматизация Foundry:</strong> активность бросает урон когтей; бросок атаки выполняется как обычная безоружная атака.</p>`
  }),
  aberrantFeature({
    key: "aberrant-fangs",
    name: "Неестественная черта: Клыки",
    img: "icons/creatures/abilities/fangs-teeth-bite.webp",
    requirements: "Абберант; с разрешения Мастера",
    folder: TRAIT_FOLDER,
    automation: { unnaturalTrait: true },
    activities: utilityActivity({
      key: "aberrant-fangs-damage",
      name: "Урон укусом",
      activation: "special",
      rollFormula: "1d6 + @abilities.str.mod",
      rollName: "Колющий урон укуса",
      rollVisible: true
    }),
    description: `<p>Вы получаете атаку укусом, наносящую 1к6 + модификатор Силы колющего урона.</p><hr><p><strong>Автоматизация Foundry:</strong> активность бросает урон укуса; бросок атаки выполняется отдельно.</p>`
  }),
  aberrantFeature({
    key: "aberrant-burned-veins",
    name: "Неестественная черта: Сгоревшие вены",
    img: "icons/magic/acid/dissolve-bone-skull.webp",
    requirements: "Абберант; с разрешения Мастера",
    folder: TRAIT_FOLDER,
    automation: { unnaturalTrait: true },
    effects: [activeEffect({
      key: "aberrant-burned-veins",
      name: "Сгоревшие вены",
      img: "icons/magic/acid/dissolve-bone-skull.webp",
      changes: [{ key: "system.traits.dr.value", type: "custom", value: "acid", priority: 20 }]
    })],
    description: `<p>Вы получаете сопротивление урону кислотой.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект добавляет сопротивление кислоте.</p>`
  }),
  aberrantFeature({
    key: "aberrant-cat-eyes",
    name: "Неестественная черта: Кошачьи глаза",
    img: `${WOW}/Abilities/BloodyEye.png`,
    requirements: "Абберант; с разрешения Мастера",
    folder: TRAIT_FOLDER,
    automation: { unnaturalTrait: true },
    effects: [activeEffect({
      key: "aberrant-cat-eyes",
      name: "Кошачьи глаза",
      img: `${WOW}/Abilities/BloodyEye.png`,
      changes: [{ key: "system.attributes.senses.ranges.darkvision", type: "add", value: "30", priority: 20 }]
    })],
    description: `<p>Вы получаете тёмное зрение 30 футов либо увеличиваете существующее на 30 футов.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект добавляет 30 футов тёмного зрения.</p>`
  }),
  aberrantFeature({
    key: "aberrant-scent",
    name: "Неестественная черта: Чутьё",
    img: `${WOW}/Abilities/SkinTeeth.png`,
    requirements: "Абберант; с разрешения Мастера",
    folder: TRAIT_FOLDER,
    automation: { unnaturalTrait: true },
    description: `<p>Вы совершаете с преимуществом проверки Восприятия, основанные на обонянии.</p><hr><p><strong>Автоматизация Foundry:</strong> преимущество выбирается вручную, когда проверка действительно полагается на нюх.</p>`
  }),
  aberrantFeature({
    key: "aberrant-albino",
    name: "Неестественная черта: Альбинос",
    img: `${WOW}/Characters%20and%20Creatures/undead.png`,
    requirements: "Абберант; с разрешения Мастера",
    folder: TRAIT_FOLDER,
    automation: { unnaturalTrait: true },
    effects: [activeEffect({
      key: "aberrant-albino",
      name: "Альбинос",
      img: `${WOW}/Characters%20and%20Creatures/undead.png`,
      changes: [{ key: "system.skills.itm.roll.mode", type: "upgrade", value: "1", priority: 20 }]
    })],
    description: `<p>Вы совершаете с преимуществом проверки Запугивания.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект включает преимущество на Запугивание.</p>`
  })
];

export const aberrantDocuments = [
  aberrantFeature({
    key: "deadly-precision",
    name: "Смертельная точность",
    img: "icons/skills/ranged/target-bullseye-arrow-blue.webp",
    level: 1,
    requirements: "Абберант 1",
    folder: MAIN_FOLDER,
    uses: {
      max: "@classes.aberrant.levels + @abilities.con.mod",
      spent: 0,
      recovery: [{ period: "sr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "deadly-precision",
      name: "Подготовить Смертельную точность",
      action: "arm-deadly-precision",
      activation: "bonus",
      consumeItemUse: true
    }),
    description: `<p>Бонусным действием добавьте кость Смертельной точности к следующему броску атаки оружием, которым владеете, если оно не имеет свойства «тяжёлое». Кость равна к4/к6/к8/к10/к12 на уровнях Абберанта 1–5.</p><p>Число применений равно уровню Абберанта + модификатор Телосложения; все применения восстанавливаются после короткого отдыха.</p><hr><p><strong>Автоматизация Foundry:</strong> активность расходует применение и подготавливает бонус к следующей подходящей атаке. Модуль добавляет кость нужного размера и снимает подготовку.</p>`
  }),
  aberrantFeature({
    key: "monster-reflexes",
    name: "Рефлексы чудовища",
    img: "icons/skills/movement/feet-winged-boots-blue.webp",
    level: 1,
    requirements: "Абберант 1",
    folder: MAIN_FOLDER,
    effects: [activeEffect({
      key: "monster-reflexes",
      name: "Рефлексы чудовища",
      img: "icons/skills/movement/feet-winged-boots-blue.webp",
      changes: [{ key: "system.attributes.movement.walk", type: "add", value: "@scale.aberrant.monster-reflexes", priority: 20 }]
    })],
    description: `<p>Скорость увеличивается на 5/10/10/15/15 футов на уровнях Абберанта 1–5. Немагическая сложнопроходимая местность больше не замедляет вас.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект добавляет масштабируемый бонус к скорости ходьбы. Игнорирование немагической сложнопроходимой местности учитывается вручную.</p>`
  }),
  aberrantFeature({
    key: "arcane-sense",
    name: "Чувство арканы",
    img: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
    level: 2,
    requirements: "Абберант 2",
    folder: MAIN_FOLDER,
    description: `<p>Вы изучаете заклинания Обнаружение магии и Опознание и можете накладывать их без материальных компонентов.</p><hr><p><strong>Автоматизация Foundry:</strong> заклинания выдаются через Advancement. Материальные компоненты этих применений игнорируются по описанию особенности.</p>`
  }),
  aberrantFeature({
    key: "toxic-blood",
    name: "Токсичная кровь",
    img: "icons/magic/acid/dissolve-bone-ribs-skull.webp",
    level: 2,
    requirements: "Абберант 2",
    folder: MAIN_FOLDER,
    effects: [activeEffect({
      key: "toxic-blood",
      name: "Токсичная кровь",
      img: "icons/magic/acid/dissolve-bone-ribs-skull.webp",
      changes: [
        { key: "system.traits.dr.value", type: "custom", value: "poison", priority: 20 },
        { key: "system.traits.ci.value", type: "custom", value: "poisoned", priority: 20 }
      ]
    })],
    description: `<p>Вы невосприимчивы к состоянию отравления, получаете сопротивление урону ядом и иммунитет к немагическим болезням.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект добавляет сопротивление яду и иммунитет к отравлению. Иммунитет применяется вручную только против немагических болезней.</p>`
  }),
  aberrantFeature({
    key: "vigorous-nature",
    name: "Энергичная природа",
    img: "icons/magic/life/heart-cross-strong-flame-green.webp",
    level: 3,
    requirements: "Абберант 3",
    folder: MAIN_FOLDER,
    uses: {
      max: "max(1, @abilities.con.mod)",
      spent: 0,
      recovery: [{ period: "sr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "vigorous-nature",
      name: "Получить временные хиты",
      action: "vigorous-nature",
      activation: "bonus",
      consumeItemUse: true
    }),
    description: `<p>Бонусным действием получите временные хиты: 1к8 + модификатор Телосложения; кость становится к10 на 4-м уровне и к12 на 5-м.</p><p>Число применений равно модификатору Телосложения, минимум одно; применения восстанавливаются после короткого отдыха.</p><hr><p><strong>Автоматизация Foundry:</strong> активность расходует применение, бросает правильную кость и устанавливает временные хиты, не уменьшая уже имеющееся значение.</p>`
  }),
  aberrantFeature({
    key: "final-changes",
    name: "Финальные изменения",
    img: "icons/magic/control/silhouette-grow-shrink-tan.webp",
    level: 5,
    requirements: "Абберант 5",
    folder: MAIN_FOLDER,
    description: `<p>Выберите Силу или Ловкость. Выбранная характеристика увеличивается на 2, максимум до 22. Кроме того, вы получаете слепое зрение 30 футов.</p><hr><p><strong>Автоматизация Foundry:</strong> Advancement предлагает вариант Силы или Ловкости; переносимый эффект выбранной карточки добавляет +2 и слепое зрение.</p>`
  }),
  aberrantFeature({
    key: "final-changes-strength",
    name: "Финальные изменения: Сила",
    img: "icons/magic/control/buff-strength-muscle-damage-orange.webp",
    level: 5,
    requirements: "Абберант 5; Финальные изменения",
    folder: MAIN_FOLDER,
    effects: [activeEffect({
      key: "final-changes-strength",
      name: "Финальные изменения: Сила",
      img: "icons/magic/control/buff-strength-muscle-damage-orange.webp",
      changes: [
        { key: "system.abilities.str.value", type: "add", value: "2", priority: 20 },
        { key: "system.attributes.senses.ranges.blindsight", type: "upgrade", value: "30", priority: 20 }
      ]
    })],
    description: `<p>Сила увеличивается на 2, максимум до 22, и вы получаете слепое зрение 30 футов.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект добавляет Силу и слепое зрение. Если итог превышает 22, ограничьте значение вручную.</p>`
  }),
  aberrantFeature({
    key: "final-changes-dexterity",
    name: "Финальные изменения: Ловкость",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    level: 5,
    requirements: "Абберант 5; Финальные изменения",
    folder: MAIN_FOLDER,
    effects: [activeEffect({
      key: "final-changes-dexterity",
      name: "Финальные изменения: Ловкость",
      img: "icons/skills/movement/arrow-upward-yellow.webp",
      changes: [
        { key: "system.abilities.dex.value", type: "add", value: "2", priority: 20 },
        { key: "system.attributes.senses.ranges.blindsight", type: "upgrade", value: "30", priority: 20 }
      ]
    })],
    description: `<p>Ловкость увеличивается на 2, максимум до 22, и вы получаете слепое зрение 30 футов.</p><hr><p><strong>Автоматизация Foundry:</strong> переносимый эффект добавляет Ловкость и слепое зрение. Если итог превышает 22, ограничьте значение вручную.</p>`
  }),
  aberrantFeature({
    key: "unnatural-traits",
    name: "Вариант: Неестественные черты",
    img: `${WOW}/Spells/PsychicHorrors.png`,
    requirements: "Абберант; с разрешения Мастера",
    folder: MAIN_FOLDER,
    description: `<p>Во время ритуала вы могли приобрести одну или несколько неестественных черт по усмотрению Мастера: Когти, Клыки, Сгоревшие вены, Кошачьи глаза, Чутьё или Альбинос.</p><hr><p><strong>Автоматизация Foundry:</strong> варианты находятся отдельными карточками в папке неестественных черт. Мастер выдаёт разрешённое количество вручную.</p>`
  }),
  ...unnaturalTraits
];
