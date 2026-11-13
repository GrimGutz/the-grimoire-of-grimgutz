import { defineContent } from "../shared/content.mjs";
import { syncDoomed, validateDoomedItem } from "./doomed.mjs";
import { controlDoomed } from "./doomed-actions.mjs";
import { installDoomedHooks } from "./doomed-events.mjs";

export const DOOMED_CONTENT = defineContent({
  id: "doomed",
  kind: "class",
  actions: { "doomed-control": controlDoomed },
  itemValidators: [validateDoomedItem],
  install: installDoomedHooks,
  sync: syncDoomed
});
