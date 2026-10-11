import {
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Ведьмин клинок; предоставленный PDF PK_WitchBlade (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:witch-blade-features");
const DESIGN_FOLDER = idFor("folder:witch-blade-great-designs");

export const WITCH_BLADE_GREAT_DESIGNS = [
  "ethereal-wind",
  "hardened-mind",
  "witch-crystallization",
  "ethereal-push",
  "sorcerer-bastion",
  "ethereal-storm"
];

export const witchBladeFolders = [
  folder({ key: "witch-blade-features", name: "Ведьмин клинок: классовые особенности", sort: 1500000 }),
  folder({ key: "witch-blade-great-designs", name: "Ведьмин клинок: Великий замысел", sort: 1510000 })
];

function activities(...entries) {
  return Object.assign({}, ...entries);
}

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function witchBladeFeature(options) {
  return feature({
    ...options,
    folder: options.folder ?? MAIN_FOLDER,
    sourcePage: options.sourcePage ?? "1–3",
    sourceCustom: SOURCE,
    automation: {
      feature: options.key,
      witchBladeFeature: true,
      ...(options.automation ?? {})
    }
  });
}

function spendRageActivity({ key, name, action = "use-witch-blade-rage", activation = "special", condition = "", cost = 1, rangeValue = null, targetType = "", targetCount = "", targetChoice = false, rollFormula = "", rollName = name }) {
  return utilityActivity({
    key,
    name,
    action,
    actionData: { witchBladeRageCost: cost },
    activation,
    condition,
    rangeValue,
    targetType,
    targetCount,
    targetChoice,
    rollFormula,
    rollName,
    rollVisible: Boolean(rollFormula)
  });
}

export const witchBladeDocuments = [
  witchBladeFeature({
    key: "witch-blade-spellcasting",
    name: "Чародейство",
    img: `${WOW}/Spells/ArcaneIntellect.png`,
    level: 1,
    requirements: "Ведьмин клинок 1",
    activities: utilityActivity({
      key: "witch-blade-spell-slots",
      name: "Таблица ячеек Ведьминого клинка",
      activation: "special"
    }),
    description: description(`
      <p>Вы усиливаете воинское мастерство чародейством. Вы знаете четыре заклинания волшебника 1-го или 2-го уровня по вашему выбору либо заклинания Ведьминого клинка из этого модуля. При повышении уровня Ведьминого клинка вы можете заменить одно известное заклинание доступного уровня.</p>
      <p><strong>Характеристика чародейства:</strong> Интеллект. <strong>Сл спасброска:</strong> 8 + бонус мастерства + модификатор Интеллекта. <strong>Атака заклинанием:</strong> бонус мастерства + модификатор Интеллекта.</p>
      <table><thead><tr><th>Уровень</th><th>Известные</th><th>1-й</th><th>2-й</th><th>3-й</th><th>4-й</th><th>5-й</th></tr></thead><tbody>
        <tr><td>1</td><td>4</td><td>3</td><td>3</td><td>—</td><td>—</td><td>—</td></tr>
        <tr><td>2</td><td>5</td><td>4</td><td>4</td><td>—</td><td>—</td><td>—</td></tr>
        <tr><td>3</td><td>6</td><td>5</td><td>5</td><td>3</td><td>—</td><td>—</td></tr>
        <tr><td>4</td><td>7</td><td>6</td><td>5</td><td>4</td><td>3</td><td>—</td></tr>
        <tr><td>5</td><td>8</td><td>7</td><td>5</td><td>4</td><td>3</td><td>2</td></tr>
      </tbody></table>
    `, "класс добавляет ScaleValue для известных заклинаний и каждой строки ячеек. У dnd5e нет штатной прогрессии с этой нестандартной таблицей, поэтому ячейки отслеживаются по таблице/ScaleValue, а не через обычную прогрессию заклинателя.")
  }),
  witchBladeFeature({
    key: "witch-hunter",
    name: "Охотник на ведьм",
    img: `${WOW}/Spells/ConsumeMagic.png`,
    level: 1,
    requirements: "Ведьмин клинок 1",
    uses: {
      max: "@scale.witch-blade.rage-points",
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    },
    activities: activities(
      spendRageActivity({ key: "witch-hunter-empower", name: "Вспыхивающее оружие", action: "activate-witch-hunter-empower", activation: "bonus", cost: 1 }),
      utilityActivity({
        key: "witch-hunter-slot-damage",
        name: "Дополнительный урон ячейкой",
        activation: "special",
        condition: "После первого попадания усиленным рукопашным оружием",
        rollFormula: "1d6",
        rollName: "Урон за 1 уровень потраченной ячейки",
        rollVisible: true
      })
    ),
    description: description(`
      <p>Вы получаете пул Очков Гнева по таблице Ведьминого клинка и восстанавливаете все потраченные Очки Гнева после продолжительного отдыха.</p>
      <p>Потратьте 1 Очко Гнева, чтобы оружие вспыхнуло магической энергией. В этом состоянии вы получаете преимущество на атаки оружием против существ, у которых есть ячейки заклинаний.</p>
      <p>Первый раз, когда вы успешно попадаете усиленным рукопашным оружием, вы можете потратить ячейку заклинания и нанести дополнительный урон: число к6 равно уровню потраченной ячейки. Для доброго мировоззрения это урон излучением; для злого — некротический урон.</p>
    `, "карточка хранит общий пул Очков Гнева. Модуль синхронизирует максимум по уровню Ведьминого клинка и списывает Очки Гнева с этой карточки при использовании активностей Witch Blade. «Вспыхивающее оружие» создаёт 1-минутный weapon-buff: атаки оружием получают преимущество против выбранных целей с ячейками заклинаний.")
  }),
  witchBladeFeature({
    key: "dead-zone",
    name: "Мертвая зона",
    img: `${WOW}/Spells/AntiMagicZone.png`,
    level: 2,
    requirements: "Ведьмин клинок 2",
    activities: spendRageActivity({ key: "dead-zone", name: "Создать мертвую зону", activation: "action", cost: 1, rangeValue: 60, targetType: "space", targetCount: "1" }),
    description: description(`
      <p>Обнаружение магии, Рассеивание магии и Контрзаклинание добавляются в ваш список известных заклинаний.</p>
      <p>Действием вы можете потратить 1 Очко Гнева, выбрать уровень ячейки заклинания для траты и создать магическую мертвую зону. Все заклинания этого уровня или ниже, накладываемые в пределах 60 футов от вас, автоматически проваливаются, как если бы на них успешно подействовало Контрзаклинание. Вы можете назначить союзников, иммунных к этому эффекту.</p>
    `, "активность списывает 1 Очко Гнева с «Охотника на ведьм». Уровень ячейки, расход ячейки и список союзников выбираются вручную.")
  }),
  witchBladeFeature({
    key: "witch-blade-seal",
    name: "Печать Ведьминого клинка",
    img: "icons/magic/symbols/rune-sigil-horned-blue.webp",
    level: 3,
    requirements: "Ведьмин клинок 3",
    activities: activities(
      spendRageActivity({ key: "witch-blade-seal-lawful", name: "Печать: Законный", activation: "action", cost: 1, rangeValue: 60, targetType: "creature", targetCount: "1", targetChoice: true }),
      spendRageActivity({ key: "witch-blade-seal-good", name: "Печать: Добрый", activation: "action", cost: 1, rangeValue: 60, targetType: "creature", targetCount: "1", targetChoice: true, rollFormula: "2d8", rollName: "Исцеление Печати" }),
      spendRageActivity({ key: "witch-blade-seal-chaotic", name: "Печать: Хаотичный", activation: "action", cost: 1, rangeValue: 60 }),
      spendRageActivity({ key: "witch-blade-seal-evil", name: "Печать: Злой", action: "use-witch-blade-seal-evil", activation: "action", cost: 1, targetType: "creature", targetChoice: true }),
      spendRageActivity({ key: "witch-blade-seal-neutral", name: "Печать: Нейтральный", activation: "action", cost: 1 })
    ),
    description: description(`
      <p>В зависимости от мировоззрения вы можете потратить 1 Очко Гнева, чтобы использовать один эффект.</p>
      <ul>
        <li><strong>Законный:</strong> выбранный враг совершает спасбросок Мудрости против вашей Сл заклинаний; при провале на него действует Приказ.</li>
        <li><strong>Добрый:</strong> выбранное существо восстанавливает 2к8 хитов. Если у него меньше четверти максимума хитов, атаки по нему совершаются с помехой 1 раунд.</li>
        <li><strong>Хаотичный:</strong> совершите бросок по таблице Дикой магии для каждого существа в пределах 60 футов.</li>
        <li><strong>Злой:</strong> все существа в 30-футовом конусе совершают спасбросок Харизмы; при провале они ошеломлены на 1 раунд.</li>
        <li><strong>Нейтральный:</strong> вы создаёте круг защиты от добра и зла с центром в вашем местоположении.</li>
      </ul>
    `, "активности списывают Очки Гнева. Злая Печать открывает размещение 30-футового конуса с началом на вашем токене; Midi-QOL выбирает существ в конусе и проводит спасброски Харизмы. Состояние Ошеломлён применяется только при провале, на один раунд. Не выбирайте провалившихся вручную. Отмена шаблона не тратит Гнев. Исцеление доброй Печати бросается автоматически; остальные варианты подтверждаются по ситуации.")
  }),
  witchBladeFeature({
    key: "great-design",
    name: "Великий замысел",
    img: `${WOW}/Spells/ArcanePotency.png`,
    level: 4,
    requirements: "Ведьмин клинок 4",
    description: description("<p>Выберите один боевой стиль Ведьминого клинка: Эфирный ветер, Закаленный разум, Колдовская кристаллизация, Эфирный толчок, Бастион чародея или Эфирная буря.</p>", "выбор боевого стиля встроен в Advancement класса.")
  }),
  witchBladeFeature({
    key: "ethereal-wind",
    name: "Эфирный ветер",
    img: `${WOW}/Spells/ArcticWinds.png`,
    requirements: "Ведьмин клинок 4; Великий замысел",
    folder: DESIGN_FOLDER,
    automation: { greatDesign: true },
    activities: utilityActivity({ key: "ethereal-wind", name: "Вложить заклинание в боеприпас", activation: "bonus", targetType: "creature", targetCount: "1", targetChoice: true }),
    description: description("<p>Когда вы совершаете атаку дальнобойным оружием, вы можете потратить бонусное действие, чтобы применить эффекты наносящего урон заклинания, нацеленного на существо, к боеприпасу. При попадании атаки заклинание применяется к цели.</p>", "активность отмечает бонусное действие; само заклинание и атака бросаются соответствующими карточками.")
  }),
  witchBladeFeature({
    key: "hardened-mind",
    name: "Закаленный разум",
    img: `${WOW}/Spells/ArcaneResilience.png`,
    requirements: "Ведьмин клинок 4; Великий замысел",
    folder: DESIGN_FOLDER,
    automation: { greatDesign: true },
    description: description("<p>Пока вы носите доспехи, вы имеете преимущество на спасброски Интеллекта, Мудрости и Харизмы против магических эффектов.</p>", "пассивный бонус не накладывает постоянный Active Effect, чтобы не давать лишнее преимущество на немагические спасброски. Используйте преимущество в окне броска, когда условие выполнено.")
  }),
  witchBladeFeature({
    key: "witch-crystallization",
    name: "Колдовская кристаллизация",
    img: `${WOW}/Spells/CrystalBall.png`,
    requirements: "Ведьмин клинок 4; Великий замысел",
    folder: DESIGN_FOLDER,
    automation: { greatDesign: true },
    activities: utilityActivity({ key: "witch-crystallization", name: "Покрыть оружие кристаллом", action: "activate-witch-crystallization", activation: "special", condition: "Держите рукопашное оружие в одной руке и не держите другое оружие" }),
    description: description("<p>Когда вы держите рукопашное оружие в одной руке и не держите другое оружие, вы можете потратить ячейку заклинания, чтобы покрыть оружие кристаллом. Результат критического удара уменьшается на 1 за каждые два уровня потраченной ячейки.</p>", "выберите конкретное рукопашное оружие и доступную обычную или договорную ячейку. Ячейка списывается штатно только после подтверждения. Критический порог снижается на floor(уровень ячейки / 2) только для выбранного оружия, сохраняя более выгодный порог. Срок 1 минута — домашнее правило мира, в PDF срок не указан. Ячейка первого круга не создаёт пустой эффект. Условие одной руки подтверждается владельцем; отмена выбора не тратит ячейку.")
  }),
  witchBladeFeature({
    key: "ethereal-push",
    name: "Эфирный толчок",
    img: `${WOW}/Abilities/ArcaneBarrage.png`,
    requirements: "Ведьмин клинок 4; Великий замысел",
    folder: DESIGN_FOLDER,
    automation: { greatDesign: true },
    activities: spendRageActivity({ key: "ethereal-push", name: "Высвободить эфирный толчок", activation: "bonus", condition: "Когда вы промахиваетесь двуручным рукопашным оружием", cost: 1, rollFormula: "1d8", rollName: "Замените на урон оружия" }),
    description: description("<p>Когда вы промахиваетесь двуручным рукопашным оружием, вы можете потратить бонусное действие и 1 Очко Гнева. Все существа в 30-футовом конусе с центром на враге должны преуспеть в спасброске Ловкости или получить психический урон, как если бы были поражены вашим оружием.</p>", "активность списывает 1 Очко Гнева. Формулу урона замените на урон используемого оружия.")
  }),
  witchBladeFeature({
    key: "sorcerer-bastion",
    name: "Бастион чародея",
    img: `${WOW}/Spells/AvengersShield.png`,
    requirements: "Ведьмин клинок 4; Великий замысел; владение щитами",
    folder: DESIGN_FOLDER,
    automation: { greatDesign: true },
    activities: utilityActivity({ key: "sorcerer-bastion", name: "Отразить заклинание щитом", activation: "reaction", condition: "Существо в 5 футах от вас становится целью заклинания; вы держите щит", rangeValue: 5, targetType: "creature", targetCount: "1", targetChoice: true, rollFormula: "1d6", rollName: "Урон силовым полем за уровень заклинания", rollVisible: true }),
    description: description("<p><strong>Требование:</strong> владение щитами. Когда существо, которое вы видите, накладывает заклинание на цель, отличную от вас, в пределах 5 футов от вас, вы можете реакцией самостоятельно совершить спасбросок от этого заклинания. При успехе заклинание отражается, нанося заклинателю урон силовым полем, равный уровню заклинания × 1к6.</p>", "активность отмечает реакцию и бросает 1к6 как единицу урона; спасбросок и множитель уровня заклинания применяются вручную.")
  }),
  witchBladeFeature({
    key: "ethereal-storm",
    name: "Эфирная буря",
    img: `${WOW}/Abilities/Bladestorm.png`,
    requirements: "Ведьмин клинок 4; Великий замысел",
    folder: DESIGN_FOLDER,
    automation: { greatDesign: true },
    activities: spendRageActivity({ key: "ethereal-storm", name: "Удлинить клинки эфирной бурей", action: "activate-ethereal-storm", activation: "special", condition: "Когда вы сражаетесь двумя оружиями", cost: 1 }),
    description: description("<p>Когда вы сражаетесь двумя оружиями, вы можете потратить 1 Очко Гнева, чтобы увеличить досягаемость вашего оружия до 30 футов. Эти лезвия наносят урон так, как если бы оружие поразило врага.</p>", "выберите пару оружий и подтвердите сражение двумя оружиями. После выбора штатно списывается 1 Очко Гнева. Досягаемость выбранной пары в нативном применении увеличивается до 30 футов; другие оружия и листы не переписываются. Срок 1 минута — домашнее правило мира, в PDF срок не указан.")
  }),
  witchBladeFeature({
    key: "immaterial-whirlwind",
    name: "Нематериальный вихрь",
    img: `${WOW}/Spells/ArcaneTorrent.png`,
    level: 5,
    requirements: "Ведьмин клинок 5",
    activities: spendRageActivity({ key: "immaterial-whirlwind", name: "Открыть Нематериальный вихрь", action: "open-immaterial-whirlwind", activation: "action", cost: 3 }),
    description: description("<p>Действием вы можете потратить 3 Очка Гнева и обозначить куб со стороной 5 футов. Сырая энергия опустошает всех существ и безнадзорные предметы в радиусе 30 футов. Существо в области совершает спасбросок Ловкости или получает 8к8 урона того же типа, что и дайс Охотника на ведьм: излучение для Добра или некротический урон для Зла. Зона длится до 1 минуты с концентрацией; существо, закончившее ход в Вихре, снова совершает спасбросок.</p>", "разместите шаблон радиусом 30 футов. Midi-QOL проводит первоначальные и повторные спасброски Ловкости в конце хода существ внутри области: 8к8 выбранного типа при провале, без урона при успехе. Повторный расход Гнева, действия или ячейки отсутствует. Поддерживаются бои без привязки к сцене. Движение само по себе не наносит урон; потеря концентрации и окончание минуты прекращают срабатывания. Отмена размещения не тратит ресурс.")
  })
];
