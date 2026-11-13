import { defineContent } from "../shared/content.mjs";
import { inspectDullahan, syncDullahan, validateDullahanAdvancement, validateDullahanItem } from "./dullahan.mjs";
import { controlDullahan } from "./dullahan-actions.mjs";
import { installDullahanHooks } from "./dullahan-events.mjs";
import { applyDullahanPacket } from "./dullahan-combat.mjs";

export const DULLAHAN_CONTENT = defineContent({
  id: "dullahan",
  kind: "transformation",
  actions: { "dullahan-control": controlDullahan },
  itemValidators: [validateDullahanItem],
  advancementValidators: [validateDullahanAdvancement],
  install: installDullahanHooks,
  sync: syncDullahan,
  inspect: inspectDullahan,
  midi: { applyDullahanPacket }
});
