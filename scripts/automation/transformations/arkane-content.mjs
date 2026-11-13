import { defineContent } from "../shared/content.mjs";
import { inspectArkane, syncArkane, validateArkaneAdvancement, validateArkaneItem } from "./arkane.mjs";
import { controlArkane } from "./arkane-actions.mjs";
import { installArkaneHooks } from "./arkane-events.mjs";

export const ARKANE_CONTENT = defineContent({
  id: "arkane",
  kind: "transformation",
  actions: { "arkane-control": controlArkane },
  itemValidators: [validateArkaneItem],
  advancementValidators: [validateArkaneAdvancement],
  install: installArkaneHooks,
  sync: syncArkane,
  inspect: inspectArkane
});
