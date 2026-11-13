import { defineContent } from "../shared/content.mjs";
import { syncEmpath, validateEmpathItem } from "./empath.mjs";
import { controlEmpath } from "./empath-actions.mjs";
import { installEmpathHooks } from "./empath-events.mjs";

export const EMPATH_CONTENT = defineContent({
  id: "empath",
  kind: "class",
  actions: { "empath-control": controlEmpath },
  itemValidators: [validateEmpathItem],
  install: installEmpathHooks,
  sync: syncEmpath
});
