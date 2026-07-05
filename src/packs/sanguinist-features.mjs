import {
  feature,
  folder,
  idFor,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Сангвинист; предоставленный PDF САНГВИНИСТ_PK (1).pdf";
const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const MAIN_FOLDER = idFor("folder:sanguinist-features");
const COMPATIBILITY_FOLDER = idFor("folder:sanguinist-compatibility");
const MASTERY_FOLDER = idFor("folder:sanguinist-crimson-mastery");

export const sanguinistFolders = [
  folder({ key: "sanguinist-features", name: "Сангвинист: классовые особенности", sort: 2640000 }),
  folder({ key: "sanguinist-compatibility", name: "Сангвинист: кровавая совместимость", sort: 2641000 }),
  folder({ key: "sanguinist-crimson-mastery", name: "Сангвинист: багровое мастерство", sort: 2642000 })
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

function sanguinistFeature({
  key,
  name,
  img,
  level,
  description: value,
  uses = null,
  activities = {},
  folderId = MAIN_FOLDER,
  automation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Сангвинист ${level}`,
    folder: folderId,
    uses,
    activities,
    automation: {
      feature: key,
      sanguinistFeature: true,
      minimumLevel: level,
      ...automation
    },
    sourcePage: "1–5",
    sourceCustom: SOURCE,
    description: value
  });
}

function masteryFeature({ key, name, img, description: value, activities }) {
  return sanguinistFeature({
    key,
    name,
    img,
    level: 5,
    folderId: MASTERY_FOLDER,
    activities,
    automation: {
      crimsonMastery: true
    },
    description: value
  });
}

export const sanguinistDocuments = [
  sanguinistFeature({
    key: "sanguinist-blood-magic",
    name: "Кровавая магия",
    img: `${WOW}/Spells/BloodTap.png`,
    level: 1,
    uses: longRestUse("2"),
    activities: {
      ...utilityActivity({
        key: "sync-sanguinist-resources",
        name: "Синхронизировать кровь",
        action: "sync-sanguinist-resources",
        activation: "special",
        spellSlot: false
      }),
      ...utilityActivity({
        key: "gain-sanguinist-blood-point",
        name: "Получить 1 единицу крови",
        action: "gain-sanguinist-blood-point",
        activation: "special",
        condition: "Существо с кровью провалило спасбросок/получило урон от Кровавого заклинания или упало до 0 хитов в 60 футах",
        consumeItemUse: true,
        spellSlot: false
      }),
      ...utilityActivity({
        key: "spend-sanguinist-blood-points",
        name: "Потратить кровь на заклинание",
        action: "spend-sanguinist-blood-points",
        activation: "special",
        spellSlot: false
      })
    },
    description: description(`
      <p>Когда существо с кровью проваливает спасбросок от вашего Кровавого заклинания, получает от него урон или существо с кровью в пределах 60 футов от вас уменьшается до 0 хитов, вы можете получить 1 единицу крови.</p>
      <p>Количество получений крови за продолжительный отдых зависит от уровня Сангвиниста: 2/3/5/7/10. Когда вы заканчиваете короткий или продолжительный отдых, вы теряете все неизрасходованные единицы крови.</p>
      <p>Когда вы накладываете заклинание 5-го уровня или ниже, вы можете потратить единицы крови вместо ячейки заклинания. Нужно потратить как минимум столько единиц крови, каков уровень заклинания. Заклинание считается Кровавым.</p>
      <p>Такое заклинание не может возвращать мёртвых к жизни. Если оно не некромантия, оно не восстанавливает хиты, а даёт временные хиты, равные половине обычного лечения.</p>
    `, "активность синхронизации выставляет число использований по уровню класса. «Получить 1 единицу крови» тратит одно использование Кровавой магии и увеличивает текущий запас единиц крови на актёре. «Потратить кровь» открывает выбор количества и уменьшает текущий запас, выводя правило заклинания в чат.")
  }),
  sanguinistFeature({
    key: "hematurgy",
    name: "Гематургия",
    img: `${WOW}/Spells/BloodBoil.png`,
    level: 1,
    activities: utilityActivity({
      key: "use-hematurgy",
      name: "Использовать Гематургию",
      action: "use-hematurgy",
      activation: "bonus",
      spellSlot: false
    }),
    description: description(`
      <p>Бонусным действием вы можете пролить свою кровь и потратить до 5 оставшихся костей хитов. Вместо исцеления вы получаете 1к8 некротического урона за каждую потраченную кость хитов, игнорируя сопротивление и иммунитет. Этот урон не вызывает спасбросков концентрации.</p>
      <p>Следующее заклинание, которое вы наложите в этом ходу, считается Кровавым заклинанием и не требует ячейки, если его уровень не выше числа потраченных костей хитов. Заклинание с временем накладывания 1 бонусное действие можно наложить как часть использования этой особенности.</p>
      <p>Вы не можете использовать Гематургию для заклинания уровня выше доступных вам ячеек и не можете потратить больше костей хитов, чем двукратный уровень Сангвиниста, до продолжительного отдыха.</p>
    `, "активность предлагает выбрать число костей, бросает/применяет самоповреждение 1к8 за кость, запоминает число потраченных костей до продолжительного отдыха и выводит лимит уровня следующего заклинания. Фактическое списание костей хитов на листе подтверждается игроком.")
  }),
  sanguinistFeature({
    key: "sanguinist-spellcasting",
    name: "Накладывание заклинаний",
    img: `${WOW}/Spells/MoltenBlood.png`,
    level: 1,
    activities: utilityActivity({
      key: "show-sanguinist-spellcasting",
      name: "Показать параметры заклинаний",
      action: "show-sanguinist-spellcasting",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Вы знаете заговоры <em>Гемокинез</em> и <em>Предотвращение смерти</em>. Если уже знаете один из них, выберите вместо него другой Кровавый заговор.</p>
      <p>Сангвинист использует собственную таблицу ячеек 1–3 круга и знает 2/2/3/3/4 Кровавых заклинаний. Эти заклинания выбираются из списка заклинаний любого класса, должны быть уровней, для которых у вас есть ячейки, и считаются заклинаниями Сангвиниста.</p>
      <p>Характеристика заклинаний Сангвиниста — любая характеристика, которую уже использует ваше Накладывание заклинаний или Договор магии; если вариантов несколько, используется самая высокая.</p>
    `, "ячейки и известные заклинания добавлены как ScaleValue класса. Активность выводит текущую рекомендуемую характеристику, СЛ и модификатор атаки заклинанием.")
  }),
  sanguinistFeature({
    key: "student-of-blood",
    name: "Ученик крови",
    img: `${WOW}/Abilities/BloodyEye.png`,
    level: 1,
    activities: {
      ...utilityActivity({
        key: "cast-blood-reading",
        name: "Чтение крови",
        action: "cast-blood-reading",
        activation: "action",
        spellSlot: false
      }),
      ...utilityActivity({
        key: "mark-sanguinist-blood-spell",
        name: "Сделать заклинание Кровавым",
        action: "mark-sanguinist-blood-spell",
        activation: "special",
        spellSlot: false
      })
    },
    description: description(`
      <p>Вы можете накладывать <em>Чтение крови</em> как заклинание Сангвиниста без траты ячейки, даже если не знаете это заклинание.</p>
      <p>Кроме того, всякий раз, когда вы накладываете заклинание, вы можете изменить его, заставив считаться Кровавым заклинанием в дополнение к другим школам.</p>
      <p>Вы можете накладывать <em>Чтение крови</em> число раз, равное уровню Сангвиниста, и изменять заклинание число раз, равное бонусу мастерства. Использования восстанавливаются после продолжительного отдыха.</p>
    `, "модуль хранит отдельные счётчики использований для «Чтения крови» и изменения школы заклинания, проверяет лимиты по уровню Сангвиниста и бонусу мастерства и сбрасывает их после продолжительного отдыха.")
  }),
  sanguinistFeature({
    key: "sanguine-power",
    name: "Багровая сила",
    img: `${WOW}/Abilities/Bloodsurge.png`,
    level: 2,
    activities: {
      ...utilityActivity({
        key: "sanguine-power-hit-die",
        name: "Багровая сила: кость хитов",
        action: "sanguine-power-hit-die",
        activation: "special",
        spellSlot: false
      }),
      ...utilityActivity({
        key: "sanguine-power-blood-point",
        name: "Багровая сила: единица крови",
        action: "sanguine-power-blood-point",
        activation: "special",
        spellSlot: false
      })
    },
    description: description(`
      <p>Всякий раз, когда вы накладываете заклинание, вы можете потратить кость хитов и добавить её результат как бонусный урон к одному броску урона этого заклинания. Каждое существо не может получить этот бонусный урон более одного раза за ход.</p>
      <p>Вместо кости хитов можно потратить 1 единицу крови и бросить 1к8 бонусного урона.</p>
      <p>Каждый раз, когда вы используете эту особенность, вы немедленно получаете некротический урон, равный 1 + уровень заклинания. Этот урон игнорирует сопротивление и иммунитет и не вызывает спасбросков концентрации.</p>
    `, "активности предлагают выбрать уровень заклинания, бросают бонусный урон и применяют самоповреждение 1 + уровень заклинания. Вариант с единицей крови списывает 1 единицу из текущего запаса.")
  }),
  sanguinistFeature({
    key: "vital-restoration",
    name: "Жизненное восстановление",
    img: `${WOW}/Spells/Regeneration.png`,
    level: 2,
    activities: utilityActivity({
      key: "show-vital-restoration",
      name: "Показать Жизненное восстановление",
      action: "show-vital-restoration",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы заканчиваете продолжительный отдых, вы восстанавливаете все недостающие кости хитов, а не только половину.</p>
    `, "после продолжительного отдыха модуль сбрасывает использованные кости хитов классов персонажа до 0.")
  }),
  sanguinistFeature({
    key: "blood-compatibility",
    name: "Кровавая совместимость",
    img: `${WOW}/Spells/BloodPresence.png`,
    level: 3,
    activities: utilityActivity({
      key: "show-blood-compatibility",
      name: "Показать выбор совместимости",
      action: "show-blood-compatibility",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>На 3-м уровне выберите постоянное преимущество: <strong>Моя собственная кровь</strong> или <strong>Кровь других</strong>. Всякий раз, когда вы получаете уровень Сангвиниста или уровень, дающий Улучшение характеристик, вы можете изменить этот выбор.</p>
    `, "сам выбор сделан через стандартный ItemChoice Advancement на 3-м уровне.")
  }),
  sanguinistFeature({
    key: "my-own-blood",
    name: "Моя собственная кровь",
    img: `${WOW}/Spells/RuneTap.png`,
    level: 3,
    folderId: COMPATIBILITY_FOLDER,
    activities: utilityActivity({
      key: "use-my-own-blood-recovery",
      name: "Восстановить кости хитов",
      action: "use-my-own-blood-recovery",
      activation: "special",
      condition: "После короткого отдыха",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы тратите кости хитов и бросаете урон по себе за кровавую магию, вы бросаете урон дважды и берёте меньший результат.</p>
      <p>Кроме того, когда вы заканчиваете короткий отдых, вы можете потратить любые оставшиеся использования вашей Кровавой магии и восстановить столько же потраченных костей хитов.</p>
    `, "модуль применяет бросок дважды с меньшим результатом для самоповреждения Гематургии. Активность после короткого отдыха тратит оставшиеся использования Кровавой магии и восстанавливает столько же использованных костей хитов на классах актёра.")
  }),
  sanguinistFeature({
    key: "blood-of-others",
    name: "Кровь других",
    img: `${WOW}/Spells/LifeDrain.png`,
    level: 3,
    folderId: COMPATIBILITY_FOLDER,
    activities: utilityActivity({
      key: "gain-sanguinist-blood-points-others",
      name: "Получить 2 единицы крови",
      action: "gain-sanguinist-blood-points-others",
      activation: "special",
      condition: "Вы должны получить единицу крови; считается за два использования Кровавой магии",
      spellSlot: false
    }),
    description: description(`
      <p>Дистанция, на которой вы можете получать единицы крови с помощью Кровавой магии, удваивается.</p>
      <p>Кроме того, всякий раз, когда вы должны получить единицу крови, вы можете получить две вместо одной. Это считается за два использования Кровавой магии.</p>
    `, "активность вручную тратит два использования Кровавой магии и добавляет две единицы крови. Удвоенная дистанция указана в описании.")
  }),
  sanguinistFeature({
    key: "ritual-sacrifice",
    name: "Ритуальное жертвоприношение",
    img: `${WOW}/Spells/RitualOfSacrifice.png`,
    level: 4,
    activities: utilityActivity({
      key: "show-ritual-sacrifice",
      name: "Показать варианты ритуала",
      action: "show-ritual-sacrifice",
      activation: "special",
      condition: "После успешного часового ритуала",
      spellSlot: false
    }),
    description: description(`
      <p>Перед наложением заклинания вы можете потратить 1 непрерывный час на ритуал над недееспособным существом с кровью в пределах 5 футов. Существо должно умереть в течение последней минуты ритуала. Если Мастер определит, что кровь существа содержит великую силу, ритуал успешен, а существо нельзя воскресить.</p>
      <p>Следующее заклинание, которое вы начинаете накладывать немедленно после ритуала, считается Кровавым и получает один выбранный эффект: увеличенная длительность, увеличенная дистанция, увеличенная область, неумолимость или особые цели.</p>
    `, "активность выводит список доступных усилений. Успех ритуала, ценность крови, смерть цели и фактическое изменение заклинания подтверждает Мастер.")
  }),
  sanguinistFeature({
    key: "crimson-mastery",
    name: "Багровое мастерство",
    img: `${WOW}/Abilities/BloodFrenzy.png`,
    level: 5,
    description: description(`
      <p>На 5-м уровне выберите две техники кровавой магии. Если техника требует спасбросок, СЛ равна СЛ ваших заклинаний Сангвиниста.</p>
    `, "выбор двух техник сделан через стандартный ItemChoice Advancement на 5-м уровне. Каждая выбранная техника имеет свою feature-карточку и активность.")
  }),
  masteryFeature({
    key: "arterial-puppetry",
    name: "Артериальная марионетка",
    img: `${WOW}/Spells/Possession.png`,
    activities: utilityActivity({
      key: "use-arterial-puppetry",
      name: "Артериальная марионетка",
      action: "use-arterial-puppetry",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы наносите урон существу Кровавым заклинанием или оно проваливает спасбросок против вашего Кровавого заклинания, если у существа есть кровь, вы можете потратить 3 единицы крови. Цель совершает спасбросок Телосложения; при провале вы направляете её перемещение в следующий ход, и она должна потратить действие на атаку цели по вашему выбору с помехой.</p>
    `, "активность списывает 3 единицы крови и выводит СЛ спасброска. Перемещение, атака цели и запрет опасной местности подтверждаются Мастером.")
  }),
  masteryFeature({
    key: "blood-backlash",
    name: "Кровавая обратная связь",
    img: `${WOW}/Spells/BloodPlague.png`,
    activities: utilityActivity({
      key: "use-blood-backlash",
      name: "Кровавая обратная связь",
      action: "use-blood-backlash",
      activation: "reaction",
      condition: "Вы получили дробящий, колющий или рубящий урон",
      rangeValue: 150,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы получаете дробящий, колющий или рубящий урон, вы можете реакцией потратить от 1 до 5 единиц крови. Если существо, нанесшее урон, находится в пределах 150 футов, совершите дальнобойную атаку заклинанием. При попадании цель получает 2к8 урона силой за каждую единицу крови + некротический урон, равный вашему модификатору заклинаний Сангвиниста.</p>
    `, "активность предлагает выбрать 1–5 единиц крови, списывает их, бросает урон и выводит модификатор атаки заклинанием.")
  }),
  masteryFeature({
    key: "bloodletting",
    name: "Кровопускание",
    img: `${WOW}/Abilities/BloodSplatter.png`,
    activities: utilityActivity({
      key: "use-bloodletting",
      name: "Кровопускание",
      action: "use-bloodletting",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы наносите урон существу Кровавым заклинанием или оно проваливает спасбросок против вашего Кровавого заклинания, если у существа есть кровь, вы можете потратить 2 единицы крови. Цель совершает спасбросок Телосложения; при провале получает 2к8 некротического урона и начинает истекать кровью, повторяя спасбросок в конце каждого хода.</p>
    `, "активность списывает 2 единицы крови, бросает 2к8 некротического урона и выводит СЛ и напоминание о повторных спасбросках.")
  }),
  masteryFeature({
    key: "contusion",
    name: "Ушиб",
    img: `${WOW}/Spells/PainAndSuffering.png`,
    activities: utilityActivity({
      key: "use-contusion",
      name: "Ушиб",
      action: "use-contusion",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы наносите урон существу Кровавым заклинанием или оно проваливает спасбросок против вашего Кровавого заклинания, если у существа есть кровь, вы можете потратить 2 единицы крови. Цель совершает спасбросок Телосложения; при провале на 1 минуту не может поддерживать концентрацию или использовать реакции, совершает с помехой проверки характеристик и атаки, а её скорость и грузоподъёмность уменьшаются вдвое. В конце каждого хода цель повторяет спасбросок.</p>
    `, "активность списывает 2 единицы крови и выводит СЛ/эффекты в чат. Эффект не накладывается автоматически, потому что применяется к выбранной цели и требует повторных спасбросков.")
  }),
  masteryFeature({
    key: "crimson-fury",
    name: "Багровая ярость",
    img: `${WOW}/Abilities/BloodRage.png`,
    activities: utilityActivity({
      key: "use-crimson-fury",
      name: "Багровая ярость",
      action: "use-crimson-fury",
      activation: "special",
      condition: "В начале вашего хода",
      spellSlot: false
    }),
    description: description(`
      <p>В начале своего хода вы можете потратить 1 единицу крови. До начала следующего хода вы имеете преимущество на атаки оружием и спасброски от очарования или испуга, получаете 5 временных хитов, но не можете поддерживать концентрацию.</p>
    `, "активность списывает 1 единицу крови, выставляет 5 временных хитов, создаёт 1-раундный marker-эффект и выводит правило преимущества/концентрации в чат.")
  }),
  masteryFeature({
    key: "sanguine-storm",
    name: "Багровая буря",
    img: `${WOW}/Abilities/BloodNova.png`,
    activities: utilityActivity({
      key: "use-sanguine-storm",
      name: "Багровая буря",
      action: "use-sanguine-storm",
      activation: "special",
      rangeValue: 60,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы наносите урон существу с кровью в пределах 60 футов и уменьшаете его до 0 хитов, вы можете потратить 3 единицы крови. Цель автоматически проваливает одну проверку смерти. Каждое существо в пределах 10 футов от неё совершает спасбросок Телосложения или получает 6к6 некротического урона.</p>
    `, "активность списывает 3 единицы крови, бросает 6к6 некротического урона и выводит СЛ спасброска. Область 10 футов и провал проверки смерти применяются вручную.")
  }),
  masteryFeature({
    key: "transfusion",
    name: "Переливание",
    img: `${WOW}/Spells/ImprovedVampiricEmbrace.png`,
    activities: utilityActivity({
      key: "use-transfusion",
      name: "Переливание",
      action: "use-transfusion",
      activation: "bonus",
      rangeValue: 5,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      spellSlot: false
    }),
    description: description(`
      <p>Бонусным действием вы можете потратить 1 или более единиц крови, чтобы наполнить одно существо, которого касаетесь, силой кровавой магии. Если у цели есть кровь, она получает 2к6 временных хитов за каждую потраченную единицу крови, максимум 40 временных хитов, на 1 минуту.</p>
    `, "активность предлагает выбрать число единиц крови, списывает их и бросает временные хиты 2к6 за единицу, ограничивая итог 40. Применение временных хитов к выбранной цели выполняется вручную.")
  }),
  masteryFeature({
    key: "vampirism",
    name: "Вампиризм",
    img: `${WOW}/Spells/VampiricAura.png`,
    activities: utilityActivity({
      key: "use-vampirism",
      name: "Вампиризм",
      action: "use-vampirism",
      activation: "special",
      spellSlot: false
    }),
    description: description(`
      <p>Когда вы наносите урон существу Кровавым заклинанием или оно проваливает спасбросок против вашего Кровавого заклинания, если у существа есть кровь, вы можете потратить от 1 до 5 единиц крови. Вы восстанавливаете хиты в количестве, равном 5 × числу потраченных единиц крови.</p>
    `, "активность предлагает выбрать 1–5 единиц крови, списывает их и лечит владельца на 5 хитов за единицу.")
  })
];
