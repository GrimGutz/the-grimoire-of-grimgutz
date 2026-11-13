import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { feetToSceneUnits } from "../shared/spatial.mjs";
import {
  activityActor,
  activityItem,
  automationData,
  enabled,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  notify
} from "../shared/helpers.mjs";
import { leaderClass } from "../shared/selectors.mjs";
import { encounterForActor, combatTurnSnapshot } from "../shared/combat-flow.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";

const leaderPassiveSyncs = new Set();

export async function armGlimpseOfGenius(actor) {
  if (!actor || !hasFeature(actor, "glimpse-of-genius")) return false;
  await actor.setFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED, true);
  notify(`${actor.name}: следующая стратагема использует «Проблеск гения».`);
  return true;
}

function leaderMovementBonusChanges(actor, bonus = 10) {
  const movement = actor.system.attributes?.movement ?? {};
  return ["walk", "burrow", "climb", "fly", "swim"]
    .filter(type => Number(movement[type] ?? 0) > 0)
    .map(type => ({
      key: `system.attributes.movement.${type}`,
      type: "add",
      value: String(bonus),
      phase: "final",
      priority: 20
    }));
}

function leaderPassiveDefinitions(actor) {
  if (!leaderClass(actor)) return [];
  const definitions = [];

  const boisterous = findFeature(actor, "boisterous-presence");
  const configured = actor
    .getFlag?.(MODULE_ID, "leaderPresenceRecipients")
    ?.some(record => record.key === "boisterous-presence");
  if (boisterous && !configured) {
    const changes = leaderMovementBonusChanges(actor, 10);
    if (changes.length) {
      definitions.push(
        flaggedPassiveEffectData(MODULE_ID, FLAGS.LEADER_PASSIVE, {
          key: "boisterous-presence",
          feature: boisterous,
          changes
        })
      );
    }
  }

  return definitions;
}

export async function syncLeaderPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag?.(MODULE_ID, "leaderLegacyBoiConflict")) return;
  return syncFlaggedPassiveEffects(
    actor,
    leaderPassiveSyncs,
    MODULE_ID,
    FLAGS.LEADER_PASSIVE,
    leaderPassiveDefinitions
  );
}

export function validateStratagemUse(activity, combat = encounterForActor(activityActor(activity))) {
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (automationData(item).stratagem !== true || !combat?.started) return true;
  if (!actor?.getFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK)) return true;
  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) return true;
  notify(
    `${actor.name}: новую стратагему можно использовать в начале следующего хода или через «Проблеск гения».`,
    "warn"
  );
  return false;
}

function frontlineCommanderEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.FRONTLINE_EFFECT));
}

async function applyFrontlineCommander(actor, snapshot) {
  if (!hasFeature(actor, "frontline-commander") || !actor.isOwner) return;
  const movement = actor.system.attributes?.movement ?? {};
  const changes = ["walk", "burrow", "climb", "fly", "swim"]
    .filter(type => Number(movement[type] ?? 0) > 0)
    .map(type => ({
      key: `system.attributes.movement.${type}`,
      type: "add",
      value: feetToSceneUnits(10, { grid: { units: movement.units ?? "ft" } }),
      phase: "final",
      priority: 20
    }));
  if (!changes.length) return;

  const current = frontlineCommanderEffect(actor);
  const usedDuringOwnTurn = snapshot?.current.actor?.uuid === actor.uuid;
  if (current) {
    await current.update({
      "system.changes": changes,
      [`flags.${MODULE_ID}.${FLAGS.FRONTLINE_EFFECT}.skipCurrentTurnEnd`]: usedDuringOwnTurn
    });
    return;
  }

  await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: "Командир на передовой",
      img: "icons/skills/movement/arrow-upward-yellow.webp",
      origin: findFeature(actor, "frontline-commander")?.uuid,
      transfer: false,
      disabled: false,
      showIcon: 1,
      flags: {
        [MODULE_ID]: {
          [FLAGS.FRONTLINE_EFFECT]: {
            skipCurrentTurnEnd: usedDuringOwnTurn
          }
        }
      },
      start: null,
      duration: { value: null, units: "seconds", expiry: null, expired: false },
      system: { changes }
    }
  ]);
}

export async function handleStratagemUse(
  activity,
  { combat = encounterForActor(activityActor(activity)), snapshot = combat && combatTurnSnapshot(combat) } = {}
) {
  if (!enabled()) return;
  const item = activityItem(activity);
  const actor = activityActor(activity);
  if (!actor || automationData(item).stratagem !== true) return;

  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED);
    notify(`${actor.name}: стратагема применена через «Проблеск гения».`);
  } else if (combat?.started) {
    await actor.setFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK, {
      combat: snapshot.id,
      round: snapshot.current.round,
      turn: snapshot.current.turn
    });
  }

  await applyFrontlineCommander(actor, snapshot);
}

export async function beginLeaderTurn(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK);
  }
}

export async function endLeaderTurn(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED);
  }
  const effect = frontlineCommanderEffect(actor);
  if (!effect) return;
  const state = effect.getFlag(MODULE_ID, FLAGS.FRONTLINE_EFFECT);
  if (state?.skipCurrentTurnEnd) {
    await effect.update({
      [`flags.${MODULE_ID}.${FLAGS.FRONTLINE_EFFECT}.skipCurrentTurnEnd`]: false
    });
  } else {
    await effect.delete();
  }
}

export async function clearLeaderCombatState(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  if (actor.getFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.LEADER_STRATAGEM_LOCK);
  }
  if (actor.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) {
    await actor.unsetFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED);
  }
  const effect = frontlineCommanderEffect(actor);
  if (effect) await effect.delete();
}
