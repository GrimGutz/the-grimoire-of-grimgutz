import {
  MODULE_ID,
  activeEffect,
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Лесной владыка; Мистический гримуар Jorving, стр. 71–76";
const MAIN_FOLDER = idFor("folder:forest-lord-features");

export const forestLordFolders = [
  folder({
    key: "forest-lord-features",
    name: "Лесной владыка: классовые особенности",
    sort: 1400000
  })
];

function forestFeature(options) {
  return feature({
    ...options,
    folder: MAIN_FOLDER,
    sourcePage: options.sourcePage ?? "1–2",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      forestLordFeature: true,
      ...(options.automation ?? {})
    }
  });
}

export const forestLordDocuments = [
  forestFeature({
    key: "tree-kindred",
    name: "Древесный родич",
    img: "icons/magic/nature/tree-spirit-green.webp",
    level: 1,
    requirements: "Лесной владыка 1",
    description: `
      <p>Заклинание «Древесное лечение» всегда считается подготовленным и не учитывается в максимальном количестве подготовленных или известных заклинаний. Один раз после продолжительного отдыха вы можете наложить его без затрат ячейки.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> Advancement выдаёт отдельную карточку заклинания «Древесное лечение». Она всегда подготовлена и содержит обычное наложение ячейкой и одно бесплатное применение за продолжительный отдых.</p>
    `
  }),
  forestFeature({
    key: "nature-magic",
    name: "Магия природы",
    img: "icons/magic/nature/leaf-glow-maple-green.webp",
    level: 1,
    requirements: "Лесной владыка 1",
    activities: utilityActivity({
      key: "choose-forest-base-class",
      name: "Выбрать базовый природный класс",
      action: "choose-forest-base-class",
      activation: "special"
    }),
    description: `
      <p>Складывайте уровни Лесного владыки с уровнями базового природного класса для определения количества и уровня ячеек, а также подготовленных или известных заклинаний.</p>
      <p>Например, Следопыт 7 / Лесной владыка 4 использует ячейки и заклинания как Следопыт 11-го уровня.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> выберите Друида или Следопыта управляющей активностью. Модуль объединяет их уровни для прогрессии ячеек и формулы подготовки Друида. Количество известных заклинаний Следопыта и нестандартные природные архетипы контролируются вручную.</p>
    `
  }),
  forestFeature({
    key: "nature-sense",
    name: "Чувство природы",
    img: "icons/magic/nature/leaf-glow-triple-green.webp",
    level: 1,
    requirements: "Лесной владыка 1",
    description: `
      <p>Вы получаете владение навыком Природа. Если вы уже владели им, бонус мастерства для этого навыка удваивается.</p>
      <p>Вы всегда можете определить, являются ли найденные в дикой природе пища и вода чистыми и безопасными.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> Advancement предоставляет владение Природой. Если владение уже было получено до класса, установите для навыка компетентность; безопасность природной пищи и воды определяется без броска.</p>
    `
  }),
  forestFeature({
    key: "forest-barkskin",
    name: "Коракожа",
    img: "icons/magic/nature/armor-hide-green.webp",
    level: 2,
    requirements: "Лесной владыка 2",
    effects: [activeEffect({
      key: "forest-barkskin",
      name: "Коракожа",
      img: "icons/magic/nature/armor-hide-green.webp",
      changes: [{
        key: "system.attributes.ac.bonus",
        type: "add",
        value: "max(1, @abilities.con.mod)",
        priority: 20
      }]
    })],
    description: `
      <p>Ваша кожа становится жёсткой, короподобной шкурой. Вы получаете бонус к КД, равный модификатору Телосложения, минимум +1.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> переносимый эффект DAE добавляет к КД модификатор Телосложения с минимумом +1.</p>
    `
  }),
  forestFeature({
    key: "oak-strength",
    name: "Сила дуба",
    img: "icons/magic/nature/root-vine-entangled-humanoid.webp",
    level: 3,
    requirements: "Лесной владыка 3",
    activities: utilityActivity({
      key: "oak-strength-unarmed",
      name: "Урон кулаком Силы дуба",
      action: "forest-unarmed-damage",
      activation: "special"
    }),
    description: `
      <p>Ваша Сила увеличивается на 1, а её максимум становится равен 21.</p>
      <p>Безоружные атаки кулаками наносят 1к6 + модификатор Силы дробящего урона. На 5-м уровне Лесного владыки кость становится 1к8.</p>
      <p>Ваши волосы полностью сменяются зелёной листвой.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> фиксированное повышение Силы выдаётся через Advancement. После попадания кулаком используйте активность для броска правильной кости урона: к6 либо к8 на 5-м уровне.</p>
    `
  }),
  forestFeature({
    key: "spruce-growth",
    name: "Рост ели",
    img: "icons/magic/nature/tree-spirit-glow-black-yellow.webp",
    level: 4,
    requirements: "Лесной владыка 4",
    uses: {
      max: "2",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: utilityActivity({
      key: "spruce-growth",
      name: "Рост ели",
      activation: "action",
      consumeItemUse: true,
      targetType: "self",
      targetCount: "1"
    }),
    description: `
      <p>Дважды после продолжительного отдыха вы можете без затрат ячейки наложить на себя эффект увеличения от заклинания «Увеличение/Уменьшение».</p>
      <p>Если ваш размер становится Большим, досягаемость рукопашных атак увеличивается до 10 футов.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> карточка отслеживает два применения. Эффект увеличения, концентрация, размер и досягаемость применяются по карточке заклинания или через Midi-QOL/DAE.</p>
    `
  }),
  forestFeature({
    key: "oak-heart",
    name: "Сердце дуба",
    img: "icons/magic/nature/heart-glowing-orange.webp",
    level: 5,
    requirements: "Лесной владыка 5",
    effects: [activeEffect({
      key: "oak-heart",
      name: "Сердце дуба",
      img: "icons/magic/nature/heart-glowing-orange.webp",
      changes: [
        { key: "system.details.type.value", type: "override", value: "plant", priority: 100 },
        { key: "system.traits.dr.value", type: "custom", value: "piercing", priority: 20 },
        { key: "system.traits.dr.value", type: "custom", value: "bludgeoning", priority: 20 },
        { key: "system.traits.dr.value", type: "custom", value: "radiant", priority: 20 },
        { key: "system.traits.dr.value", type: "custom", value: "poison", priority: 20 },
        { key: "system.traits.dv.value", type: "custom", value: "fire", priority: 50 },
        { key: "system.traits.dv.value", type: "custom", value: "slashing", priority: 50 }
      ]
    })],
    description: `
      <p>Ваш тип существа изменяется на растение.</p>
      <p>Вы получаете сопротивление колющему, дробящему, излучению и яду, но уязвимость к огню и рубящему урону.</p>
      <p>Вы совершаете с преимуществом спасброски от отравления, ошеломления и паралича.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> переносимый эффект меняет тип существа, добавляет сопротивления и уязвимости. Преимущество против трёх состояний выбирается вручную при спасброске.</p>
    `
  }),
  forestFeature({
    key: "forest-might",
    name: "Лесная мощь",
    img: "icons/magic/nature/strength-muscle-green.webp",
    level: 5,
    requirements: "Лесной владыка 5",
    effects: [activeEffect({
      key: "forest-might-exhaustion",
      name: "Лесная мощь",
      img: "icons/magic/nature/strength-muscle-green.webp",
      changes: [{ key: "system.attributes.exhaustion", type: "add", value: "-2", priority: 20 }]
    })],
    description: `
      <p>Ловкость снижается на 2, Сила увеличивается на 1, а Телосложение — на 2. Максимум Силы и Телосложения становится равен 22.</p>
      <p>Вы игнорируете эффекты первой и второй степени истощения.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> изменения характеристик применяются фиксированным Advancement. Переносимый эффект уменьшает эффективную степень истощения на 2, минимум до нуля.</p>
    `
  }),
  forestFeature({
    key: "take-root",
    name: "Пустить корни",
    img: "icons/magic/nature/root-vines-face-glow-green.webp",
    level: 5,
    requirements: "Лесной владыка 5",
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: Object.assign(
      {},
      utilityActivity({
        key: "take-root",
        name: "Пустить корни",
        action: "take-root",
        activation: "action",
        consumeItemUse: true,
        condition: "Занимает полный раунд; только на земле или песке"
      }),
      utilityActivity({
        key: "withdraw-roots",
        name: "Втянуть корни",
        action: "withdraw-roots",
        activation: "action"
      })
    ),
    description: `
      <p>Один раз после продолжительного отдыха вы можете за полный раунд пустить корни в землю или песок.</p>
      <p>Пока вы укоренены, эффективная Ловкость равна 1, скорость равна 0, а в начале каждого своего хода вы восстанавливаете 5 хитов. После получения урона огнём лечение не работает до конца вашего следующего хода.</p>
      <p>Если у вас был доступ к солнечному свету, продолжительный отдых в таком положении устраняет потребность в пище. Втянуть корни можно действием.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> первая активность расходует применение и создаёт эффект укоренения, вторая снимает его. В бою модуль лечит 5 хитов в начале хода и через Midi-QOL приостанавливает лечение после огненного урона. Вне боя лечение и солнечный свет контролируются вручную.</p>
    `
  })
];
