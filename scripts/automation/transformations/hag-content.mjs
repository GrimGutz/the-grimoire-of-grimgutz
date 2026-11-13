import { defineContent } from "../shared/content.mjs";
import { inspectHag, syncHag, validateHagAdvancement, validateHagItem } from "./hag.mjs";
import { controlHag } from "./hag-actions.mjs";
import { installHagHooks } from "./hag-events.mjs";
import { applyHagDamage, applyHagDefense } from "./hag-combat.mjs";

export const HAG_CONTENT = defineContent({
  id: "hag",
  kind: "transformation",
  actions: { "hag-control": controlHag },
  itemValidators: [validateHagItem],
  advancementValidators: [validateHagAdvancement],
  install: installHagHooks,
  sync: syncHag,
  inspect: inspectHag,
  midi: { applyHagDamage, applyHagDefense }
});
