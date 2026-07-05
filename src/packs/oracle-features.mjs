import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const SOURCE = "Престиж-класс: Оракул; предоставленный PDF Orakul_-_PK.pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:oracle-features");

export const oracleFolders = [
  folder({ key: "oracle-features", name: "Оракул: классовые особенности", sort: 2620000 })
];

function description(body, automation) {
  return `${body}<hr><p><strong>Автоматизация Foundry:</strong> ${automation}</p>`;
}

function longRestUse(max = "1") {
  return {
    max,
    spent: 0,
    recovery: [{ period: "lr", type: "recoverAll" }]
  };
}

function shortRestUse(max = "1") {
  return {
    max,
    spent: 0,
    recovery: [
      { period: "sr", type: "recoverAll" },
      { period: "lr", type: "recoverAll" }
    ]
  };
}

function oracleFeature({
  key,
  name,
  img,
  level,
  description: value,
  activities = {},
  uses = null,
  automation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Оракул ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    automation: {
      feature: key,
      oracleFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "1–4",
    sourceCustom: SOURCE,
    description: value
  });
}

function fateActivity({
  key,
  name,
  action,
  activation = "reaction",
  condition = "",
  rangeValue = 60,
  dissonance = 0,
  rollFormula = "",
  rollName = ""
}) {
  return utilityActivity({
    key,
    name,
    action,
    actionData: { oracleDissonanceCost: dissonance },
    activation,
    condition,
    rangeValue,
    targetType: "creature",
    targetCount: "1",
    targetChoice: true,
    spellSlot: false,
    rollFormula,
    rollName,
    rollVisible: Boolean(rollFormula)
  });
}

