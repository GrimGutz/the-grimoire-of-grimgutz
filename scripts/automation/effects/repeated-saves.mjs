import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { isEffectActive } from "./temporary-effects.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";
import { isForwardTurn, previousCombatActor } from "../shared/combat-flow.mjs";
import { dispatchAutomationPulse } from "../midi/aura-workflow.mjs";

const processedTurns = new Set();
export async function processRepeatedSaves(
  actor,
  event = "turnEnd",
  { pulse = dispatchAutomationPulse, eventKey = null, effectUuid = null } = {}
) {
  if (!actor || !enabled() || !isGmAuthority()) return;
  for (const effect of [...(actor.effects ?? [])]) {
    if (effectUuid && effect.uuid !== effectUuid) continue;
    const save = effect.getFlag?.(MODULE_ID, "repeatSave");
    if (
      !save ||
      (save.event ?? "turnEnd") !== event ||
      !isEffectActive(effect) ||
      effect.getFlag?.(MODULE_ID, "repeatSaveReview") === true
    )
      continue;
    try {
      if (save.damage) {
        const source = await fromUuid(save.sourceTokenUuid),
          item = await fromUuid(save.sourceItemUuid),
          target = await fromUuid(save.targetTokenUuid);
        if (!source?.actor || !item || !target?.actor) {
          await effect.setFlag(MODULE_ID, "repeatSaveReview", true);
          continue;
        }
        await pulse({
          scene: source.parent,
          sourceToken: source.object ?? { actor: source.actor, document: source },
          sourceItem: item,
          targets: [target.object ?? { actor: target.actor, document: target }],
          event: {
            save: save.ability,
            dc: String(save.dc),
            damage: save.damage,
            onSave: "none",
            removeEffectOnSaveUuid: effect.uuid,
            ...(save.metadata ? { metadata: save.metadata } : {})
          },
          eventKey: `repeat:${effect.uuid}:${eventKey ?? `${game.combat?.id}:${game.combat?.round}:${game.combat?.turn}`}`
        });
        continue;
      }
      const rolls = await actor.rollSavingThrow(
        { ability: save.ability, target: Number(save.dc) },
        { configure: false }
      );
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
    void processRepeatedSaves(previousCombatActor(combat), "turnEnd", { eventKey: key }).catch(error =>
      console.error(`${MODULE_ID} | Repeated save failed`, error)
    );
  });
}
