import { MODULE_ID, withAutomationConfig } from "./common.mjs";
import { AURA_DEFINITIONS } from "../scripts/automation/shared/aura-definitions.mjs";

const notes = {
  "gutz-enlightenment": "Вокруг токена автоматически создаётся привязанная область радиусом 30 футов. Дружественные существа внутри получают бонус к проверкам характеристик от Харизмы Гатца; при выходе бонус снимается. Из одинаковых аур применяется сильнейшая.",
  "npc-leader-command": "Вокруг токена автоматически создаётся привязанная область радиусом 60 футов. Дружественные существа внутри получают бонус к инициативе от Интеллекта Лидера. Нужно видеть или слышать Лидера; необычные препятствия восприятия и дополнительный урон один раз за ход подтверждает Мастер.",
  "npc-plague-infection": "Область радиусом 30 футов автоматически следует за токеном. В начале хода врага внутри Midi-QOL проводит спасбросок Телосложения Сл 15. Провал создаёт постоянную отметку Скрытой чумы интеллекта; уход из области не излечивает болезнь. Пока отметка активна, заражение не повторяется. Проявление симптомов и лечение подтверждает Мастер.",
  "devil-devastated-souls": "Область радиусом 60 футов автоматически следует за токеном. Смерть живого существа внутри даёт временные хиты по размеру: 10/20/30/40; Огромное и большее — 40. Более высокий запас не заменяется. Эти временные хиты заканчиваются после отдыха. Нулевые хиты NPC считаются смертью, но 0 хитов персонажа — нет; для персонажа требуется явное состояние Мёртв. NPC со спасбросками от смерти можно настроить на явное подтверждение смерти."
};

export function configureNpcAuraCards(documents) {
  for (const actor of documents) for (const item of actor._embeddedItems ?? []) {
    const definition = AURA_DEFINITIONS.find(definition => (definition.sourceFeatures ?? [definition.sourceFeature]).includes(item.system.identifier));
    const text = notes[definition?.id];
    if (!text) continue;
    item.flags = withAutomationConfig({ ...item.flags, [MODULE_ID]: { ...item.flags?.[MODULE_ID], auraDefinitionId: definition.id } },
      { key: item.system.identifier, type: "bestiary-item" });
    item.flags[MODULE_ID].automation.data = { ...item.flags[MODULE_ID].automation.data, auraDefinitionId: definition.id };
    const marker = `data-grimgutz-aura="${definition.id}"`;
    if (!item.system.description.value.includes(marker)) item.system.description.value += `<hr><p ${marker}><strong>Автоматизация Foundry:</strong> ${text}</p>`;
  }
  return documents;
}
