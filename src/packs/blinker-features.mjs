import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const SOURCE = "Престиж-класс: Мерцающий; предоставленный PDF PK-_Mertsayuschiy (1).pdf";

const MAIN_FOLDER = idFor("folder:blinker-features");

export const blinkerFolders = [
  folder({ key: "blinker-features", name: "Мерцающий: классовые особенности", sort: 1040000 })
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

function blinkerFeature({
  key,
  name,
  img,
  level,
  description: value,
  uses = null,
  activities = {},
  extraAutomation = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Мерцающий ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    automation: {
      feature: key,
      blinkerFeature: true,
      minimumLevel: level,
      ...extraAutomation
    },
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    description: value
  });
}

export const blinkerDocuments = [
  blinkerFeature({
    key: "inner-blink",
    name: "Внутреннее Мерцание",
    img: `${WOW}/Spells/Blink.png`,
    level: 1,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "inner-blink",
      name: "Совершить мерцание",
      action: "use-inner-blink",
      activation: "special",
      condition: "Вместо совершения движения"
    }),
    description: description(`
      <p>Вместо совершения движения вы можете телепортироваться в незанятое пространство, которое вы можете видеть. Мерцание не провоцирует атак по возможности.</p>
      <p>На 1-м уровне расстояние телепортации равно половине вашей обычной скорости движения. Вы восстанавливаете все очки мерцания после короткого отдыха.</p>
    `, "runtime синхронизирует максимум очков мерцания по уровню класса и списывает 1 очко при использовании активности. Дистанция выводится уведомлением: половина скорости до 3-го уровня, скорость на 3–4 уровне и двойная скорость на 5-м уровне.")
  }),
  blinkerFeature({
    key: "turnaround-blink",
    name: "Мерцание с разворотом",
    img: `${WOW}/Spells/AstralShift.png`,
    level: 1,
    uses: shortRestUse("1"),
    activities: utilityActivity({
      key: "turnaround-blink",
      name: "Мерцание с разворотом",
      activation: "reaction",
      condition: "Когда по вам проводится успешная видимая атака",
      consumeItemUse: true
    }),
    description: description(`
      <p>Когда по вам проводится успешная атака, которую вы можете видеть, вы можете реакцией на долю секунды исчезнуть из этого мира, что даёт атакующему помеху на бросок атаки. Эта способность восстанавливается после короткого отдыха.</p>
    `, "карточка отслеживает использование реакции за короткий отдых. Помеха применяется вручную к атакующему броску, потому что способность объявляется в момент видимой успешной атаки.")
  }),
  blinkerFeature({
    key: "sideways-shift",
    name: "Сдвиг в сторону",
    img: `${WOW}/Spells/ImpPhaseShift.png`,
    level: 2,
    activities: utilityActivity({
      key: "sideways-shift",
      name: "Активировать Сдвиг в сторону",
      action: "activate-sideways-shift",
      activation: "special",
      condition: "После телепортации в свой ход"
    }),
    description: description(`
      <p>Если в свой ход вы телепортировались любым способом, включая принудительное перемещение, до конца этого хода вы получаете преимущество на все атаки и добавляете бонус мастерства к броскам урона.</p>
    `, "после телепортации используйте активность. Runtime накладывает временный эффект с преимуществом на атаки через Midi-QOL/DAE и автоматически добавляет бонус мастерства к броскам урона атак до конца хода. Если эффект не снялся автоматически в конкретной конфигурации, удалите его в конце хода.")
  }),
  blinkerFeature({
    key: "blinking-step",
    name: "Мерцающий шаг",
    img: `${WOW}/Abilities/Shadowstep.png`,
    level: 2,
    uses: longRestUse("1"),
    activities: utilityActivity({
      key: "blinking-step",
      name: "Мерцающий шаг",
      activation: "bonus",
      condition: "Бонусное действие или реакция; перемещение на 5 футов",
      consumeItemUse: true
    }),
    description: description(`
      <p>Раз в день вы можете реакцией или бонусным действием шагнуть на расстояние 5 футов, не тратя очки мерцания. Это перемещение не провоцирует атаки по возможности.</p>
    `, "карточка отслеживает ежедневное использование. Выбор бонусного действия или реакции и фактическое перемещение токена выполняются вручную.")
  }),
  blinkerFeature({
    key: "improved-technique",
    name: "Улучшенная техника",
    img: `${WOW}/Spells/Teleport.png`,
    level: 3,
    description: description(`
      <p>На 3-м уровне расстояние, на которое вы можете телепортироваться с помощью Внутреннего Мерцания, становится равным вашей обычной скорости движения.</p>
    `, "runtime учитывает эту особенность при уведомлении дистанции Мерцания и Внешнего Мерцания.")
  }),
  blinkerFeature({
    key: "blinking-wrist",
    name: "Мерцающее запястье",
    img: `${WOW}/Abilities/ThrowingSpecialization.png`,
    level: 3,
    uses: longRestUse("2"),
    activities: utilityActivity({
      key: "blinking-wrist",
      name: "Метнуть мерцающий предмет",
      activation: "special",
      condition: "Метание предмета или оружия",
      consumeItemUse: true
    }),
    description: description(`
      <p>Дважды в день вы можете метнуть любой предмет, включая оружие вроде ножа или дротика, на расстояние вдвое больше обычной дальности, заставив его ярко мерцать большую часть пути.</p>
    `, "карточка отслеживает два использования за продолжительный отдых. Изменение дальности конкретного предмета или оружия примените вручную перед броском.")
  }),
  blinkerFeature({
    key: "outer-blink",
    name: "Внешнее Мерцание",
    img: `${WOW}/Spells/MassTeleport.png`,
    level: 4,
    activities: utilityActivity({
      key: "outer-blink",
      name: "Телепортировать другое существо",
      action: "use-outer-blink",
      activation: "action",
      condition: "Касание существа размером не больше вашего",
      targetType: "creature",
      targetCount: "1",
      targetChoice: true,
      rangeValue: 5,
      rollFormula: "@prof + @abilities.int.mod",
      rollName: "Бонус магической атаки ближнего боя",
      rollVisible: true
    }),
    description: description(`
      <p>Действием вы можете телепортировать другое существо, чей размер не превышает вашего, коснувшись его. Эта телепортация подчиняется тем же правилам, что и ваша собственная.</p>
      <p>Если цель сопротивляется, совершите магическую атаку ближнего боя: бонус мастерства + модификатор Интеллекта. При промахе цель остаётся нетронутой.</p>
    `, "runtime проверяет и списывает 1 очко мерцания из «Внутреннего Мерцания», затем выводит текущую дистанцию. Бросок показывает бонус магической атаки. Перемещение цели и проверка сопротивляющейся цели выполняются вручную.")
  }),
  blinkerFeature({
    key: "shift-sense",
    name: "Чувство сдвига",
    img: `${WOW}/Spells/MagicalSentry.png`,
    level: 4,
    uses: longRestUse("3"),
    activities: {
      ...utilityActivity({
        key: "shift-sense-detect",
        name: "Проверить преграду",
        activation: "action",
        condition: "Коснуться немагической стены или двери",
        consumeItemUse: true
      }),
      ...utilityActivity({
        key: "shift-sense-pass",
        name: "Медленно пройти сквозь преграду",
        activation: "special",
        condition: "1 минута; немагическая стена или дверь толщиной не больше 5 футов"
      })
    },
    description: description(`
      <p>Трижды в день, прикоснувшись к немагической стене или двери, вы узнаёте, есть ли за ними объект или существо. Если за препятствием никого нет и толщина не превышает 5 футов, вы можете за одну минуту медленно проникнуть сквозь преграду. Любые действия или атака по вам отменяют прохождение.</p>
      <p>Вы можете выполнять сам сдвиг сквозь стену только один раз в неделю.</p>
    `, "карточка отслеживает три ежедневных проверки преграды. Недельное ограничение на прохождение, наличие объектов за стеной и отмена из-за действий/атак подтверждаются Мастером.")
  }),
  blinkerFeature({
    key: "disappearance",
    name: "Исчезновение",
    img: `${WOW}/Abilities/Vanish.png`,
    level: 5,
    description: description(`
      <p>На 5-м уровне расстояние Мерцания становится равным удвоенному значению вашей обычной скорости движения.</p>
    `, "runtime учитывает эту особенность при уведомлении дистанции Мерцания и Внешнего Мерцания.")
  }),
  blinkerFeature({
    key: "miraculous-homecoming",
    name: "Чудесное возвращение домой",
    img: `${WOW}/Spells/PortalDalaran.png`,
    level: 5,
    uses: {
      max: "2",
      spent: 0,
      recovery: []
    },
    activities: {
      ...utilityActivity({
        key: "miraculous-homecoming-ritual",
        name: "Провести домашний ритуал",
        activation: "special",
        condition: "8 часов и материалы на 1000 зм"
      }),
      ...utilityActivity({
        key: "miraculous-homecoming-return",
        name: "Вернуться домой",
        activation: "special",
        consumeItemUse: true
      })
    },
    description: description(`
      <p>Раз в год вы можете провести 8-часовой ритуал и потратить особые материалы на 1000 зм, чтобы обозначить безопасное место. Вы оставляете магическую метку на неподвижной поверхности на ваш выбор.</p>
      <p>Два раза в год вы можете отправиться домой с помощью мерцания. Это полностью истощает вас: все способности этого престиж-класса недоступны вам в течение следующих 7 дней. Если домашний знак повреждён, стёрт, рассеян или осквернён, вы мгновенно узнаёте об этом.</p>
    `, "карточка хранит два ручных годовых использования без автоматического восстановления. Ритуал, телепортация домой, повреждение знака и 7-дневная недоступность способностей отслеживаются Мастером.")
  })
];
