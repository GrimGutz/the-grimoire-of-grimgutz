import {
  activeEffect,
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Подкласс волшебника: Школа стали; предоставленный PDF Wizzard_School_of_Steel (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:school-of-steel-features");
const SIGNATURE_FOLDER = idFor("folder:school-of-steel-signatures");

export const SCHOOL_OF_STEEL_SIGNATURES = [
  "steel-storm",
  "steel-imperial-reach",
  "steel-metalist"
];

export const schoolOfSteelFolders = [
  folder({ key: "school-of-steel-features", name: "Школа стали: особенности", sort: 1600000 }),
  folder({ key: "school-of-steel-signatures", name: "Школа стали: фирменные приёмы", sort: 1610000 })
];

function activities(...entries) {
  return Object.assign({}, ...entries);
}

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function schoolFeature(options) {
  return feature({
    ...options,
    folder: options.folder ?? MAIN_FOLDER,
    sourcePage: options.sourcePage ?? "1–2",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      schoolOfSteelFeature: true,
      ...(options.automation ?? {})
    }
  });
}

export const schoolOfSteelDocuments = [
  schoolFeature({
    key: "steel-battle-training",
    name: "Боевая тренировка",
    img: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
    level: 2,
    requirements: "Волшебник 2; Школа стали",
    uses: {
      max: "1",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: activities(
      utilityActivity({
        key: "steel-battle-training-choose",
        name: "Зачаровать оружие",
        action: "school-steel-choose-weapons",
        activation: "special",
        condition: "В конце продолжительного отдыха"
      }),
      utilityActivity({
        key: "steel-battle-training-bonus-attack",
        name: "Бонусная атака зачарованным оружием",
        action: "school-steel-bonus-attack",
        activation: "bonus",
        condition: "В свой ход, зачарованным оружием",
        consumeItemUse: true
      })
    ),
    description: description(`
      <p>Вы получаете владение воинским оружием.</p>
      <p>Когда вы оканчиваете продолжительный отдых, вы можете выбрать одно оружие, которым владеете, и зачаровать его, частично анимируя. Это зачарование длится до окончания вашего следующего продолжительного отдыха или пока вы не используете эту особенность снова. Выбранное оружие считается вашим зачарованным оружием для особенностей этого подкласса.</p>
      <p>Когда вы совершаете атаку зачарованным оружием, вы можете использовать модификатор Интеллекта вместо модификатора Силы или Ловкости для бросков атаки и урона этой атаки. Если вы делаете это, вы игнорируете свойство тяжёлое этого оружия, вам не нужно держать его в руках для совершения этой атаки, а ваша досягаемость для этой атаки увеличивается на 10 футов. На 10-м уровне это увеличение становится 20 футов.</p>
      <p>Кроме того, в свой ход вы можете бонусным действием совершить одну атаку зачарованным оружием. Вы можете использовать это бонусное действие количество раз, равное вашему модификатору Интеллекта, минимум один раз, и восстанавливаете все использования после продолжительного отдыха.</p>
    `, "Advancement подкласса выдаёт владение воинским оружием. Действие «Зачаровать оружие» сохраняет выбранное оружие на персонаже. Ресурс бонусной атаки автоматически синхронизируется с модификатором Интеллекта, минимум 1, и тратится действием «Бонусная атака зачарованным оружием». Замена характеристики атаки/урона на Интеллект и увеличение досягаемости применяются на выбранной карточке оружия вручную, потому что dnd5e не даёт безопасно временно переписать эти поля без изменения самого предмета.")
  }),
  schoolFeature({
    key: "steel-crippling-strikes",
    name: "Калечащие удары",
    img: "icons/skills/wounds/blood-spurt-spray-red.webp",
    level: 6,
    requirements: "Волшебник 6; Школа стали",
    activities: utilityActivity({
      key: "steel-crippling-strikes-damage",
      name: "Дополнительный урон Калечащих ударов",
      activation: "special",
      condition: "Следующая атака, попавшая по существу до начала вашего следующего хода",
      rollFormula: "1d4",
      rollName: "Калечащие удары",
      rollVisible: true
    }),
    description: description(`
      <p>Когда вы в свой ход совершаете действие Атака, вы можете совершить одну дополнительную атаку своим зачарованным оружием.</p>
      <p>Кроме того, когда вы попадаете по существу атакой оружием, следующая атака, попавшая по этому существу до начала вашего следующего хода, наносит ему дополнительно 1к4 урона того же типа, что и атака, вызвавшая этот эффект.</p>
    `, "карточка содержит бросок 1к4 для дополнительного урона. Автоматическое определение «следующей атаки по той же цели» не включено, чтобы не ошибаться при нескольких целях и разных типах урона; бросок применяется вручную к нужному попаданию.")
  }),
  schoolFeature({
    key: "steel-master-of-metal",
    name: "Мастер металла",
    img: `${WOW}/Spells/BladedArmor.png`,
    level: 10,
    requirements: "Волшебник 10; Школа стали",
    activities: utilityActivity({
      key: "steel-master-of-metal-sync",
      name: "Синхронизировать Школу стали",
      action: "sync-school-steel",
      activation: "special"
    }),
    description: description(`
      <p>Заклинание Оживление предметов всегда считается подготовленным для вас и не учитывается в количестве заклинаний, которые вы можете подготовить.</p>
      <p>Когда вы накладываете Оживление предметов, вам не требуется использовать бонусное действие для отдачи команд оживлённым объектам.</p>
      <p>Кроме того, если все объекты, оживлённые этим заклинанием, сделаны из металла, заклинание считается наложенным с использованием ячейки на один уровень выше фактически потраченной ячейки.</p>
      <p>Увеличение досягаемости от вашей особенности Боевая тренировка становится 20 футов вместо 10 футов.</p>
    `, "подкласс выдаёт системное заклинание Оживление предметов на 10-м уровне, а синк модуля пытается держать его подготовленным. Команды оживлённым объектам без бонусного действия и повышенный уровень ячейки для металлических объектов отмечаются как правило на карточке заклинания/сцены.")
  }),
  schoolFeature({
    key: "steel-signature-technique",
    name: "Фирменный приём",
    img: "icons/skills/melee/sword-twirl-orange.webp",
    level: 14,
    requirements: "Волшебник 14; Школа стали",
    description: description(`
      <p>Когда вы используете свою особенность Боевая тренировка в конце продолжительного отдыха, вы можете зачаровать до трёх разных оружий вместо одного.</p>
      <p>Кроме того, выберите один фирменный приём: Стальной шторм, Имперская досягаемость или Металлист.</p>
    `, "Advancement подкласса выдаёт эту карточку и открывает выбор одного из трёх фирменных приёмов. После получения этой особенности действие «Зачаровать оружие» позволяет выбрать до трёх оружий.")
  }),
  schoolFeature({
    key: "steel-storm",
    name: "Стальной шторм",
    img: "icons/skills/melee/sword-twirl-orange.webp",
    requirements: "Волшебник 14; Школа стали; Фирменный приём",
    folder: SIGNATURE_FOLDER,
    automation: { schoolOfSteelSignature: true },
    activities: utilityActivity({
      key: "steel-storm-extra-attack",
      name: "Дополнительная атака Стального шторма",
      activation: "special",
      condition: "В свой ход вы совершили три атаки разными зачарованными оружиями"
    }),
    description: description(`
      <p>Если в свой ход вы совершили три атаки разными зачарованными оружиями, вы можете совершить одну дополнительную атаку зачарованным оружием. Вы не добавляете модификатор Интеллекта к урону этой дополнительной атаки, если только этот модификатор не является отрицательным.</p>
      <p>Кроме того, если у вас не осталось использований бонусной атаки от особенности Боевая тренировка, вы можете потратить одну ячейку заклинаний, чтобы использовать её ещё раз.</p>
    `, "карточка отмечает дополнительную атаку. Проверка «три атаки разными оружиями» и трата ячейки вместо ресурса остаются ручными, потому что dnd5e/Midi-QOL не дают надёжно определить историю оружий в текущем ходу без ложных срабатываний.")
  }),
  schoolFeature({
    key: "steel-imperial-reach",
    name: "Имперская досягаемость",
    img: "icons/magic/control/silhouette-aura-energy.webp",
    requirements: "Волшебник 14; Школа стали; Фирменный приём",
    folder: SIGNATURE_FOLDER,
    automation: { schoolOfSteelSignature: true },
    description: description(`
      <p>Увеличение досягаемости от вашей особенности Боевая тренировка становится 60 футов.</p>
      <p>Кроме того, когда вы накладываете заклинание с дистанцией Касание, вы можете наложить его на цель в пределах 60 футов от вас.</p>
    `, "постоянный Active Effect не добавлен намеренно: глобальное изменение дальности сломало бы заклинания, которые не являются касательными. Используйте это как правило при выборе цели касательного заклинания.")
  }),
  schoolFeature({
    key: "steel-metalist",
    name: "Металлист",
    img: `${WOW}/Spells/BladedArmor.png`,
    requirements: "Волшебник 14; Школа стали; Фирменный приём",
    folder: SIGNATURE_FOLDER,
    automation: { schoolOfSteelSignature: true },
    effects: [activeEffect({
      key: "steel-metalist-heavy-armor",
      name: "Металлист",
      img: `${WOW}/Spells/BladedArmor.png`,
      changes: [{ key: "system.traits.armorProf.value", type: "custom", value: "hvy", priority: 20 }]
    })],
    description: description(`
      <p>Увеличение досягаемости от вашей особенности Боевая тренировка становится 5 футов вместо 20 футов.</p>
      <p>Вы получаете владение тяжёлыми доспехами. Кроме того, ношение тяжёлого доспеха не уменьшает вашу скорость, даже если ваше значение Силы ниже требуемого для этого доспеха.</p>
    `, "пассивный эффект добавляет владение тяжёлыми доспехами. Отмена штрафа скорости от недостаточной Силы описана на карточке как условное правило; постоянный бонус скорости не добавляется, чтобы не давать лишнюю скорость вне тяжёлого доспеха.")
  })
];
