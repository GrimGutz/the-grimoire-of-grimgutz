import {
  gainHollowCharge,
  syncHollowPassiveEffects,
  syncHollowTransformation,
  useHollowCharges,
  validateHollowActivityUse
} from "./hollow.mjs";
import {
  syncMurderspawnPassiveEffects,
  syncMurderspawnTransformation
} from "./murderspawn.mjs";
import {syncArkane} from "./arkane.mjs";
import {syncAutomaton} from "./automaton.mjs";
import {syncBroodmother} from "./broodmother.mjs";
import {syncChimera} from "./chimera.mjs";
import {syncDeathknight} from "./deathknight.mjs";
import {syncDullahan} from "./dullahan.mjs";
import {syncFactory} from "./factory-passives.mjs";
import {syncGod} from "./god.mjs";
import {syncHag} from "./hag.mjs";

export const TRANSFORMATION_ACTIONS = new Set([
  "gain-hollow-charge",
  "use-hollow-charges"
]);

export {
  gainHollowCharge,
  syncHollowPassiveEffects,
  syncHollowTransformation,
  syncMurderspawnPassiveEffects,
  syncMurderspawnTransformation,
  useHollowCharges
};

export function isTransformationAction(action) {
  return TRANSFORMATION_ACTIONS.has(action);
}

export async function handleTransformationAction(actor, activity, action) {
  switch (action) {
    case "gain-hollow-charge":
      return gainHollowCharge(actor);
    case "use-hollow-charges":
      return useHollowCharges(actor, activity);
    default:
      return false;
  }
}

export function validateTransformationActivityUse(activity, action) {
  if (!isTransformationAction(action)) return true;
  return validateHollowActivityUse(activity);
}

export async function syncTransformationPassiveEffects(actor) {
  await syncMurderspawnPassiveEffects(actor);
  await syncHollowPassiveEffects(actor);
}

export async function syncTransformations(actor) {
  await syncMurderspawnTransformation(actor);
  await syncHollowTransformation(actor);
  await syncArkane(actor);
  await syncAutomaton(actor);
  await syncBroodmother(actor);
  await syncChimera(actor);
  await syncDeathknight(actor);
  await syncDullahan(actor);
  await syncFactory(actor);
  await syncGod(actor);
  await syncHag(actor);
}
