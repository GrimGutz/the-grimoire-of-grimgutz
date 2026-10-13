import { feature, folder, idFor, utilityActivity } from "../common.mjs";
import { configureAreaActivities } from "../areas.mjs";
import { deathKnightDocuments, deathKnightFolders } from "./death-knight-features.mjs";
import { aberrantDocuments, aberrantFolders } from "./aberrant-features.mjs";
import { forestLordDocuments, forestLordFolders } from "./forest-lord-features.mjs";
import { hereticDocuments, hereticFolders } from "./heretic-features.mjs";
import { leaderDocuments, leaderFolders } from "./leader-features.mjs";
import { witchBladeDocuments, witchBladeFolders } from "./witch-blade-features.mjs";
import { juggernautDocuments, juggernautFolders } from "./juggernaut-features.mjs";
import { soulEaterDocuments, soulEaterFolders } from "./soul-eater-features.mjs";
import { guardianDocuments, guardianFolders } from "./guardian-features.mjs";
import { crusaderDocuments, crusaderFolders } from "./crusader-features.mjs";
import { feyWarriorDocuments, feyWarriorFolders } from "./fey-warrior-features.mjs";
import { ghostWalkerDocuments, ghostWalkerFolders } from "./ghost-walker-features.mjs";
import { blinkerDocuments, blinkerFolders } from "./blinker-features.mjs";
import { fallenPriestDocuments, fallenPriestFolders } from "./fallen-priest-features.mjs";
import { plagueDoctorDocuments, plagueDoctorFolders } from "./plague-doctor-features.mjs";
import { insectLordDocuments, insectLordFolders } from "./insect-lord-features.mjs";
import { gamblerDocuments, gamblerFolders } from "./gambler-features.mjs";
import { keeperDocuments, keeperFolders } from "./keeper-features.mjs";
import { schoolOfSteelDocuments, schoolOfSteelFolders } from "./school-of-steel-features.mjs";
import { hollowFeatureDocuments, hollowFeatureFolders } from "./hollow-transformation.mjs";
import { murderspawnFeatureDocuments, murderspawnFeatureFolders } from "./murderspawn-transformation.mjs";
import { bloodMageDocuments, bloodMageFolders } from "./blood-mage-features.mjs";
import { onmyojiDocuments, onmyojiFolders } from "./onmyoji-features.mjs";
import { ritualistDocuments, ritualistFolders } from "./ritualist-features.mjs";
import { darkWarriorDocuments, darkWarriorFolders } from "./dark-warrior-features.mjs";
import { devilWorshipperDocuments, devilWorshipperFolders } from "./devil-worshipper-features.mjs";
import { nethereseArcanistDocuments, nethereseArcanistFolders } from "./netherese-arcanist-features.mjs";
import { spiritVesselDocuments, spiritVesselFolders } from "./spirit-vessel-features.mjs";
import { oracleDocuments, oracleFolders } from "./oracle-features.mjs";
import { demonologistDocuments, demonologistFolders } from "./demonologist-features.mjs";
import { sanguinistDocuments, sanguinistFolders } from "./sanguinist-features.mjs";
import {masterDocuments, masterFolders} from "./master-features.mjs";
import {bountyHunterDocuments,bountyHunterFolders} from "./bounty-hunter-features.mjs";
import {jesterDocuments,jesterFolders} from "./jester-features.mjs";
import {flagellantDocuments,flagellantFolders} from "./flagellant-features.mjs";
import {doomedDocuments,doomedFolders} from "./doomed-features.mjs";
import {nightmareDocuments,nightmareFolders} from "./nightmare-features.mjs";
import {empathDocuments,empathFolders} from "./empath-features.mjs";
import {arkaneDocuments,arkaneFolders} from "./arkane-features.mjs";

const MAIN_FOLDER = idFor("folder:class-features");
const STYLE_FOLDER = idFor("folder:weapon-styles");
const TECHNIQUE_FOLDER = idFor("folder:crusher-techniques");

export const folders = [
  folder({ key: "class-features", name: "Классовые особенности", sort: 100000 }),
  folder({ key: "weapon-styles", name: "Стили огромного оружия", sort: 200000 }),
  folder({ key: "crusher-techniques", name: "Техники Сокрушителя", sort: 300000 }),
  ...leaderFolders,
  ...deathKnightFolders,
  ...hereticFolders,
  ...forestLordFolders,
  ...aberrantFolders,
  ...witchBladeFolders,
  ...juggernautFolders,
  ...soulEaterFolders,
  ...guardianFolders,
  ...crusaderFolders,
  ...feyWarriorFolders,
  ...ghostWalkerFolders,
  ...blinkerFolders,
  ...fallenPriestFolders,
  ...plagueDoctorFolders,
  ...insectLordFolders,
  ...gamblerFolders,
  ...keeperFolders,
  ...bloodMageFolders,
  ...onmyojiFolders,
  ...ritualistFolders,
  ...darkWarriorFolders,
  ...devilWorshipperFolders,
  ...nethereseArcanistFolders,
  ...spiritVesselFolders,
  ...oracleFolders,
  ...demonologistFolders,
  ...sanguinistFolders,
  ...masterFolders,
  ...bountyHunterFolders,
  ...jesterFolders,
  ...flagellantFolders,
  ...doomedFolders,
  ...nightmareFolders,
  ...empathFolders,
  ...arkaneFolders,
  ...schoolOfSteelFolders,
  ...murderspawnFeatureFolders,
  ...hollowFeatureFolders
];

