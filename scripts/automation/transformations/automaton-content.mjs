import { defineContent } from "../shared/content.mjs";
import { inspectAutomaton, syncAutomaton, validateAutomatonAdvancement, validateAutomatonItem } from "./automaton.mjs";
import { controlAutomaton } from "./automaton-actions.mjs";
import { installAutomatonHooks } from "./automaton-events.mjs";
import { finishAutomatonCoils, prepareAutomatonDamage } from "./automaton-combat.mjs";

export const AUTOMATON_CONTENT = defineContent({
  id: "automaton",
  kind: "transformation",
  actions: { "automaton-control": controlAutomaton },
  itemValidators: [validateAutomatonItem],
  advancementValidators: [validateAutomatonAdvancement],
  install: installAutomatonHooks,
  sync: syncAutomaton,
  inspect: inspectAutomaton,
  midi: { prepareAutomatonDamage, finishAutomatonCoils }
});
