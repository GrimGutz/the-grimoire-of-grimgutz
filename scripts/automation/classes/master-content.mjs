import { defineContent } from "../shared/content.mjs";
import { syncMaster, validateMasterAdvancement, validateMasterItem } from "./master.mjs";
import { controlMaster, installMasterHooks } from "./master-combat.mjs";

export const MASTER_CONTENT = defineContent({
  id: "master",
  kind: "class",
  actions: { "master-control": controlMaster },
  itemValidators: [validateMasterItem],
  advancementValidators: [validateMasterAdvancement],
  install: installMasterHooks,
  sync: syncMaster
});
