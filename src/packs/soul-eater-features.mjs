import { feature, folder, idFor, utilityActivity } from "../common.mjs";

const SOUL_EATER_FOLDER = idFor("folder:soul-eater-features");
const SOURCE = "Престиж-класс: Пожиратель душ; предоставленный PDF PK_Souleater (2).pdf";

function soulEaterFeature({
  key,
  name,
  img,
  level,
  description,
  activities = {}
}) {
  return feature({
    key,
    name,
    img,
    level,
    requirements: `Пожиратель душ ${level}`,
    folder: SOUL_EATER_FOLDER,
    sourcePage: "1–2",
    sourceCustom: SOURCE,
    automation: {
      feature: key,
      soulEaterFeature: true,
      minimumLevel: level
    },
    activities,
    description
  });
}

export const soulEaterFolders = [
  folder({ key: "soul-eater-features", name: "Пожиратель душ", sort: 980000 })
];

export const soulEaterDocuments = [
  soulEaterFeature({
    key: "soul-rend",
    name: "Разрыв души",
    img: "icons/magic/death/skeleton-skull-soul-blue.webp",
    level: 1,
    activities: utilityActivity({
      key: "soul-rend-damage",
      name: "Урон Разрыва души",
      activation: "special",
      condition: "Один раз за ход после попадания безоружной атакой или природным оружием",
      rollFormula: "@scale.soul-eater.soul-rend",
      rollName: "Некротический урон",
      rollVisible: true
    }),
    description: `
      <p>Один раз за ход, совершая безоружную атаку или атаку своим природным оружием, вы можете, окутав конечность бледно-голубым светом, вырвать часть души противника.</p>
      <p>В дополнение к обычному урону атака наносит некротический урон Разрыва души. Этот урон увеличивается по мере получения уровней Пожирателя душ.</p>
      <table>
        <thead><tr><th>Уровень Пожирателя душ</th><th>Разрыв души</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>1к4</td></tr>
          <tr><td>2</td><td>2к4</td></tr>
          <tr><td>3</td><td>3к4</td></tr>
          <tr><td>4</td><td>4к4</td></tr>
          <tr><td>5</td><td>5к4</td></tr>
        </tbody>
      </table>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> используйте активность «Урон Разрыва души» после подходящего попадания. Формула берёт масштабирование из класса.</p>
    `
  }),
  soulEaterFeature({
    key: "soul-absorption",
    name: "Поглощение души",
    img: "icons/magic/unholy/orb-collecting-energy-green.webp",
    level: 2,
    description: `
      <p>После того как вы успешно нанесли противнику урон с помощью Разрыва души, вы можете поглотить вырванную энергию без действия и получить преимущество на следующий спасбросок или проверку умения.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> преимущество применяется к следующему выбранному броску вручную, потому что правило требует выбрать один будущий спасбросок или проверку.</p>
    `
  }),
  soulEaterFeature({
    key: "soul-exchange",
    name: "Обмен душами",
    img: "icons/magic/unholy/silhouette-robe-evil-power.webp",
    level: 3,
    activities: utilityActivity({
      key: "soul-exchange",
      name: "Принять форму убитого существа",
      activation: "action",
      condition: "В следующем раунде после убийства гуманоида Разрывом души"
    }),
    description: `
      <p>Если вы убиваете гуманоидное существо с помощью Разрыва души, то в следующем раунде после этого можете действием принять форму этого существа, как если бы использовали <em>Полное превращение</em>.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> карточка содержит действие-напоминание. Форма цели выбирается и применяется Мастером вручную.</p>
    `
  }),
  soulEaterFeature({
    key: "soul-shard",
    name: "Осколок души",
    img: "icons/magic/unholy/hand-claw-fire-blue.webp",
    level: 4,
    activities: utilityActivity({
      key: "soul-shard",
      name: "Активировать Осколок души",
      action: "activate-soul-shard",
      activation: "special",
      condition: "После успешного нанесения урона Разрывом души"
    }),
    description: `
      <p>После того как вы успешно нанесли противнику урон с помощью Разрыва души, вы получаете бонус +2 к Силе и Телосложению до конца боя. Этот бонус не кумулятивен.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> активность «Активировать Осколок души» накладывает на персонажа временный эффект +2 Силы и +2 Телосложения. Повторное применение обновляет существующий эффект, не складывая бонус.</p>
    `
  }),
  soulEaterFeature({
    key: "soul-power",
    name: "Сила души",
    img: "icons/magic/death/skull-flames-white-blue.webp",
    level: 5,
    activities: utilityActivity({
      key: "soul-power",
      name: "Поглотить силу души",
      activation: "special",
      condition: "После убийства разумного существа Разрывом души"
    }),
    description: `
      <p>Если вы убиваете разумное существо с помощью Разрыва души, вы можете поглотить его силу и восстановить себе одно умение, требующее короткого отдыха для восстановления, одну ячейку заклинаний не выше 3-го уровня, 2 очка ци или 2 кости совершенства.</p>
      <hr>
      <p><strong>Автоматизация Foundry:</strong> выбор восстанавливаемого ресурса зависит от класса персонажа и подтверждается вручную.</p>
    `
  })
];