export const documents = configureAreaActivities([
  feature({
    key: "great-weapon-style",
    name: "Стиль огромного оружия",
    img: "icons/skills/melee/strike-sword-steel-yellow.webp",
    level: 1,
    requirements: "Сокрушитель 1",
    folder: MAIN_FOLDER,
    automation: {
      feature: "great-weapon-style"
    },
    activities: utilityActivity({
      key: "great-weapon-style-control",
      name: "Переключить режим Мастера большого оружия",
      action: "toggle-gwm",
      activation: "special"
    }),
    description: `
      <p>Вы учитесь использовать массивное оружие и получаете владение им.</p>
      <p>Выберите один стиль: <strong>Раскалывание</strong> или <strong>Сокрушение</strong>. Менеджер развития предложит этот выбор отдельно.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> использование действия «Переключить режим Мастера большого оружия» включает или выключает режим −5 к броску атаки и +10 к урону массивного оружия. Выбранное состояние сохраняется до следующего переключения. Модуль также предоставляет Сокрушителю владение массивным оружием.</p>
    `
  }),
  feature({
    key: "cleaving",
    name: "Раскалывание",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    level: 1,
    requirements: "Сокрушитель 1; Стиль огромного оружия",
    folder: STYLE_FOLDER,
    automation: {
      feature: "cleaving",
      style: "cleaving"
    },
    activities: utilityActivity({
      key: "activate-cleaving",
      name: "Использовать Раскалывание",
      action: "set-style-cleaving",
      activation: "special"
    }),
    description: `
      <p>Вы пытаетесь расколоть врага надвое, используя вес оружия для нанесения крайне тяжёлых ударов.</p>
      <p>При использовании черты <strong>Мастер большого оружия</strong> атаки массивным оружием наносят один дополнительный кубик урона оружия. Например, цвайхандер вместо 2к8 наносит 3к8.</p>
      <p>На 5-м уровне Сокрушителя вы получаете ещё один дополнительный кубик урона.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> используйте действие «Использовать Раскалывание», чтобы сделать этот стиль активным. Пока включён режим −5/+10, модуль добавляет один кубик урона оружия, а с 5-го уровня Сокрушителя — два кубика.</p>
    `
  }),
  feature({
    key: "crushing",
    name: "Сокрушение",
    img: "icons/skills/melee/strike-hammer-destructive-blue.webp",
    level: 1,
    requirements: "Сокрушитель 1; Стиль огромного оружия",
    folder: STYLE_FOLDER,
    automation: {
      feature: "crushing",
      style: "crushing"
    },
    activities: utilityActivity({
      key: "activate-crushing",
      name: "Использовать Сокрушение",
      action: "set-style-crushing",
      activation: "special"
    }),
    description: `
      <p>Вы используете вес и размер оружия, чтобы сокрушить врага.</p>
      <p>Если на кости урона массивного оружия выпало максимальное значение, бросьте ещё одну такую кость и добавьте результат к урону атаки.</p>
      <p>На 5-м уровне Сокрушителя, если на дополнительной кости снова выпало максимальное значение, вы можете бросить ещё одну кость.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> используйте действие «Использовать Сокрушение», чтобы сделать этот стиль активным. До 5-го уровня каждая основная кость с максимальным результатом вызывает один дополнительный бросок; с 5-го уровня дополнительные кости продолжают взрываться, пока на них выпадает максимум.</p>
    `
  }),
  feature({
    key: "giant-killer",
    name: "Убийца гигантов",
    img: "icons/skills/melee/strike-axe-energy-pink.webp",
    level: 1,
    requirements: "Сокрушитель 1",
    folder: MAIN_FOLDER,
    automation: {
      feature: "giant-killer"
    },
    description: `
      <p>Чем больше враг, тем сокрушительнее его падение.</p>
      <p>Когда вы попадаете по существу массивным оружием, атака наносит 1 дополнительную единицу урона за каждую категорию размера, на которую цель больше вас.</p>
      <p>Например, персонаж Среднего размера наносит Огромному существу 2 единицы дополнительного урона.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> при использовании Midi-QOL модуль сравнивает размеры атакующего и каждой поражённой цели, затем добавляет отдельный урон с учётом сопротивления или уязвимости цели.</p>
    `
  }),
  feature({
    key: "crusher-techniques",
    name: "Техники Сокрушителя",
    img: "icons/skills/melee/sword-damaged-broken-orange.webp",
    level: 2,
    requirements: "Сокрушитель 2",
    folder: MAIN_FOLDER,
    automation: {
      feature: "crusher-techniques"
    },
    description: `
      <p>Вы изучаете одну технику Сокрушителя на 2-м уровне, ещё одну на 3-м уровне и третью на 5-м уровне.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> менеджер развития показывает весь список техник, но модуль не позволит завершить развитие, если выбранная техника не соответствует текущему уровню или доступному стилю оружия.</p>
    `
  }),
  feature({
    key: "momentum",
    name: "Импульс",
    img: "icons/skills/melee/strike-hammer-destructive-orange.webp",
    level: 3,
    requirements: "Сокрушитель 3",
    folder: MAIN_FOLDER,
    automation: {
      feature: "momentum"
    },
    description: `
      <p>Вы используете вес массивного оружия и гравитацию для усиления удара.</p>
      <p>Для всех атак массивным оружием модификатор Силы к урону увеличивается наполовину с округлением вверх. Например, модификатор +4 становится +6.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> модуль автоматически добавляет к урону массивного оружия половину текущего модификатора Силы с округлением вверх.</p>
    `
  }),
  feature({
    key: "steel-will",
    name: "Стальная воля",
    img: "icons/equipment/shield/heater-steel-boss-red.webp",
    level: 4,
    requirements: "Сокрушитель 4",
    folder: MAIN_FOLDER,
    automation: {
      feature: "steel-will"
    },
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
      name: "Подготовить Стальную волю",
      action: "arm-steel-will",
      activation: "special",
      condition: "Когда требуется спасбросок Ловкости и вы можете активно использовать массивное оружие",
      consumeItemUse: true
    }),
    description: `
      <p>Пока вы можете активно использовать массивное оружие, когда от вас требуется спасбросок Ловкости, вы можете заменить его спасброском Силы.</p>
      <p>После использования этой способности вы не можете использовать её повторно до завершения короткого или продолжительного отдыха.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> непосредственно перед требуемым спасброском используйте действие «Подготовить Стальную волю». Следующий спасбросок Ловкости этого персонажа будет рассчитан как спасбросок Силы, после чего подготовленное состояние снимается. Заряд способности расходуется при её подготовке.</p>
    `
  }),
  feature({
    key: "steel-giant",
    name: "Стальной гигант",
    img: "icons/skills/melee/hand-grip-sword-orange.webp",
    level: 5,
    requirements: "Сокрушитель 5",
    folder: MAIN_FOLDER,
    automation: {
      feature: "steel-giant"
    },
    activities: utilityActivity({
      key: "steel-giant-sync",
      name: "Обновить усиление магического предмета",
      action: "sync-steel-giant",
      activation: "special"
    }),
    description: `
      <p>Ваша Сила увеличивается на 4, максимум до 24. Это увеличение применяется отдельным этапом развития класса.</p>
      <p>Если вы настраиваетесь на магический предмет, устанавливающий Силу на определённое значение, это значение становится на 1 пункт выше обычного.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> увеличение Силы на 4 выдаётся развитием класса. Если активный эффект экипированного или настроенного предмета переопределяет значение Силы, модуль добавляет к нему ещё 1. Действие «Обновить усиление магического предмета» запускает повторную проверку вручную.</p>
    `
  }),
  feature({
    key: "adaptability",
    name: "Адаптивность",
    img: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
    requirements: "Техника Сокрушителя",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "adaptability",
      technique: true
    },
    activities: utilityActivity({
      key: "adaptability-toggle",
      name: "Сменить активный стиль",
      action: "toggle-style",
      activation: "special"
    }),
    description: `
      <p>Вы можете использовать как Раскалывание, так и Сокрушение.</p>
      <p>Совершая атаку, но до броска, объявите, какой стиль используете для этой атаки.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> используйте действие «Сменить активный стиль» перед атакой. Выбранный стиль действует до следующего переключения.</p>
    `
  }),
  feature({
    key: "superior-control",
    name: "Превосходный контроль",
    img: "icons/skills/melee/sword-stuck-glowing-pink.webp",
    level: 5,
    requirements: "Сокрушитель 5",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "superior-control",
      technique: true,
      minimumLevel: 5
    },
    description: `
      <p>Когда вы атакуете массивным оружием, добавьте модификатор Телосложения к урону.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> текущий модификатор Телосложения автоматически добавляется к броску урона массивного оружия.</p>
    `
  }),
  feature({
    key: "powerful-crushing",
    name: "Мощное сокрушение",
    img: "icons/skills/melee/hand-grip-hammer-spiked-blue.webp",
    requirements: "Стиль огромного оружия: Сокрушение",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "powerful-crushing",
      technique: true,
      requiredStyle: "crushing"
    },
    description: `
      <p>Когда вы наносите критический удар, используя Сокрушение, добавьте к урону один дополнительный кубик урона оружия.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> если активен стиль «Сокрушение», модуль автоматически добавляет к критическому урону один дополнительный кубик оружия. Этот кубик не удваивается повторно.</p>
    `
  }),
  feature({
    key: "powerful-cleaving",
    name: "Мощное раскалывание",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    requirements: "Стиль огромного оружия: Раскалывание",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "powerful-cleaving",
      technique: true,
      requiredStyle: "cleaving"
    },
    description: `
      <p>Когда вы наносите критический удар, используя Раскалывание, можете перебросить любые кости урона и использовать лучший из двух результатов.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> при использовании Midi-QOL и активном стиле «Раскалывание» модуль перебрасывает все выпавшие кости критического урона и для каждой кости оставляет лучший результат.</p>
    `
  }),
  feature({
    key: "indestructibility",
    name: "Несокрушимость",
    img: "icons/magic/defensive/shield-barrier-flaming-diamond-blue.webp",
    level: 3,
    requirements: "Сокрушитель 3",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "indestructibility",
      technique: true,
      minimumLevel: 3
    },
    description: `
      <p>Когда вы используете Стальную волю для спасброска, позволяющего получить половину урона, вы не получаете урона при успехе и получаете половину урона при провале.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> при использовании Midi-QOL эффект применяется автоматически к спасброску Ловкости, для которого была подготовлена «Стальная воля»: успех даёт 0 урона, провал — половину.</p>
    `
  }),
  feature({
    key: "smithing",
    name: "Кузнечное ремесло",
    img: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
    requirements: "Техника Сокрушителя",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "smithing",
      technique: true
    },
    activities: utilityActivity({
      key: "smithing-reduce-weight",
      name: "Облегчить массивное оружие",
      action: "smithing",
      activation: "special"
    }),
    description: `
      <p>Вы можете уменьшить вес своего массивного оружия на 5 фунтов.</p>
      <p>Модификации и улучшения оружия во время простоя занимают вдвое меньше времени.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> действие «Облегчить массивное оружие» предлагает выбрать подходящее оружие и один раз уменьшает его вес на 5 фунтов. Сокращение времени работ остаётся описательным правилом, поскольку dnd5e не ведёт стандартный учёт времени простоя.</p>
    `
  }),
  feature({
    key: "giant-crushing",
    name: "Сокрушение гигантов",
    img: "icons/skills/melee/strike-axe-blood-red.webp",
    requirements: "Техника Сокрушителя; Убийца гигантов",
    folder: TECHNIQUE_FOLDER,
    automation: {
      feature: "giant-crushing",
      technique: true
    },
    description: `
      <p>Когда вы наносите критический удар существу, на которое действует Убийца гигантов, добавьте к урону утроенный модификатор Силы.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> при использовании Midi-QOL модуль добавляет утроенный текущий модификатор Силы к критическому урону по цели, которая имеет больший размер и получает бонусный урон от «Убийцы гигантов».</p>
    `
  }),
  ...schoolOfSteelDocuments,
  ...leaderDocuments,
  ...deathKnightDocuments,
  ...hereticDocuments,
  ...forestLordDocuments,
  ...aberrantDocuments,
  ...witchBladeDocuments,
  ...juggernautDocuments,
  ...soulEaterDocuments,
  ...guardianDocuments,
  ...crusaderDocuments,
  ...feyWarriorDocuments,
  ...ghostWalkerDocuments,
  ...blinkerDocuments,
  ...fallenPriestDocuments,
  ...plagueDoctorDocuments,
  ...insectLordDocuments,
  ...gamblerDocuments,
  ...keeperDocuments,
  ...bloodMageDocuments,
  ...onmyojiDocuments,
  ...ritualistDocuments,
  ...darkWarriorDocuments,
  ...devilWorshipperDocuments,
  ...nethereseArcanistDocuments,
  ...spiritVesselDocuments,
  ...oracleDocuments,
  ...demonologistDocuments,
  ...sanguinistDocuments,
  ...masterDocuments,
  ...bountyHunterDocuments,
  ...jesterDocuments,
  ...flagellantDocuments,
  ...doomedDocuments,
  ...nightmareDocuments,
  ...empathDocuments,
  ...arkaneDocuments,
  ...murderspawnFeatureDocuments,
  ...hollowFeatureDocuments
]);
