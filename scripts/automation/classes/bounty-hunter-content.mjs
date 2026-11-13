import { defineContent } from "../shared/content.mjs";
import { syncHunter, validateHunterItem } from "./bounty-hunter.mjs";
import { controlHunter, installHunterActionHooks } from "./bounty-hunter-actions.mjs";
import { installHunterCombatHooks } from "./bounty-hunter-combat.mjs";
import { installHunterZoneHooks } from "./bounty-hunter-zones.mjs";
import { installHunterEventHooks } from "./bounty-hunter-events.mjs";
import { validateHunterDisposable } from "./bounty-hunter-capture.mjs";

export const BOUNTY_HUNTER_CONTENT = defineContent({
  id: "bounty-hunter",
  kind: "class",
  actions: { "bounty-hunter-control": controlHunter },
  itemValidators: [validateHunterItem],
  install() {
    installHunterActionHooks();
    installHunterCombatHooks();
    installHunterZoneHooks();
    installHunterEventHooks();
    Hooks.on("dnd5e.preUseActivity", validateHunterDisposable);
  },
  sync: syncHunter
});
