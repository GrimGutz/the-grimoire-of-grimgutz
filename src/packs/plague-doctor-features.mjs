import { activeEffect, feature, folder, idFor, utilityActivity } from "../common.mjs";

const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const SOURCE = "Престиж-класс: Чумной маг; предоставленный PDF PK_PlagueDoc (1).pdf";

const MAIN_FOLDER = idFor("folder:plague-doctor-features");

export const plagueDoctorFolders = [
  folder({ key: "plague-doctor-features", name: "Чумной маг: классовые особенности", sort: 1060000 })
];

function description(body, automation) {
  return `
    ${body}
    <hr>
    <p><strong>Автоматизация Foundry:</strong> ${automation}</p>
  `;
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

function longRestUse(max = "1") {
  return {
    max,
    spent: 0,
    recovery: [
      { period: "lr", type: "recoverAll" }
    ]
  };
}

function plagueDoctorFeature({
  key,
  name,
  img,
  level,
  description: value,
  uses = null,
  activities = {},
  effects = [],
  extraAutomation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Чумной маг ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    effects,
    automation: {
      feature: key,
      plagueDoctorFeature: true,
      minimumLevel: level,
      ...extraAutomation
    },
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    description: value
  });
}

export const plagueDoctorDocuments = [
  plagueDoctorFeature({
    key: "plague-sneak-attack",
    name: "Скрытая атака Чумного мага",
    img: `${WOW}/Abilities/DeviousPoisons.png`,
    level: 1,
    activities: utilityActivity({
      key: "plague-sneak-attack",
      name: "Бросить урон Скрытой атаки",
      action: "roll-plague-sneak-attack",
      activation: "special",
      condition: "Один раз за ход, атака с преимуществом по цели в пределах 30 футов"
    }),
    description: description(`
      <p>Один раз в ход вы можете причинить дополнительный урон одному существу в пределах 30 футов, по которому вы попали атакой, совершённой с преимуществом к броску атаки.</p>
      <p>Дополнительный урон равен 2к6 и увеличивается до 3к6 на 4-м уровне Чумного мага. Если у вас уже есть Скрытая атака от способностей Плута, урон складывается.</p>
    `, "активность бросает текущую формулу Скрытой атаки Чумного мага: 2к6 до 4-го уровня и 3к6 с 4-го уровня. Само условие преимущества, один раз за ход и сложение с плутовской Скрытой атакой контролируются игроком/Мастером.")
  }),
  plagueDoctorFeature({
    key: "disease-carrier",
    name: "Разносчик заболеваний",
    img: `${WOW}/Spells/BlackPlague.png`,
    level: 1,
    effects: [
      activeEffect({
        key: "disease-carrier",
        name: "Разносчик заболеваний",
        img: `${WOW}/Spells/BlackPlague.png`,
        changes: [
          { key: "system.traits.ci.value", type: "custom", value: "diseased", priority: 20 }
        ]
      })
    ],
    description: description(`
      <p>Чумной маг является носителем каждой болезни, с которой сталкивается, от незначительных простуд до смертельных эпидемий. Он невосприимчив к негативным последствиям заболеваний, кроме косметических проявлений.</p>
      <p>Если Чумной маг попадает под эффект магического лечения болезней, он теряет внешние проявления болезней и все бонусы этого престиж-класса, кроме «Оборванца», пока не завершит продолжительный отдых.</p>
    `, "пассивный эффект добавляет иммунитет к состоянию/эффектам болезни как custom marker. Потеря классовых бонусов после магического лечения болезни не автоматизирована, потому что Foundry не имеет единого события «вылечить болезнь» для всех заклинаний, Наложения рук и пользовательских эффектов.")
  }),
  plagueDoctorFeature({
    key: "ragged-armor",
    name: "Оборванец",
    img: `${WOW}/Trade/FelRag.png`,
    level: 2,
    description: description(`
      <p>Собирая обрывки одежды, старые лохмотья, окровавленные бинты и тряпки, Чумной маг может смастерить лёгкий доспех: КД 12 + модификатор Ловкости, вес 6 фунтов, сопротивление урону ядом. Никто другой не получает выгоды от ношения этого импровизированного доспеха.</p>
    `, "создайте такой доспех на листе вручную как лёгкую броню с базовым КД 12 и сопротивлением яду. Эффект не накладывается постоянно, потому что бонус работает только при ношении конкретного самодельного доспеха.")
  }),
  plagueDoctorFeature({
    key: "touch-of-disease",
    name: "Касание болезни",
    img: `${WOW}/Spells/Contagion.png`,
    level: 2,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "touch-of-disease",
      name: "Наложить Заражение",
      activation: "action",
      consumeItemUse: true,
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      rangeValue: 5,
      rollFormula: "8 + @prof + @abilities.int.mod",
      rollName: "Сл спасброска Интеллекта для Заражения",
      rollVisible: true
    }),
    description: description(`
      <p>Вы можете переносить болезни, процветающие внутри вашего тела, на других. Вы можете наложить заклинание <em>Заражение</em>, используя Интеллект в качестве заклинательной характеристики. Вы не можете использовать эту способность вновь, пока не завершите короткий отдых.</p>
    `, "карточка отслеживает одно использование за короткий отдых и показывает Сл от Интеллекта. Сам эффект заклинания «Заражение» и выбранная болезнь применяются вручную или через системное заклинание, если оно есть на листе.")
  }),
  plagueDoctorFeature({
    key: "smart-infection",
    name: "Умная инфекция",
    img: `${WOW}/Spells/CreepingPlague.png`,
    level: 3,
    activities: {
      ...utilityActivity({
        key: "smart-infection-1",
        name: "Создать агента: 1 Инт",
        action: "create-smart-infection",
        actionData: { intCost: 1 },
        activation: "special"
      }),
      ...utilityActivity({
        key: "smart-infection-2",
        name: "Создать агента: 2 Инт",
        action: "create-smart-infection",
        actionData: { intCost: 2 },
        activation: "special"
      }),
      ...utilityActivity({
        key: "smart-infection-3",
        name: "Создать агента: 3 Инт",
        action: "create-smart-infection",
        actionData: { intCost: 3 },
        activation: "special"
      }),
      ...utilityActivity({
        key: "clear-smart-infections",
        name: "Вернуть Интеллект от инфекций",
        action: "clear-smart-infections",
        activation: "special"
      })
    },
    description: description(`
      <p>Чумной маг может отделить небольшую часть своего мозга, сращивая её с болезнями в своём теле, и создать вирусного агента. Интеллект Чумного мага снижается на 1–3 очка, в зависимости от того, сколько он отдаёт агенту. Интеллект нельзя снизить ниже 4.</p>
      <p>Вирусный агент распространяется через «Касание болезни» и использует один из его эффектов как базовые последствия заражения. Если существо успешно сопротивляется инфекции или излечивается от неё, вирусный союзник уничтожается, а очки Интеллекта возвращаются Чумному магу.</p>
      <ul>
        <li><strong>1 очко:</strong> телепатическая связь с агентом на расстоянии до 1 мили и ощущение местоположения заражённого.</li>
        <li><strong>2 очка:</strong> агент также может попытаться заразить новое существо при контакте носителей.</li>
        <li><strong>3 очка:</strong> агент также может один раз за продолжительный отдых попытаться контролировать носителя как <em>Подчинение личности</em>.</li>
      </ul>
    `, "активности на 1/2/3 Интеллекта создают отдельный временный эффект снижения Интеллекта и не позволяют опустить Интеллект ниже 4. Возврат Интеллекта можно сделать удалением конкретного эффекта вручную или действием «Вернуть Интеллект от инфекций», которое удаляет все эффекты Умной инфекции.")
  }),
  plagueDoctorFeature({
    key: "infect-wounds",
    name: "Инфицирование ран",
    img: `${WOW}/Spells/PlagueStrike.png`,
    level: 4,
    description: description(`
      <p>Открытые раны крайне опасны, когда рядом бродит болезнь. Чумной маг может использовать «Касание болезни» как часть успешной атаки в ближнем бою.</p>
    `, "после успешной ближней атаки используйте карточку «Касание болезни» и примените её эффект к цели. Автоматически привязать это к любому оружию нельзя безопасно, потому что способность опциональна и зависит от успешного попадания.")
  }),
  plagueDoctorFeature({
    key: "disease-form",
    name: "Форма болезни",
    img: `${WOW}/Spells/PlagueCloud.png`,
    level: 5,
    uses: longRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "disease-form-activate",
        name: "Принять Форму болезни",
        action: "activate-disease-form",
        activation: "action",
        consumeItemUse: true
      }),
      ...utilityActivity({
        key: "disease-form-end",
        name: "Завершить Форму болезни",
        action: "end-disease-form",
        activation: "special"
      }),
      ...utilityActivity({
        key: "disease-form-infect",
        name: "Заразить из Формы болезни",
        activation: "special",
        rangeValue: 100,
        targetType: "creature",
        targetCount: "1",
        targetChoice: true,
        rollFormula: "8 + @prof + @abilities.int.mod",
        rollName: "Сл спасброска Телосложения",
        rollVisible: true
      })
    },
    description: description(`
      <p>Сразу после завершения продолжительного отдыха Чумной маг может действием распылить своё тело на множество микроорганизмов, сохраняя единый разум. В этой форме его нельзя обнаружить даже истинным зрением, он не может двигаться, ему не нужно есть, спать, пить или дышать, и он может оставаться так сколь угодно долго.</p>
      <p>В момент трансформации он может попытаться заразить существо в пределах 100 футов, а также любое существо, которое подходит ближе чем на 10 футов к облаку. Цель совершает спасбросок Телосложения и заражается при провале. Медицинское обследование видит только обычную болезнь.</p>
      <p>Чумной маг знает всё, что известно заражённому, и один раз за короткий отдых может заставить его повторить одну атаку, спасбросок или проверку способности. Когда носитель завершает продолжительный отдых, Чумной маг может наделить его уязвимостью к типу урона или помехой на один вид спасбросков.</p>
      <p>Маг может оставаться в носителе, пока тот не вылечится магическим лечением болезней или аналогичным эффектом. Тогда Чумной маг совершает спасбросок Телосложения против Сл заклинания: при успехе появляется рядом, при провале появляется с двумя степенями истощения, а при провале на 5 и более мгновенно уничтожается.</p>
    `, "активация создаёт эффект Формы болезни, который обнуляет скорости передвижения. Действие завершения снимает эффект. Заражение целей, знание носителя, повтор броска, уязвимость/помеха после отдыха и проверка против магического лечения болезней выполняются Мастером вручную.")
  })
];
