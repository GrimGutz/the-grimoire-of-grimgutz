import { MODULE_ID } from "./common.mjs";
import { AREA_DEFINITIONS, areaActivityData } from "../scripts/automation/shared/area-definitions.mjs";

export function configureAreaActivities(documents) {
  for (const document of documents) for (const [id, original] of Object.entries(document.system?.activities ?? {})) {
    const action = original.flags?.[MODULE_ID]?.action ?? original.flags?.[MODULE_ID]?.moduleAction;
    const definition = AREA_DEFINITIONS.find(entry => entry.feature === document.system.identifier
      && (entry.action ? entry.action === action : entry.activityName === original.name));
    if (!definition) continue;
    // A stored activity must contain legal damage types; alignment is resolved
    // per cast from the untouched configuration below, never from a fake type.
    const legal = { ...definition, damage: definition.damage.map(part => part.type === "alignment" ? { ...part, type: "radiant" } : part) };
    const activity = areaActivityData(original, legal);
    activity.flags ??= {}; activity.flags[MODULE_ID] ??= {};
    activity.flags[MODULE_ID].area = structuredClone(definition);
    activity.flags[MODULE_ID].schemaVersion = 1;
    activity.flags[MODULE_ID].automation ??= { version: 1, kind: "activity", id: definition.id, data: {} };
    activity.flags[MODULE_ID].automation.data ??= {};
    activity.flags[MODULE_ID].automation.data.area = structuredClone(definition);
    document.system.activities[id] = activity;
  }
  return documents;
}
