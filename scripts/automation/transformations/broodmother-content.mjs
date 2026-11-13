import { defineContent } from "../shared/content.mjs";
import {
  inspectBroodmother,
  syncBroodmother,
  validateBroodmotherAdvancement,
  validateBroodmotherItem
} from "./broodmother.mjs";
import { controlBroodmother } from "./broodmother-actions.mjs";
import { installBroodmotherHooks } from "./broodmother-events.mjs";
import { applyBroodmotherToxicDamage } from "./broodmother-combat.mjs";

export const BROODMOTHER_CONTENT = defineContent({
  id: "broodmother",
  kind: "transformation",
  actions: { "broodmother-control": controlBroodmother },
  itemValidators: [validateBroodmotherItem],
  advancementValidators: [validateBroodmotherAdvancement],
  install: installBroodmotherHooks,
  sync: syncBroodmother,
  inspect: inspectBroodmother,
  midi: { applyBroodmotherToxicDamage }
});
