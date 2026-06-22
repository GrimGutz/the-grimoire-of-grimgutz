import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const MAIN_FOLDER = idFor("folder:class-features");
const STYLE_FOLDER = idFor("folder:weapon-styles");
const TECHNIQUE_FOLDER = idFor("folder:crusher-techniques");

export const folders = [
  folder({ key: "class-features", name: "Классовые особенности", sort: 100000 }),
  folder({ key: "weapon-styles", name: "Стили огромного оружия", sort: 200000 }),
  folder({ key: "crusher-techniques", name: "Техники Сокрушителя", sort: 300000 })
];

export const documents = [
  feature({
    key: "great-weapon-style",
    name: "Стиль огромного оружия",
    img: "icons/skills/melee/strike-sword-steel-yellow.webp",
    level: 1,
    requirements: "Сокрушитель 1",
    folder: MAIN_FOLDER,
    description: `
      <p>Вы учитесь использовать массивное оружие и получаете владение им.</p>
      <p>Выберите один стиль: <strong>Раскалывание</strong> или <strong>Сокрушение</strong>. Менеджер развития предложит этот выбор отдельно.</p>
      <p><strong>Примечание для Foundry.</strong> «Массивное оружие» является нестандартным владением и не представлено отдельной категорией в D&D5e. При необходимости отметьте владение вручную на листе персонажа.</p>
    `
  }),
  feature({
    key: "cleaving",
    name: "Раскалывание",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    level: 1,
    requirements: "Сокрушитель 1; Стиль огромного оружия",
    folder: STYLE_FOLDER,
    description: `
      <p>Вы пытаетесь расколоть врага надвое, используя вес оружия для нанесения крайне тяжёлых ударов.</p>
      <p>При использовании черты <strong>Мастер большого оружия</strong> атаки массивным оружием наносят один дополнительный кубик урона оружия. Например, цвайхандер вместо 2к8 наносит 3к8.</p>
      <p>На 5-м уровне Сокрушителя вы получаете ещё один дополнительный кубик урона.</p>
      <p><strong>Автоматизация:</strong> дополнительные кости необходимо добавлять к броску урона вручную.</p>
    `
  }),
  feature({
    key: "crushing",
    name: "Сокрушение",
    img: "icons/skills/melee/strike-hammer-destructive-blue.webp",
    level: 1,
    requirements: "Сокрушитель 1; Стиль огромного оружия",
    folder: STYLE_FOLDER,
    description: `
      <p>Вы используете вес и размер оружия, чтобы сокрушить врага.</p>
      <p>Если на кости урона массивного оружия выпало максимальное значение, бросьте ещё одну такую кость и добавьте результат к урону атаки.</p>
      <p>На 5-м уровне Сокрушителя, если на дополнительной кости снова выпало максимальное значение, вы можете бросить ещё одну кость.</p>
      <p><strong>Автоматизация:</strong> дополнительные кости необходимо бросать вручную.</p>
    `
  }),
  feature({
    key: "giant-killer",
    name: "Убийца гигантов",
    img: "icons/skills/melee/strike-axe-energy-pink.webp",
    level: 1,
    requirements: "Сокрушитель 1",
    folder: MAIN_FOLDER,
    description: `
      <p>Чем больше враг, тем сокрушительнее его падение.</p>
      <p>Когда вы попадаете по существу массивным оружием, атака наносит 1 дополнительную единицу урона за каждую категорию размера, на которую цель больше вас.</p>
      <p>Например, персонаж Среднего размера наносит Огромному существу 2 единицы дополнительного урона.</p>
    `
  }),
  feature({
    key: "crusher-techniques",
    name: "Техники Сокрушителя",
    img: "icons/skills/melee/sword-damaged-broken-orange.webp",
    level: 2,
    requirements: "Сокрушитель 2",
    folder: MAIN_FOLDER,
    description: `
      <p>Вы изучаете одну технику Сокрушителя на 2-м уровне, ещё одну на 3-м уровне и третью на 5-м уровне.</p>
      <p>Вы должны соответствовать требованиям выбранной техники. Менеджер развития Foundry предложит выбор на соответствующих уровнях, но требования, связанные со стилем оружия, должен проверить игрок или Мастер.</p>
    `
  }),
  feature({
    key: "momentum",
    name: "Импульс",
    img: "icons/skills/melee/strike-hammer-destructive-orange.webp",
    level: 3,
    requirements: "Сокрушитель 3",
    folder: MAIN_FOLDER,
    description: `
      <p>Вы используете вес массивного оружия и гравитацию для усиления удара.</p>
      <p>Для всех атак массивным оружием модификатор Силы к урону увеличивается наполовину с округлением вверх. Например, модификатор +4 становится +6.</p>
      <p><strong>Автоматизация:</strong> добавляйте дополнительную половину модификатора Силы к урону вручную.</p>
    `
  }),
  feature({
    key: "steel-will",
    name: "Стальная воля",
    img: "icons/equipment/shield/heater-steel-boss-red.webp",
    level: 4,
    requirements: "Сокрушитель 4",
    folder: MAIN_FOLDER,
    uses: {
      max: "1",
      spent: 0,
      recovery: [
        {
          period: "sr",
          type: "recoverAll"
        },
        {
          period: "lr",
          type: "recoverAll"
        }
      ]
    },
    activities: utilityActivity({
      key: "steel-will",
      activation: "special",
      condition: "Когда требуется спасбросок Ловкости и вы можете активно использовать массивное оружие",
      consumeItemUse: true
    }),
    description: `
      <p>Пока вы можете активно использовать массивное оружие, когда от вас требуется спасбросок Ловкости, вы можете заменить его спасброском Силы.</p>
      <p>После использования этой способности вы не можете использовать её повторно до завершения короткого или продолжительного отдыха.</p>
    `
  }),
  feature({
    key: "steel-giant",
    name: "Стальной гигант",
    img: "icons/skills/melee/hand-grip-sword-orange.webp",
    level: 5,
    requirements: "Сокрушитель 5",
    folder: MAIN_FOLDER,
    description: `
      <p>Ваша Сила увеличивается на 4, максимум до 24. Это увеличение применяется отдельным этапом развития класса.</p>
      <p>Если вы настраиваетесь на магический предмет, устанавливающий Силу на определённое значение, это значение становится на 1 пункт выше обычного.</p>
      <p><strong>Автоматизация:</strong> повышение Силы автоматизировано. Улучшение эффекта магических предметов необходимо учитывать вручную.</p>
    `
  }),
  feature({
    key: "adaptability",
    name: "Адаптивность",
    img: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
    requirements: "Техника Сокрушителя",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Вы можете использовать как Раскалывание, так и Сокрушение.</p>
      <p>Совершая атаку, но до броска, объявите, какой стиль используете для этой атаки.</p>
    `
  }),
  feature({
    key: "superior-control",
    name: "Превосходный контроль",
    img: "icons/skills/melee/sword-stuck-glowing-pink.webp",
    level: 5,
    requirements: "Сокрушитель 5",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Когда вы атакуете массивным оружием, добавьте модификатор Телосложения к урону.</p>
      <p><strong>Автоматизация:</strong> модификатор необходимо добавлять вручную.</p>
    `
  }),
  feature({
    key: "powerful-crushing",
    name: "Мощное сокрушение",
    img: "icons/skills/melee/hand-grip-hammer-spiked-blue.webp",
    requirements: "Стиль огромного оружия: Сокрушение",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Когда вы наносите критический удар, используя Сокрушение, добавьте к урону один дополнительный кубик урона оружия.</p>
    `
  }),
  feature({
    key: "powerful-cleaving",
    name: "Мощное раскалывание",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    requirements: "Стиль огромного оружия: Раскалывание",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Когда вы наносите критический удар, используя Раскалывание, можете перебросить любые кости урона и использовать лучший из двух результатов.</p>
    `
  }),
  feature({
    key: "indestructibility",
    name: "Несокрушимость",
    img: "icons/magic/defensive/shield-barrier-flaming-diamond-blue.webp",
    level: 3,
    requirements: "Сокрушитель 3",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Когда вы используете Стальную волю для спасброска, позволяющего получить половину урона, вы не получаете урона при успехе и получаете половину урона при провале.</p>
    `
  }),
  feature({
    key: "smithing",
    name: "Кузнечное ремесло",
    img: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
    requirements: "Техника Сокрушителя",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Вы можете уменьшить вес своего массивного оружия на 5 фунтов.</p>
      <p>Модификации и улучшения оружия во время простоя занимают вдвое меньше времени.</p>
    `
  }),
  feature({
    key: "giant-crushing",
    name: "Сокрушение гигантов",
    img: "icons/skills/melee/strike-axe-blood-red.webp",
    requirements: "Техника Сокрушителя; Убийца гигантов",
    folder: TECHNIQUE_FOLDER,
    description: `
      <p>Когда вы наносите критический удар существу, на которое действует Убийца гигантов, добавьте к урону утроенный модификатор Силы.</p>
    `
  })
];
