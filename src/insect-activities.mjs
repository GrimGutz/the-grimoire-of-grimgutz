import { MODULE_ID } from "./common.mjs";
import { areaDamagePart } from "../scripts/automation/shared/area-definitions.mjs";
export function configureInsectBloodActivities(documents) {
  const card = documents.find(item => item.system.identifier === "blood-drain");
  if (!card) return documents;
  for (const activity of Object.values(card.system.activities)) {
    const flags = activity.flags[MODULE_ID], bite = flags.action === "roll-insect-bite";
    flags.action = ""; flags.moduleAction = "";
    flags.automation.action = { id: "", data: {} }; flags.automation.data.action = "";
    flags[bite ? "insectBite" : "bloodDrain"] = true;
    flags.automation.data[bite ? "insectBite" : "bloodDrain"] = true;
    activity.type = bite ? "attack" : "damage"; delete activity.roll;
    if (bite) activity.attack = { ability: "str", bonus: "@abilities.str.mod + @prof", flat: true, type: { value: "melee", classification: "weapon" } };
    activity.damage = { includeBase: false, parts: [areaDamagePart({ formula: bite ? "1d4" : "2d6", type: "piercing" })] };
    activity.range = { value: 5, units: "ft", override: true };
    activity.target.prompt = true; activity.target.override = true;
  }
  return documents;
}
