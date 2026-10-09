import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { isEffectActive } from "./temporary-effects.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";
import { isForwardTurn, previousCombatActor } from "../shared/combat-flow.mjs";

const processedTurns = new Set();
export async function processRepeatedSaves(actor, event = "turnEnd") {
  if (!actor || !enabled() || !isGmAuthority()) return;
  for (const effect of [...(actor.effects ?? [])]) {
    const save = effect.getFlag?.(MODULE_ID, "repeatSave");
    if (!save || (save.event ?? "turnEnd") !== event || !isEffectActive(effect)) continue;
    try {
      const rolls = await actor.rollSavingThrow({ ability: save.ability, target: Number(save.dc) }, { configure: false });
      if (rolls?.length && Number(rolls[0].total) >= Number(save.dc)) await effect.delete();
    } catch (error) {
      console.error(`${MODULE_ID} | Repeated save failed for ${effect.uuid}`, error);
    }
  }
}
export function installRepeatedSaveHooks() {
  Hooks.on("updateCombat", (combat, changes) => {
    if (!isForwardTurn(combat, changes)) return;
    const key = `${combat.id}:${combat.previous.round}:${combat.previous.turn}:${combat.previous.combatantId}`;
    if (processedTurns.has(key)) return;
    processedTurns.add(key);
    if (processedTurns.size > 200) processedTurns.delete(processedTurns.values().next().value);
    void processRepeatedSaves(previousCombatActor(combat)).catch(error => console.error(`${MODULE_ID} | Repeated save failed`, error));
  });
}
