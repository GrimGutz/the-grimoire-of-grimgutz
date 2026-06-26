import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const SOURCE = "Престиж-класс: Лидер; Legends of Prestige and Prowess v1.2; предоставленный PDF Leader.pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:leader-features");
const EXPERTISE_FOLDER = idFor("folder:leader-expertise");
const PRESENCE_FOLDER = idFor("folder:leader-presences");
const STRATAGEM_FOLDER = idFor("folder:leader-stratagems");

export const leaderFolders = [
  folder({ key: "leader-features", name: "Лидер: классовые особенности", sort: 400000 }),
  folder({ key: "leader-expertise", name: "Лидер: экспертность лидерства", sort: 500000 }),
  folder({ key: "leader-presences", name: "Лидер: присутствия", sort: 600000 }),
  folder({ key: "leader-stratagems", name: "Лидер: стратагемы", sort: 700000 })
];

function activities(...entries) {
  return Object.assign({}, ...entries);
}

function description(body, automation) {
  return `
    ${body}
    <hr>
    <p><strong>Автоматизация Foundry:</strong> ${automation}</p>
  `;
}

function leaderFeature(options) {
  return feature({
    ...options,
    sourcePage: options.sourcePage ?? "2–4",
    sourceCustom: SOURCE
  });
}

function stratagem({
  key,
  name,
  img,
  activation,
  rangeValue = null,
  rollFormula = "",
  activityName = name,
  extraActivities = [],
  body,
  automation = "модуль задаёт правильный тип действия и автоматически контролирует ограничение на использование стратагем до начала следующего хода Лидера. Выбранные цели должны вручную применить описанный эффект."
}) {
  return leaderFeature({
    key,
    name,
    img,
    requirements: "Лидер; известная Стратагема командования",
    folder: STRATAGEM_FOLDER,
    automation: {
      feature: key,
      leaderFeature: true,
      stratagem: true
    },
    activities: activities(
      utilityActivity({
        key,
        name: activityName,
        activation,
        rangeValue,
        targetType: "creature",
        targetCount: "1",
        targetChoice: true,
        rollFormula,
        rollName: name,
        rollVisible: Boolean(rollFormula)
      }),
      ...extraActivities
    ),
    sourcePage: "5–6",
    description: description(body, automation)
  });
}

const leadershipBenefitAutomation = "выбор этой особенности выполняется через Advancement класса. Постоянный эффект применяется по описанию; Foundry не может автоматически определить все подходящие перемещения, способы связи и изменяемые дистанции.";
const presenceAutomation = "выбор присутствия выполняется через Advancement класса. Из-за постоянно меняющегося состава существ, видимости и слышимости аура не накладывает эффекты автоматически; бонусы применяются по описанию.";

