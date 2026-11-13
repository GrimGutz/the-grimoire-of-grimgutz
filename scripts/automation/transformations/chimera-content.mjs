import { defineContent } from "../shared/content.mjs";
import { inspectChimera, syncChimera, validateChimeraAdvancement, validateChimeraItem } from "./chimera.mjs";
import { controlChimera } from "./chimera-actions.mjs";
import { installChimeraHooks } from "./chimera-events.mjs";
import { applyChimeraDamagePacket } from "./chimera-spells.mjs";

export const CHIMERA_CONTENT = defineContent({
  id: "chimera",
  kind: "transformation",
  actions: { "chimera-control": controlChimera },
  itemValidators: [validateChimeraItem],
  advancementValidators: [validateChimeraAdvancement],
  install: installChimeraHooks,
  sync: syncChimera,
  inspect: inspectChimera,
  midi: { applyChimeraDamagePacket }
});
