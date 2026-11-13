import { defineContent } from "../shared/content.mjs";
import { inspectGod, syncGod, validateGodAdvancement, validateGodItem } from "./god.mjs";
import { controlGod } from "./god-actions.mjs";
import { installGodHooks } from "./god-events.mjs";
import { applyGodDefenses, applyGodElement } from "./god-midi.mjs";

export const GOD_CONTENT = defineContent({
  id: "god",
  kind: "transformation",
  actions: { "god-control": controlGod },
  itemValidators: [validateGodItem],
  advancementValidators: [validateGodAdvancement],
  install: installGodHooks,
  sync: syncGod,
  inspect: inspectGod,
  midi: { applyGodElement, applyGodDefenses }
});
