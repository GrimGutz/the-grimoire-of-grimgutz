import { defineContent } from "../shared/content.mjs";
import { syncFlagellant, validateFlagellantItem } from "./flagellant.mjs";
import { controlFlagellant } from "./flagellant-actions.mjs";
import { installFlagellantHooks } from "./flagellant-events.mjs";

export const FLAGELLANT_CONTENT = defineContent({
  id: "flagellant",
  kind: "class",
  actions: { "flagellant-control": controlFlagellant },
  itemValidators: [validateFlagellantItem],
  install: installFlagellantHooks,
  sync: syncFlagellant
});
