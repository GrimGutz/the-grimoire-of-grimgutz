import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const WOW = "modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack";
const SOURCE = "Престиж-класс: Харроуер; предоставленный PDF PK_Gambler.pdf";

const MAIN_FOLDER = idFor("folder:gambler-features");

export const gamblerFolders = [
  folder({ key: "gambler-features", name: "Харроуер: классовые особенности", sort: 1080000 })
];

function description(body, automation) {
  return `
    ${body}
    <hr>
    <p><strong>Автоматизация Foundry:</strong> ${automation}</p>
  `;
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

function gamblerFeature({
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
    requirements: `Харроуер ${level}`,
    folder: MAIN_FOLDER,
    uses,
    activities,
    automation: {
      feature: key,
      gamblerFeature: true,
      minimumLevel: level,
      ...extraAutomation
    },
    sourcePage: "1–3",
    sourceCustom: SOURCE,
    description: value
  });
}

export const gamblerDocuments = [
  gamblerFeature({
    key: "astral-deck",
    name: "Колода Астральных Тайн",
    img: `${WOW}/Miscellaneous/Ticket_Tarot_Stack_01.png`,
    level: 1,
    activities: {
      ...utilityActivity({
        key: "draw-astral-card",
        name: "Вытянуть карту",
        action: "draw-astral-card",
        activation: "action"
      }),
      ...utilityActivity({
        key: "use-held-astral-card",
        name: "Использовать удержанную карту",
        action: "use-held-astral-card",
        activation: "action",
        condition: "У вас есть вытянутая карта"
      }),
      ...utilityActivity({
        key: "discard-held-astral-card",
        name: "Сбросить удержанную карту",
        action: "discard-held-astral-card",
        activation: "special"
      })
    },
    description: description(`
      <p>Начиная с 1-го уровня вы практиковали или улучшили свои таланты в использовании Колоды Астральных Тайн. Колода содержит 60 карт. Действием вы можете вытянуть карту из колоды; когда вы тянете карту, бросьте к6. Соответствующий результат — вытянутая карта.</p>
      <p>Вы можете либо оставить карту на потом, либо использовать её немедленно. У вас может быть вытянута только одна карта одновременно, если другая способность не предписывает иное. Если вы используете карту, совершите дальнобойную атаку заклинанием с дистанцией 30 футов. Если ваш базовый класс уже может накладывать заклинания, атаки заклинаниями и спасброски используют характеристики вашего базового класса; иначе используйте Интеллект.</p>
      <table>
        <thead><tr><th>к6</th><th>Карта</th><th>Эффект</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Весы</td><td>4к8 колющего урона цели и враждебным существам в пределах 5 футов от цели.</td></tr>
          <tr><td>2</td><td>Ствол</td><td>Цель заключена в 5-футовую клетку зелёной силы на 1 минуту или пока клетка не разрушена. КД 15, 25 хитов.</td></tr>
          <tr><td>3</td><td>Стрела</td><td>5к4 урона силой и дополнительное бонусное действие в этом ходу.</td></tr>
          <tr><td>4</td><td>Копьё</td><td>2к10 рубящего урона; карта может критически попасть.</td></tr>
          <tr><td>5</td><td>Кувшин</td><td>5к4 урона силой и восстановление недостающего классового ресурса, например ячеек заклинаний.</td></tr>
          <tr><td>6</td><td>Шпиль</td><td>2к6 колющего урона; если на любой кости выпадает 6, карта перескакивает на другого врага в пределах 10 футов.</td></tr>
        </tbody>
      </table>
    `, "активность вытягивания бросает к6 и сохраняет удержанную карту активным эффектом. Активность использования бросает однозначный урон или выводит инструкцию для контрольного эффекта, затем сбрасывает карту. Дальнобойная атака заклинанием, выбор цели, попадание и восстановление конкретного ресурса по карте «Кувшин» подтверждаются игроком/Мастером.")
  }),
  gamblerFeature({
    key: "deal-them",
    name: "Сдавай Их",
    img: `${WOW}/Abilities/SliceDice.png`,
    level: 2,
    uses: longRestUse("1"),
    activities: utilityActivity({
      key: "deal-them",
      name: "Сдать три карты",
      action: "deal-them",
      activation: "action",
      consumeItemUse: true,
      rangeValue: 30,
      targetType: "creature",
      targetCount: "3",
      targetChoice: true
    }),
    description: description(`
      <p>На 2-м уровне ваша связь с картами углубляется. Вы тянете три карты из своей колоды и мечете их одним взмахом. Совершите три дальнобойные атаки заклинаниями по отдельным целям в пределах дистанции. Если в пределах дистанции меньше трёх целей, одна из карт тратится впустую.</p>
      <p>Вы можете использовать эту особенность количество раз, равное 1 + модификатор Ловкости, минимум 1, и восстанавливаете все использования после продолжительного отдыха.</p>
    `, "runtime синхронизирует число использований по 1 + модификатор Ловкости, минимум 1. При использовании бросает три карты и их эффекты. Отдельные атаки заклинаниями и потеря карт при нехватке целей контролируются вручную.")
  }),
  gamblerFeature({
    key: "rogues-are-lucky",
    name: "Плутам везёт",
    img: `${WOW}/Miscellaneous/Dice_02.png`,
    level: 3,
    uses: longRestUse("1"),
    activities: utilityActivity({
      key: "rogues-are-lucky",
      name: "Поспорить с Мастером на к100",
      action: "rogues-are-lucky",
      activation: "special",
      consumeItemUse: true,
      rollFormula: "1d100",
      rollName: "Плутам везёт",
      rollVisible: true
    }),
    description: description(`
      <p>На 3-м уровне вы научились подстраивать удачу в свою пользу. Раз за продолжительный отдых вы можете бросить к100 против вашего Мастера. Если ваш результат выше, вы можете подсмотреть верхнюю карту своей колоды, которая сбрасывается немедленно. Даже если способность потребовала бы тасования колоды, карта, раскрытая с помощью этой особенности, всегда будет наверху колоды, пока не будет использована.</p>
    `, "активность отслеживает одно использование за продолжительный отдых и бросает ваш к100 в чат. Бросок Мастера, раскрытие верхней карты и управление порядком колоды остаются ручными, потому что это скрытая информация Мастера.")
  }),
  gamblerFeature({
    key: "up-the-sleeve",
    name: "В Рукаве",
    img: `${WOW}/Miscellaneous/LuckyMoneyEnvelope.png`,
    level: 4,
    uses: longRestUse("1"),
    activities: {
      ...utilityActivity({
        key: "store-sleeved-card",
        name: "Припрятать карту",
        action: "store-sleeved-card",
        activation: "special",
        consumeItemUse: true
      }),
      ...utilityActivity({
        key: "use-sleeved-card",
        name: "Использовать карту из рукава",
        action: "use-sleeved-card",
        activation: "special"
      })
    },
    description: description(`
      <p>На 4-м уровне ваши уловки способны одурачить саму судьбу. Когда вы используете эту способность, вы сохраняете верхнюю карту своей колоды во внепространственном измерении. Ваш Мастер втайне бросает кость, определяющую природу карты, если вы ранее не использовали «Плутам везёт».</p>
      <p>Вы можете в любой момент решить использовать эту припрятанную карту вместо вытягивания карты из колоды для любой особенности, которая требует этого. Только одна карта может храниться во внепространственном измерении одновременно.</p>
      <p>Вы можете использовать эту особенность количество раз в день, равное модификатору Интеллекта, минимум 1.</p>
    `, "runtime синхронизирует число использований по модификатору Интеллекта, минимум 1. Активность припрятывания бросает карту и сохраняет её активным эффектом; если нужна тайна, Мастер может вместо этого сделать blind roll и вручную отметить результат. Активность использования разыгрывает карту и снимает эффект.")
  }),
  gamblerFeature({
    key: "aces-beat",
    name: "Тузы бьют",
    img: `${WOW}/Miscellaneous/Ticket_Tarot_Portal_01.png`,
    level: 5,
    activities: utilityActivity({
      key: "aces-beat",
      name: "Сжечь карту и телепортироваться",
      action: "aces-beat",
      activation: "action",
      condition: "Требуется удержанная или припрятанная карта"
    }),
    description: description(`
      <p>На 5-м уровне вы пробудили истинную силу своих карт. Действием вы можете сжечь карту, которую держите, чтобы попытаться телепортироваться как заклинанием <em>Телепортация</em>, даже если вы иным образом были бы скованы.</p>
      <p>После использования этой способности вы получаете уровень истощения и не можете использовать эту способность в течение 24 часов.</p>
    `, "активность требует удержанную или припрятанную карту, сбрасывает её, увеличивает истощение на 1 и создаёт 24-часовой cooldown-эффект. Фактическую телепортацию и точку назначения Мастер выполняет как для заклинания «Телепортация».")
  })
];
