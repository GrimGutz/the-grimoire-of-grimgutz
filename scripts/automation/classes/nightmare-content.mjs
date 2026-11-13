import { defineContent } from "../shared/content.mjs";
import { syncNightmare, validateNightmareItem } from "./nightmare.mjs";
import { controlNightmare } from "./nightmare-actions.mjs";
import { installNightmareHooks } from "./nightmare-events.mjs";
import { controlNightmareSummon } from "./nightmare-summons.mjs";

export const NIGHTMARE_CONTENT = defineContent({
  id: "nightmare",
  kind: "class",
  actions: { "nightmare-control": controlNightmare, "nightmare-summon-control": controlNightmareSummon },
  itemValidators: [validateNightmareItem],
  install: installNightmareHooks,
  sync: syncNightmare
});