export const leaderDocuments = [
  leaderFeature({
    key: "leader-command-stratagems",
    name: "Стратагемы командования",
    img: "icons/skills/social/diplomacy-handshake-yellow.webp",
    level: 1,
    requirements: "Лидер 1",
    folder: MAIN_FOLDER,
    automation: {
      feature: "leader-command-stratagems",
      leaderFeature: true
    },
    description: description(`
      <p>Вы изучаете две стратагемы на 1-м уровне Лидера, третью на 3-м и четвёртую на 5-м. При получении уровня Лидера одну известную стратагему можно заменить другой.</p>
      <p>Стратагемы немагические, не имеют общего количества применений и воздействуют только на добровольных союзников, которые видят и слышат вас, способны использовать реакцию и не применяли Стратагему командования с начала своего последнего хода.</p>
      <p>После использования стратагемы вы не можете использовать другую до начала своего следующего хода.</p>
    `, "выбор стратагем встроен в Advancement класса. В бою модуль блокирует повторное использование стратагем до начала следующего хода Лидера; «Проблеск гения» может обойти это ограничение.")
  }),
  leaderFeature({
    key: "moment-of-glory",
    name: "Мгновение славы",
    img: "icons/magic/light/explosion-star-glow-silhouette.webp",
    level: 2,
    requirements: "Лидер 2",
    folder: MAIN_FOLDER,
    automation: {
      feature: "moment-of-glory",
      leaderFeature: true
    },
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: activities(
      utilityActivity({
        key: "moment-plan",
        name: "Всё по плану",
        activation: "reaction",
        rangeValue: 30,
        targetType: "creature",
        targetCount: "1",
        consumeItemUse: true,
        condition: "До броска атаки оружием видимого и слышащего вас существа"
      }),
      utilityActivity({
        key: "moment-believe",
        name: "Поверь в себя",
        activation: "reaction",
        rangeValue: 60,
        targetType: "creature",
        targetCount: "1",
        consumeItemUse: true,
        condition: "После проваленного спасброска видимого и слышащего вас существа"
      }),
      utilityActivity({
        key: "moment-dont-die",
        name: "Не смей умирать",
        activation: "action",
        rangeValue: 5,
        targetType: "creature",
        targetCount: "1",
        consumeItemUse: true,
        condition: "Касание нестабилизированного существа с 0 хитов"
      }),
      utilityActivity({
        key: "moment-now",
        name: "Сейчас или никогда",
        activation: "reaction",
        rangeValue: 60,
        targetType: "creature",
        targetCount: "1",
        consumeItemUse: true,
        condition: "Когда видящее и слышащее вас существо начинает ход"
      })
    ),
    description: description(`
      <p><strong>Всё по плану.</strong> Реакцией до броска атаки оружием существа в пределах 30 футов дайте ему преимущество. При попадании атака становится критическим попаданием.</p>
      <p><strong>Поверь в себя.</strong> Реакцией после проваленного спасброска существа в пределах 60 футов позвольте ему перебросить спасбросок и использовать новый результат.</p>
      <p><strong>Не смей умирать.</strong> Действием коснитесь нестабилизированного существа с 0 хитов. Оно восстанавливает 1 хит, может потратить Кости Хитов в количестве, равном половине вашего бонуса мастерства, и на 1 минуту получает временные хиты, равные общему количеству его Костей Хитов плюс ваш бонус мастерства.</p>
      <p><strong>Сейчас или никогда.</strong> Реакцией в начале хода существа в пределах 60 футов позвольте ему немедленно совершить Рывок и Отход.</p>
      <p>После использования любого варианта все варианты восстанавливаются после продолжительного отдыха.</p>
    `, "четыре варианта представлены отдельными активностями и расходуют общий заряд особенности. Реактивные преимущества, переброс, критическое попадание, лечение и перемещение применяются участниками вручную.")
  }),
  leaderFeature({
    key: "glimpse-of-genius",
    name: "Проблеск гения",
    img: `${WOW}/Spells/Brilliance.png`,
    level: 2,
    requirements: "Лидер 2",
    folder: MAIN_FOLDER,
    automation: {
      feature: "glimpse-of-genius",
      leaderFeature: true
    },
    uses: {
      max: "floor(@classes.leader.levels / 4) + 1",
      spent: 0,
      recovery: [
        { period: "sr", type: "recoverAll" },
        { period: "lr", type: "recoverAll" }
      ]
    },
    activities: utilityActivity({
      key: "glimpse-of-genius",
      name: "Подготовить Проблеск гения",
      action: "arm-glimpse-of-genius",
      activation: "bonus",
      consumeItemUse: true
    }),
    description: description(`
      <p>Бонусным действием активируйте стратагему, обычно требующую действия, либо примените стратагему, обычно требующую бонусного действия или реакции, без этого требования.</p>
      <p>Это можно сделать, даже если вы уже использовали стратагему в этом раунде. Такое применение не мешает использовать другую стратагему до начала вашего следующего хода.</p>
      <p>Одно применение восстанавливается после короткого или продолжительного отдыха; на 4-м уровне Лидера доступно два применения.</p>
    `, "сначала используйте активность «Подготовить Проблеск гения», затем нужную стратагему. Следующая стратагема обойдёт блокировку и сама не установит её; изменение экономики действий отмечается пользователем вручную.")
  }),
  leaderFeature({
    key: "leadership-expertise",
    name: "Экспертность лидерства",
    img: "icons/skills/social/diplomacy-writing-letter.webp",
    level: 3,
    requirements: "Лидер 3",
    folder: MAIN_FOLDER,
    automation: {
      feature: "leadership-expertise",
      leaderFeature: true
    },
    description: description(`
      <p>Выберите один навык или инструмент, которым уже владеете: Обращение с животными, Обман, История, Проницательность, Запугивание, Расследование, Выступление, Убеждение, Религия, инструменты навигатора, любой игровой набор или музыкальный инструмент. Ваш бонус мастерства удваивается для соответствующих проверок.</p>
      <p>Также навсегда выберите одно преимущество Экспертности лидерства.</p>
    `, "Advancement класса предлагает допустимый выбор экспертности и отдельно одно из четырёх преимуществ.")
  }),
  leaderFeature({
    key: "battlefield-conductor",
    name: "Дирижёр поля боя",
    img: "icons/skills/social/diplomacy-unity-alliance.webp",
    level: 3,
    requirements: "Лидер 3; Экспертность лидерства",
    folder: EXPERTISE_FOLDER,
    automation: { feature: "battlefield-conductor", leaderFeature: true, leadershipBenefit: true },
    description: description("<p>Дистанции 30 и 60 футов, указанные в особенностях Лидера и стратагемах, считаются удвоенными.</p>", leadershipBenefitAutomation)
  }),
  leaderFeature({
    key: "formation-master",
    name: "Мастер построения",
    img: "icons/skills/movement/feet-winged-boots-brown.webp",
    level: 3,
    requirements: "Лидер 3; Экспертность лидерства",
    folder: EXPERTISE_FOLDER,
    automation: { feature: "formation-master", leaderFeature: true, leadershipBenefit: true },
    description: description("<p>Вы можете проходить через пространства дружественных существ, не считая их труднопроходимой местностью. Атака возможности, спровоцированная входом в пространство союзника, совершается с помехой.</p>", leadershipBenefitAutomation)
  }),
  leaderFeature({
    key: "frontline-commander",
    name: "Командир на передовой",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    level: 3,
    requirements: "Лидер 3; Экспертность лидерства",
    folder: EXPERTISE_FOLDER,
    automation: { feature: "frontline-commander", leaderFeature: true, leadershipBenefit: true },
    description: description("<p>После использования Стратагемы командования ваша скорость увеличивается на 10 футов до конца вашего следующего хода. Эффект не складывается.</p>", "при использовании стратагемы модуль создаёт временный эффект +10 футов ко всем имеющимся скоростям и снимает его в конце следующего хода Лидера.")
  }),
  leaderFeature({
    key: "versatile-communicator",
    name: "Универсальный коммуникатор",
    img: "icons/magic/sonic/scream-wail-shout-teal.webp",
    level: 3,
    requirements: "Лидер 3; Экспертность лидерства",
    folder: EXPERTISE_FOLDER,
    automation: { feature: "versatile-communicator", leaderFeature: true, leadershipBenefit: true },
    description: description("<p>Если особенность Лидера требует, чтобы существа видели и слышали вас, достаточно, чтобы они видели или слышали вас, в том числе через телепатию, иллюзию или другую магию.</p>", leadershipBenefitAutomation)
  }),
  leaderFeature({
    key: "perfect-coordination",
    name: "Идеальная координация",
    img: "icons/skills/social/diplomacy-handshake-blue.webp",
    level: 3,
    requirements: "Лидер 3",
    folder: MAIN_FOLDER,
    automation: {
      feature: "perfect-coordination",
      leaderFeature: true
    },
    activities: utilityActivity({
      key: "perfect-coordination-signal",
      name: "Подать сигнал отложившим ход",
      activation: "reaction",
      targetType: "ally",
      targetChoice: true
    }),
    description: description(`
      <p>Другое дружественное существо, которое видит и слышит вас, в начале своего хода может реакцией отложить ход и ждать вашего сигнала.</p>
      <p>После окончания любого хода вы можете реакцией подать сигнал видимым ожидающим существам. Они совершают отложенные ходы в выбранном вами порядке, после чего их инициатива меняется. Эффекты начала и конца хода срабатывают при откладывании.</p>
      <p>Существо может проигнорировать сигнал; тогда отложенный ход теряется.</p>
    `, "активность публикует сигнал в чат. Изменение инициативы и перенос хода выполняются Мастером вручную, поскольку Foundry не предоставляет безопасного штатного способа перестроить несколько текущих ходов с сохранением всех эффектов.")
  }),
  leaderFeature({
    key: "leader-presence",
    name: "Присутствие лидера",
    img: "icons/skills/social/diplomacy-unity-alliance.webp",
    level: 5,
    requirements: "Лидер 5",
    folder: MAIN_FOLDER,
    automation: {
      feature: "leader-presence",
      leaderFeature: true
    },
    description: description(`
      <p>Ваше присутствие начинает постоянно влиять на тех, кого вы ведёте. Выберите одно преимущество: Успокаивающее присутствие, Отвлекающее присутствие, Буйное присутствие, Тактическое присутствие, Проницательное присутствие или Вдохновляющее присутствие.</p>
      <p>Существо не может одновременно получать пользу от одного и того же вида присутствия более одного раза. Присутствие действует, пока вы не недееспособны.</p>
    `, "Advancement класса выдаёт эту общую особенность и предлагает отдельно выбрать один из шести вариантов присутствия. Автоматизация конкретного варианта описана в его карточке.")
  }),
  leaderFeature({
    key: "calming-presence",
    name: "Успокаивающее присутствие",
    img: "icons/magic/life/heart-shadow-red.webp",
    level: 5,
    requirements: "Лидер 5; Присутствие лидера",
    folder: PRESENCE_FOLDER,
    automation: { feature: "calming-presence", leaderFeature: true, presence: true },
    description: description(`
      <p>Выбранные существа, которые видят и слышат вас, получают дополнительное лечение.</p>
      <p>При восстановлении более 4 хитов классовой особенностью или от Кости Хитов добавьте половину вашего бонуса мастерства к каждой Кости Хитов. При лечении заклинанием добавьте больший результат: ваш бонус мастерства или удвоенный уровень заклинания.</p>
      <p>Разделите бонус пополам, если заклинание длится дольше мгновения, накладывается быстрее действия или лечит более одного существа.</p>
    `, presenceAutomation)
  }),
  leaderFeature({
    key: "distracting-presence",
    name: "Отвлекающее присутствие",
    img: "icons/magic/control/fear-fright-monster-red.webp",
    level: 5,
    requirements: "Лидер 5; Присутствие лидера",
    folder: PRESENCE_FOLDER,
    automation: { feature: "distracting-presence", leaderFeature: true, presence: true },
    description: description(`
      <p>Когда выбранное существо, видящее и слышащее вас, промахивается атакой по вам или существу в пределах 30 футов от вас, вы реакцией даёте ему помеху на следующую атаку до конца его хода.</p>
      <p>Промах атаки, уже имевшей эту помеху, не активирует присутствие.</p>
    `, presenceAutomation)
  }),
  leaderFeature({
    key: "boisterous-presence",
    name: "Буйное присутствие",
    img: "icons/magic/control/buff-flight-wings-runes-purple-orange.webp",
    level: 5,
    requirements: "Лидер 5; Присутствие лидера",
    folder: PRESENCE_FOLDER,
    automation: { feature: "boisterous-presence", leaderFeature: true, presence: true },
    description: description(`
      <p>Вы и выбранные существа, которые видят и слышат вас, увеличиваете скорость на 10 футов.</p>
      <p>Когда затронутое существо снижает врага до 0 хитов или совершает критическое попадание, первое нанесение урона каждым другим затронутым существом до начала вашего следующего хода получает бонус, равный удвоенному вашему бонусу мастерства.</p>
    `, presenceAutomation)
  }),
  leaderFeature({
    key: "tactical-presence",
    name: "Тактическое присутствие",
    img: `${WOW}/Abilities/RallyingCry.png`,
    level: 5,
    requirements: "Лидер 5; Присутствие лидера",
    folder: PRESENCE_FOLDER,
    automation: { feature: "tactical-presence", leaderFeature: true, presence: true },
    description: description(`
      <p>Выбранные существа, которые видят и слышат вас и не застигнуты врасплох, добавляют ваш модификатор Интеллекта (минимум +1) к инициативе.</p>
      <p>Когда другое затронутое существо попадает оружием по видимой вами цели в пределах 60 футов и рядом с целью есть ещё одно затронутое существо, атака один раз за ход наносит дополнительный урон, равный 1 + половина вашего бонуса мастерства.</p>
    `, presenceAutomation)
  }),
  leaderFeature({
    key: "insightful-presence",
    name: "Проницательное присутствие",
    img: "icons/magic/perception/eye-ringed-glow-angry-teal.webp",
    level: 5,
    requirements: "Лидер 5; Присутствие лидера",
    folder: PRESENCE_FOLDER,
    automation: { feature: "insightful-presence", leaderFeature: true, presence: true },
    description: description(`
      <p>Другие выбранные существа, которые видят и слышат вас, добавляют ваш модификатор Мудрости (минимум +1) к проверкам Восприятия, Проницательности и Расследования.</p>
      <p>Когда ощущаемое вами существо атакует затронутое существо, вы накладываете −3 к броску атаки. После помощи одной цели эффект не может помогать ей снова до начала её следующего хода.</p>
    `, presenceAutomation)
  }),
  leaderFeature({
    key: "inspiring-presence",
    name: "Вдохновляющее присутствие",
    img: "icons/magic/control/buff-luck-fortune-rainbow.webp",
    level: 5,
    requirements: "Лидер 5; Присутствие лидера",
    folder: PRESENCE_FOLDER,
    automation: { feature: "inspiring-presence", leaderFeature: true, presence: true },
    description: description(`
      <p>Другие выбранные существа, которые видят и слышат вас, получают +2 к спасброскам и проверкам Харизмы.</p>
      <p>Когда затронутое существо получает временные хиты, увеличьте их количество на ваш модификатор Харизмы (минимум +1).</p>
    `, presenceAutomation)
  }),
  stratagem({
    key: "stratagem-cunning-ruse",
    name: "Хитрая уловка",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    activation: "bonus",
    rangeValue: 60,
    body: `
      <p>Выберите видящее и слышащее вас существо в пределах 60 футов. Совершите с помехой одну выбранную проверку: Интеллект (Магия или Расследование), Харизма (Обман или Выступление), Ловкость (Ловкость рук) либо Мудрость (Выживание), добавив уровень Лидера.</p>
      <p>Цель с преимуществом противопоставляет Расследование, Проницательность или Восприятие. При успехе выбранный союзник в пределах 60 футов от цели получает преимущество на атаки по ней до конца вашего следующего хода.</p>
    `
  }),
  stratagem({
    key: "stratagem-battle-cry",
    name: "Боевой клич",
    img: "icons/magic/sonic/scream-wail-shout-teal.webp",
    activation: "special",
    rangeValue: 60,
    body: `
      <p>Используйте в начале хода. До начала следующего хода выберите союзников в количестве, равном удвоенному уровню Лидера.</p>
      <p>Они имеют преимущество на спасброски от испуга и добавляют ваш уровень Лидера к проверкам захвата, толчка или смятия.</p>
    `
  }),
  stratagem({
    key: "stratagem-command-caution",
    name: "Приказ к осторожности",
    img: "icons/magic/perception/eye-ringed-green.webp",
    activation: "bonus",
    rangeValue: 60,
    activityName: "Насторожить союзника",
    extraActivities: [
      utilityActivity({
        key: "stratagem-command-caution-enemy",
        name: "Предупредить об угрозе врага",
        activation: "action",
        rangeValue: 60,
        targetType: "creature",
        targetCount: "1"
      })
    ],
    body: `
      <p>Бонусным действием позвольте союзнику немедленно совершить проверку Восприятия или Расследования с бонусом, равным вашему уровню Лидера.</p>
      <p>Вместо этого действием выберите видимого врага в пределах 60 футов и союзников в количестве, равном уровню Лидера. До начала вашего следующего хода первая атака врага по одному из них совершается с помехой либо первый вызванный врагом спасбросок совершается союзником с преимуществом.</p>
    `
  }),
  stratagem({
    key: "stratagem-direct-attack",
    name: "Направить атаку",
    img: "icons/skills/ranged/arrow-flying-broadhead-metal.webp",
    activation: "bonus",
    rangeValue: 60,
    rollFormula: "1d4 + floor((2 + floor(@classes.leader.levels / 5)) / 2)",
    body: `
      <p>Выберите видимое существо, по которому уже попали оружием в этом ходу. До начала вашего следующего хода атаки оружием союзников по цели получают бонус к урону 1к4 + половина вашего бонуса мастерства.</p>
      <p>Бонус действует на количество атак, равное 1 + ваш уровень Лидера.</p>
      <p>Кость становится к6 на 3-м уровне Лидера и к8 на 5-м.</p>
    `,
    automation: "активность бросает базовую формулу 1к4 + половина бонуса мастерства. На 3-м уровне используйте к6, на 5-м — к8; бонус применяется вручную не более чем к 1 + уровень Лидера атакам."
  }),
  stratagem({
    key: "stratagem-retreat-regroup",
    name: "Отступить и перегруппироваться",
    img: `${WOW}/Abilities/Dash.png`,
    activation: "bonus",
    body: `
      <p>Один союзник реакцией перемещается на половину скорости к вам и получает к КД против спровоцированных атак возможности бонус, равный вашему уровню Лидера.</p>
      <p>Затем каждый союзник в пределах 5 футов от вас получает временные хиты, равные половине вашего бонуса мастерства, до начала вашего следующего хода.</p>
    `
  }),
  stratagem({
    key: "stratagem-guiding-magic",
    name: "Направляющая магия",
    img: "icons/magic/light/projectile-smoke-blue-light.webp",
    activation: "special",
    body: `
      <p>Используйте в начале хода. Когда до начала следующего хода ваше заклинание попадает атакой или цель проваливает его спасбросок, цель подсвечивается до начала вашего следующего хода.</p>
      <p>Союзники игнорируют половинное и трёхчетвертное укрытие при атаках заклинаниями и способностях по цели, игнорируют лёгкую заслонённость при её поиске и добавляют уровень Лидера к таким проверкам Восприятия.</p>
    `
  }),
  stratagem({
    key: "stratagem-helping-hand",
    name: "Протянутая рука помощи",
    img: "icons/skills/social/diplomacy-handshake.webp",
    activation: "action",
    rangeValue: 5,
    body: `
      <p>Коснитесь союзника. Он без действия немедленно встаёт либо пытается вырваться из захвата с бонусом, равным вашему уровню Лидера.</p>
      <p>До конца следующего хода цели её спасброски получают бонус 1 + ваш уровень Лидера.</p>
    `
  }),
  stratagem({
    key: "stratagem-hold-the-line",
    name: "Держать строй",
    img: "icons/skills/melee/shield-block-bash-blue.webp",
    activation: "special",
    body: `
      <p>Используйте в начале хода. До начала вашего следующего хода союзники имеют преимущество на атаки возможности по целям в пределах вашей досягаемости рукопашной атаки и добавляют ваш уровень Лидера к урону этих атак.</p>
    `
  }),
  stratagem({
    key: "stratagem-inspiring-word",
    name: "Вдохновляющее слово",
    img: "icons/magic/sonic/projectile-sound-rings-wave.webp",
    activation: "bonus",
    rangeValue: 30,
    rollFormula: "1d4 + floor((2 + floor(@classes.leader.levels / 5)) / 2)",
    activityName: "Вдохновляющее слово: бонусное действие",
    extraActivities: [
      utilityActivity({
        key: "stratagem-inspiring-word-action",
        name: "Вдохновляющее слово: действие",
        activation: "action",
        rangeValue: 30,
        targetType: "creature",
        targetCount: "1",
        rollFormula: "1d4 + @classes.leader.levels + 2 + floor(@classes.leader.levels / 5)",
        rollName: "Вдохновляющее слово",
        rollVisible: true
      })
    ],
    body: `
      <p>Бонусным действием дайте союзнику в пределах 30 футов временные хиты 1к4 + половина вашего бонуса мастерства.</p>
      <p>Вместо этого действием дайте 1к4 + ваш уровень Лидера + ваш бонус мастерства временных хитов. Они исчезают в конце следующего хода цели.</p>
    `,
    automation: "две активности бросают точные формулы для варианта бонусным действием и усиленного варианта действием. Полученные временные хиты применяются к цели вручную."
  }),
  stratagem({
    key: "stratagem-personal-example",
    name: "Личный пример",
    img: "icons/magic/defensive/shield-barrier-flaming-pentagon-red.webp",
    activation: "reaction",
    rangeValue: 60,
    body: `
      <p>Когда вы получаете урон, выберите союзников в пределах 60 футов в количестве, равном уровню Лидера.</p>
      <p>Они получают до конца каждого из их следующих ходов временные хиты, равные половине полученного вами урона, но не больше вашего уровня Лидера.</p>
    `
  }),
  stratagem({
    key: "stratagem-watch-out",
    name: "Берегись!",
    img: "icons/magic/perception/eye-ringed-glow-angry-small-red.webp",
    activation: "action",
    body: `
      <p>Позвольте одному союзнику немедленно использовать действие Уклонение. С 5-го уровня Лидера он также может в начале своего следующего хода реакцией совершить Отход.</p>
    `
  }),
  stratagem({
    key: "stratagem-reinforcement",
    name: "Положительное/отрицательное подкрепление",
    img: "icons/magic/sonic/scream-wail-shout-teal.webp",
    activation: "reaction",
    rangeValue: 60,
    rollFormula: "1d4 + @classes.leader.levels",
    body: `
      <p>Когда союзник наносит урон и союзник либо цель находятся в пределах 60 футов от вас, реакцией увеличьте полученный целью урон на 1к4 + ваш уровень Лидера.</p>
      <p>Кость становится к6 на 3-м уровне и к8 на 5-м.</p>
    `,
    automation: "активность бросает базовую формулу 1к4 + уровень Лидера. На 3-м уровне используйте к6, на 5-м — к8; дополнительный урон применяется вручную."
  }),
  stratagem({
    key: "stratagem-soothing-comfort",
    name: "Утешающий комфорт",
    img: "icons/magic/life/heart-glowing-red.webp",
    activation: "bonus",
    rangeValue: 5,
    body: `
      <p>Коснитесь союзника. До начала вашего следующего хода, когда он бросает кости восстановления хитов, он может максимизировать количество костей, равное вашему уровню Лидера.</p>
    `
  }),
  stratagem({
    key: "stratagem-sound-charge-retreat",
    name: "Протрубить атаку/отступление",
    img: `${WOW}/Miscellaneous/Horn_04.png`,
    activation: "action",
    rangeValue: 30,
    body: `
      <p>Вы и выбранные союзники в пределах 30 футов до начала вашего следующего хода получаете эффект Рывка; вы совершаете Рывок частью этого действия.</p>
      <p>Скорость целей увеличивается на 10 футов, дистанция прыжка в длину удваивается, атаки возможности из-за их перемещения совершаются с помехой. Бонус скорости становится 15 футов на 3-м уровне и 20 футов на 5-м.</p>
    `
  }),
  stratagem({
    key: "stratagem-subtle-misinformation",
    name: "Тонкая дезинформация",
    img: "icons/magic/control/silhouette-hold-change-blue.webp",
    activation: "reaction",
    body: `
      <p>Когда вы наносите существу урон, реакцией выберите союзника в пределах 5 футов от него. Союзник отмечает цель.</p>
      <p>Пока цель находится в пределах досягаемости рукопашной атаки союзника, её атаки не по этому союзнику совершаются с помехой. Эффект заканчивается, если союзник недееспособен, вы умираете или цель отмечает кто-то другой.</p>
    `
  }),
  stratagem({
    key: "stratagem-warlords-strike",
    name: "Удар полководца",
    img: "icons/skills/melee/strike-sword-steel-yellow.webp",
    activation: "action",
    rangeValue: 30,
    body: `
      <p>Один союзник реакцией совершает атаку оружием по выбранному вами видимому существу в пределах 30 футов, добавляя ваш уровень Лидера к броску атаки.</p>
      <p>Если у союзника есть «Дополнительная атака», он также добавляет ваш бонус мастерства к урону.</p>
    `
  }),
  stratagem({
    key: "stratagem-wolf-pack-tactics",
    name: "Тактика волчьей стаи",
    img: "icons/creatures/mammals/wolf-howl-moon-black.webp",
    activation: "action",
    rangeValue: 60,
    body: `
      <p>Один союзник в пределах 60 футов реакцией перемещается на половину скорости, не провоцируя атак возможности. Затем выберите существо в пределах 15 футов от союзника.</p>
      <p>Следующее попадание этого союзника оружием по выбранной цели до начала вашего следующего хода наносит дополнительный урон, равный вашему уровню Лидера + вашему бонусу мастерства.</p>
    `
  })
];

export const LEADER_STRATAGEMS = leaderDocuments
  .filter(document => document.flags?.["the-grimoire-of-grimgutz"]?.stratagem)
  .map(document => document.system.identifier);

export const LEADER_EXPERTISE_BENEFITS = [
  "battlefield-conductor",
  "formation-master",
  "frontline-commander",
  "versatile-communicator"
];

export const LEADER_PRESENCES = [
  "calming-presence",
  "distracting-presence",
  "boisterous-presence",
  "tactical-presence",
  "insightful-presence",
  "inspiring-presence"
];