export const oracleDocuments = [
  oracleFeature({
    key: "influence-fates",
    name: "Воздействие на судьбы",
    img: `${WOW}/Miscellaneous/Thread_Eternium.png`,
    level: 1,
    uses: longRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "oracle-sync",
        name: "Синхронизировать Диссонанс",
        action: "sync-oracle-resources",
        activation: "special",
        spellSlot: false
      }),
      ...fateActivity({
        key: "oracle-miss-with-balance",
        name: "Промах: с Балансом судьбы",
        action: "oracle-fate-miss",
        condition: "Существо в 60 футах совершает проверку навыка, спасбросок или атаку"
      }),
      ...fateActivity({
        key: "oracle-miss-with-dissonance",
        name: "Промах: принять Диссонанс",
        action: "oracle-fate-miss",
        condition: "Существо в 60 футах совершает проверку навыка, спасбросок или атаку",
        dissonance: 1
      }),
      ...fateActivity({
        key: "oracle-guidance-with-balance",
        name: "Загадочное руководство: с Балансом",
        action: "oracle-mysterious-guidance",
        condition: "Существо в 60 футах совершает проверку навыка, спасбросок или атаку"
      }),
      ...fateActivity({
        key: "oracle-guidance-with-dissonance",
        name: "Загадочное руководство: принять Диссонанс",
        action: "oracle-mysterious-guidance",
        condition: "Существо в 60 футах совершает проверку навыка, спасбросок или атаку",
        dissonance: 1
      }),
      ...utilityActivity({
        key: "oracle-balancing-ritual",
        name: "Балансирующий ритуал",
        action: "oracle-balancing-ritual",
        activation: "special",
        condition: "Во время короткого отдыха",
        spellSlot: false
      })
    },
    description: description(`
      <p>Вы видите нити судьбы и можете «выщипывать» их, изменяя исходы вокруг себя. Вы можете использовать варианты этой особенности число раз, равное модификатору Мудрости, минимум один раз, и восстанавливаете все использования после длительного отдыха.</p>
      <p><strong>Промах.</strong> Реакцией, когда видимое существо в пределах 60 футов совершает проверку навыка, спасбросок или атаку, наложите на бросок помеху. Баланс судьбы: существо получает бонус к этому броску, равный вашему Балансу судьбы.</p>
      <p><strong>Загадочное руководство.</strong> Реакцией, когда видимое существо в пределах 60 футов совершает проверку навыка, спасбросок или атаку, дайте ему преимущество. Баланс судьбы: существо получает штраф к этому броску, равный вашему Балансу судьбы.</p>
      <p>Вы можете отказаться от Баланса судьбы, получив 1 пункт Диссонанса.</p>
      <h3>Диссонанс</h3>
      <p>Если вы отказываетесь от Баланса судьбы, вы получаете Диссонанс до максимума из таблицы класса. Пока у вас есть Диссонанс, вы получаете штраф ко всем проверкам навыков, спасброскам и броскам атаки, равный текущему Диссонансу. На максимуме вы не можете использовать Воздействие на судьбы и получаете уровень истощения, который снимается только уменьшением Диссонанса.</p>
      <p><strong>Балансирующий ритуал.</strong> Во время короткого отдыха можно обнулить часть Диссонанса ценой для себя или согласного разумного существа: 2к10 психического урона за пункт; потеря текущих и максимальных хитов в размере 3 за пункт до длительного отдыха; слепота/глухота на 2 часа за пункт; уязвимость к дробящему, колющему или рубящему урону на 2 часа за пункт. Только один такой ритуал за короткий или длительный отдых.</p>
    `, "runtime синхронизирует максимум использований по модификатору Мудрости, хранит Диссонанс на актёре, накладывает штраф −Диссонанс к проверкам, спасброскам и атакам, блокирует варианты Воздействия на судьбы на максимуме Диссонанса и выводит точные подсказки Баланса судьбы. Балансирующий ритуал выбирает количество пунктов и цену, затем уменьшает Диссонанс; состояние истощения и условия на согласном существе применяются Мастером.")
  }),
  oracleFeature({
    key: "oracle-first-secret",
    name: "Первый секрет Оракула",
    img: `${WOW}/Spells/MindVision.png`,
    level: 2,
    uses: longRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "oracle-free-scrying",
        name: "Наблюдение без ячейки",
        action: "oracle-free-scrying",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...fateActivity({
        key: "oracle-read-threads",
        name: "Читать нити",
        action: "oracle-read-threads",
        activation: "special",
        condition: "Когда используете Наблюдение или Прорицание с шансом провала",
        rangeValue: null
      })
    },
    description: description(`
      <p>Другой Оракул является вам во снах, пока ваш разум путешествует по Астралу. Вы можете использовать <em>Наблюдение</em> один раз в день без траты ячеек.</p>
      <p><strong>Читать нити.</strong> Вы можете использовать Воздействие на судьбы, когда используете <em>Наблюдение</em> или другое заклинание Прорицания с шансом провала. Для <em>Наблюдения</em> спасбросок Мудрости цели увеличивается на ваш уровень Оракула. Для другого Прорицания шанс провала уменьшается на 25%.</p>
      <p><strong>Баланс судьбы.</strong> Вы получаете 4к8 психического урона. Если заклинание терпит неудачу, вместо этого вы получаете 8к8 психического урона.</p>
    `, "активность Наблюдения тратит ежедневное использование карточки. «Читать нити» тратит общий ресурс Воздействия на судьбы и бросает 4к8; если заклинание провалилось, бросьте 8к8 вручную или перебросьте активность по подсказке.")
  }),
  oracleFeature({
    key: "weaving-connections",
    name: "Переплетение связей",
    img: `${WOW}/Spells/AstralShift.png`,
    level: 3,
    uses: shortRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "oracle-remove-dissonance-slot",
        name: "Снять Диссонанс ячейкой",
        action: "oracle-remove-dissonance-slot",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...utilityActivity({
        key: "oracle-restore-slot-dissonance",
        name: "Восстановить ячейку Диссонансом",
        action: "oracle-restore-slot-dissonance",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      })
    },
    description: description(`
      <p>Действием вы можете потратить ячейку заклинания, чтобы удалить количество пунктов Диссонанса, равное одной трети уровня ячейки с округлением вниз.</p>
      <p>Альтернативно вы можете принять Диссонанс, чтобы восстановить ячейку: 2 пункта Диссонанса за каждый уровень ячейки. Если новый Диссонанс заставит вас достичь максимума, вы должны преуспеть в спасброске Мудрости СЛ 22 или стать ошеломлённым до начала следующего хода.</p>
      <p>После использования этой особенности вы не можете применить её снова до короткого отдыха.</p>
    `, "две активности тратят общее использование особенности. Runtime предлагает уровень ячейки, меняет Диссонанс и выводит напоминание о ячейке/спасброске СЛ 22. Фактическая трата или восстановление системной ячейки выполняется вручную, потому что источник ячейки может быть любым классом.")
  }),
  oracleFeature({
    key: "sense-fate",
    name: "Чувство судьбы",
    img: `${WOW}/Abilities/EyeOfTheOwl.png`,
    level: 4,
    activities: fateActivity({
      key: "oracle-danger",
      name: "Опасность",
      action: "oracle-danger",
      condition: "Реакция на ловушку, заклинание или эффект со спасброском Ловкости",
      rollName: "Баланс судьбы: дополнительный исходный урон"
    }),
    description: description(`
      <p>Вы получаете владение навыком Восприятие, если у вас его ещё нет. Если уже владели Восприятием, удвойте бонус мастерства для него.</p>
      <p>Вы получаете преимущество на спасброски Мудрости, скрывающие ваше местоположение, природу или другую информацию, когда на вас используется магия школы Прорицания.</p>
      <p><strong>Опасность.</strong> Реакцией на ловушку, заклинание или другой эффект, требующий спасброска Ловкости, вы можете получить преимущество на этот спасбросок, если не ослеплены, не оглушены и не недееспособны.</p>
      <p><strong>Баланс судьбы.</strong> Исходный урон эффекта увеличивается на Xк6, где X — ваш Баланс судьбы.</p>
      <p>На 5-м уровне Оракула вы также получаете истинное зрение 30 футов.</p>
    `, "класс выдаёт владение Восприятием через Advancement. Runtime накладывает истинное зрение 30 футов на 5-м уровне. Активность «Опасность» тратит общий ресурс Воздействия на судьбы и бросает Xк6 дополнительного исходного урона по текущему ScaleValue Баланса судьбы; сам спасбросок и контекст Прорицания применяются вручную.")
  }),
  oracleFeature({
    key: "oracle-great-secret",
    name: "Главный секрет оракула",
    img: `${WOW}/Spells/StarFall.png`,
    level: 5,
    uses: longRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "oracle-astral-projection",
        name: "Проекция в астрал без ячейки",
        action: "oracle-astral-projection",
        activation: "action",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...fateActivity({
        key: "oracle-exchange-fates",
        name: "Обменяться судьбами",
        action: "oracle-exchange-fates",
        condition: "Хиты союзника в 60 футах падают до 0"
      }),
      ...fateActivity({
        key: "oracle-exchange-fates-dissonance",
        name: "Обменяться судьбами: принять Диссонанс",
        action: "oracle-exchange-fates",
        condition: "Хиты союзника в 60 футах падают до 0",
        dissonance: 3
      }),
      ...fateActivity({
        key: "oracle-fate-scissors",
        name: "Ножницы судьбы",
        action: "oracle-fate-scissors",
        activation: "action",
        condition: "Живое существо совершает спасбросок Мудрости"
      }),
      ...fateActivity({
        key: "oracle-fate-scissors-dissonance",
        name: "Ножницы судьбы: принять Диссонанс",
        action: "oracle-fate-scissors",
        activation: "action",
        condition: "Живое существо совершает спасбросок Мудрости",
        dissonance: 3
      })
    },
    description: description(`
      <p>Вы изучаете <em>Проекцию в астрал</em> и можете использовать её один раз в день без траты ячейки и компонентов.</p>
      <p><strong>Обменяться судьбами.</strong> Когда хиты союзного существа в пределах 60 футов падают до 0, вы отдаёте все текущие хиты этому существу; избыток становится временными хитами, а сами падаете до 0 хитов. Если отказаться от Баланса судьбы, вы получаете 3 Диссонанса.</p>
      <p><strong>Баланс судьбы.</strong> Вы автоматически проваливаете один спасбросок от смерти и получаете помеху на несколько следующих спасбросков от смерти, равное вашему Балансу судьбы.</p>
      <p><strong>Ножницы судьбы.</strong> Действием вы захватываете нить судьбы живого существа. Оно совершает спасбросок Мудрости или получает 10к10 психического урона. Если эта атака снижает хиты существа до 0, оно немедленно умирает. Если отказаться от Баланса судьбы, вы получаете 3 Диссонанса.</p>
      <p><strong>Баланс судьбы.</strong> Ваш максимум хитов уменьшается на половину нанесённого урона до длительного отдыха. Если цель погибла от атаки, максимум уменьшается на количество хитов цели перед смертью.</p>
    `, "Проекция в астрал тратит ежедневное использование карточки. Варианты Воздействия тратят общий ресурс Воздействия на судьбы, добавляют 3 Диссонанса при вариантах без Баланса и выводят СЛ/напоминания. Ножницы судьбы бросают 10к10 психического урона; смерть цели и снижение максимума хитов применяются вручную.")
  })
];
