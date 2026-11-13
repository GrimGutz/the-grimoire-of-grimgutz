import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { requestGm } from "../shared/gm-requests.mjs";
import { activeBenefits, benefitData } from "../shared/combat-benefits.mjs";
import { maximizeHitDiceParts } from "./leader-events.mjs";

export async function prepareComfortHealing(workflow, activity) {
  if (
    !enabled() ||
    workflow?.grimgutzComfortPrepared ||
    workflow?.workflowOptions?.grimgutzAuraPulse ||
    activity?.type !== "heal" ||
    !activeBenefits(workflow.actor).some(effect => benefitData(effect).kind === "maximize-hit-dice")
  )
    return;
  const self =
    activity.target?.affects?.type === "self" ||
    [...(workflow.targets ?? [])].some(token => token.actor?.uuid === workflow.actor.uuid);
  if (!self) return;
  workflow.grimgutzComfortPrepared = true;
  const rollId = `comfort-healing:${workflow.id}`;
  const reservation = await requestGm("reserve-leader-hit-die", workflow.actor, { rollId }, { timeoutMs: 120000 });
  if (reservation.status === "success")
    workflow.grimgutzComfortReservation = { ...reservation, rollId, usedByIndex: {} };
  if (reservation.status === "pending") {
    workflow.aborted = true;
    await workflow.performState?.(workflow.WorkflowState_Abort);
    return false;
  }
}
export function applyComfortHealingConfig(config, roll, index) {
  const state = config?.workflow?.grimgutzComfortReservation;
  if (!state) return;
  // Native dialogs rebuild configurations before evaluation. Replace the count
  // for this build instead of spending dice again for every preview.
  if (index === 0) state.usedByIndex = {};
  const used = Object.values(state.usedByIndex).reduce((sum, value) => sum + value, 0);
  const result = maximizeHitDiceParts(roll.parts ?? [], Math.max(0, state.remaining - used));
  roll.parts = result.parts;
  state.usedByIndex[index] = result.used;
}
export async function finishComfortHealing(workflow) {
  const state = workflow?.grimgutzComfortReservation;
  if (!state || state.finished) return;
  state.finished = true;
  return requestGm("complete-leader-hit-die", workflow.actor, {
    rollId: state.rollId,
    effectUuid: state.effectUuid,
    used: Object.values(state.usedByIndex).reduce((sum, value) => sum + value, 0),
    rolled: Boolean(workflow.damageRolls?.length || workflow.damageRoll)
  });
}
export function installLeaderComfortHooks() {
  Hooks.on("dnd5e.postBuildDamageRollConfig", applyComfortHealingConfig);
}
