import { defineContent } from "../shared/content.mjs";
import { syncJester, validateJesterItem } from "./jester.mjs";
import { controlJester } from "./jester-actions.mjs";
import { installJesterHooks } from "./jester-events.mjs";

export const JESTER_CONTENT = defineContent({
  id: "jester",
  kind: "class",
  actions: { "jester-control": controlJester },
  itemValidators: [validateJesterItem],
  install: installJesterHooks,
  sync: syncJester
});
