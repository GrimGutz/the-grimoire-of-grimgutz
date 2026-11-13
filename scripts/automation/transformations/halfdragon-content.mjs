import { defineContent } from "../shared/content.mjs";
import {
  inspectHalfdragon,
  syncHalfdragon,
  validateHalfdragonAdvancement,
  validateHalfdragonItem
} from "./halfdragon.mjs";
import { controlHalfdragon } from "./halfdragon-actions.mjs";
import { installHalfdragonHooks } from "./halfdragon-events.mjs";
import { applyHalfdragonBite } from "./halfdragon-combat.mjs";

export const HALFDRAGON_CONTENT = defineContent({
  id: "halfdragon",
  kind: "transformation",
  actions: { "halfdragon-control": controlHalfdragon },
  itemValidators: [validateHalfdragonItem],
  advancementValidators: [validateHalfdragonAdvancement],
  install: installHalfdragonHooks,
  sync: syncHalfdragon,
  inspect: inspectHalfdragon,
  midi: { applyHalfdragonBite }
});
