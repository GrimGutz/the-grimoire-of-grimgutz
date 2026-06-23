import {
  MODULE_ID,
  baseDocument,
  sourceData,
  utilityActivity
} from "../common.mjs";

const SOURCE = "Престиж-класс: Лесной владыка; Мистический гримуар Jorving, стр. 71–76";

export const forestLordSpellDocuments = [
  baseDocument({
    key: "tree-healing",
    name: "Древесное лечение",
    type: "spell",
    img: "icons/magic/nature/tree-spirit-green.webp",
    flags: {
      [MODULE_ID]: {
        forestLordSpell: true
      }
    },
    system: {
      description: {
        value: `
          <p>Вы входите в обычное дерево, достаточно большое, чтобы полностью вместить ваше тело. Пока длится заклинание, вы можете оставаться внутри дерева.</p>
          <p>Внутри вам не нужно дышать или есть, и вы восстанавливаете 5 хитов за каждый проведённый там час. Дерево предоставляет полное укрытие и защищает от опасных погодных условий. Вы слышите, но не видите происходящее снаружи.</p>
          <p>Если дерево повреждено настолько, что больше не может вас вместить, вас выталкивает наружу и вы получаете 5к6 урона того же типа. При полном уничтожении дерева совершите спасбросок Телосложения Сл 15; при провале ваши хиты снижаются до 1.</p>
          <p>Когда заклинание заканчивается, вы без вреда появляетесь в ближайшем свободном пространстве. Время внутри дерева может считаться отдыхом.</p>
          <hr>
          <p><strong>Автоматизация Foundry:</strong> обычная активность расходует ячейку 2-го круга или выше. Активность «Древесный родич» расходует одно бесплатное применение, восстанавливающееся после продолжительного отдыха. Почасовое лечение и состояние дерева контролируются Мастером.</p>
        `,
        chat: ""
      },
      source: sourceData("2", SOURCE),
      activation: {
        type: "action",
        condition: "Накладывание занимает полный раунд",
        value: 1
      },
      duration: {
        value: "8",
        units: "hour"
      },
      target: {
        affects: {
          type: "self",
          count: "",
          choice: false,
          special: ""
        },
        template: {
          units: "",
          contiguous: false,
          type: ""
        }
      },
      range: {
        units: "self",
        special: ""
      },
      uses: {
        max: "1",
        spent: 0,
        recovery: [{ period: "lr", type: "recoverAll" }]
      },
      level: 2,
      school: "abj",
      materials: {
        value: "",
        consumed: false,
        cost: 0,
        supply: 0
      },
      preparation: {
        mode: "always",
        prepared: true
      },
      properties: ["vocal", "somatic"],
      activities: Object.assign(
        {},
        utilityActivity({
          key: "tree-healing-slot",
          name: "Наложить ячейкой",
          activation: "action",
          condition: "Накладывание занимает полный раунд",
          spellSlot: true
        }),
        utilityActivity({
          key: "tree-healing-free",
          name: "Древесный родич: без ячейки",
          activation: "action",
          condition: "Накладывание занимает полный раунд",
          consumeItemUse: true,
          spellSlot: false
        })
      ),
      identifier: "tree-healing"
    }
  })
];
