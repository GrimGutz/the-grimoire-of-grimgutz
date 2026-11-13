import { MODULE_ID } from "../shared/constants.mjs";
import { automationData, automationAction, enabled, notify, reportFailure } from "../shared/helpers.mjs";
import { arkaneAvailable, arkaneHas, arkaneState, patchArkane } from "./arkane.mjs";
import { controlArkane } from "./arkane-actions.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { installArkaneStormHooks } from "./arkane-storm.mjs";
import {
  prepareArkaneSpellImmunity,
  prepareArkaneSpellSave,
  carryArkaneBarrierDamage,
  guardArkaneBarrierUpdate,
  cleanupArkaneBarrier
} from "./arkane-spells.mjs";
registerGmRequest("arkane-rest", (actor, _data, { requestId }) =>
  serialMutation(`arkane:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || !arkaneHas(actor, "body")) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "arkane-rest", activityUuid: null },
      async () => true,
      async () => {
        await patchArkane(actor, latest => ({ ...latest, restEpoch: Number(latest.restEpoch ?? 0) + 1 }));
        return true;
      }
    );
  })
);
export async function observeArkaneAppearance(actor) {
  if (!enabled() || !isGmAuthority() || !arkaneHas(actor, "appearance") || arkaneState(actor).appearance === "true")
    return;
  if (actor.statuses?.has("unconscious") || actor.concentration?.effects?.size)
    await patchArkane(actor, latest => ({ ...latest, appearance: "true" }));
}
export function installArkaneHooks() {
  const report = reportFailure("Arkane automation");
  const intercept = activity => {
    if (
      !enabled() ||
      automationData(activity).leaderResolved ||
      automationData(activity).auraPulse ||
      automationData(activity).arkaneResolved ||
      automationAction(activity) !== "arkane-control"
    )
      return;
    if (!arkaneAvailable(activity.actor, activity.item)) {
      notify("Не открыт уровень Присутствия или не получен обязательный бонус.", "warn");
      return false;
    }
    report(controlArkane(activity.actor, activity));
    return false;
  };
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => intercept(workflow?.activity));
  Hooks.on("dnd5e.preUseActivity", intercept);
  Hooks.on("midi-qol.prePreambleComplete", prepareArkaneSpellImmunity);
  Hooks.on("midi-qol.preTargetSave", prepareArkaneSpellSave);
  Hooks.on("preUpdateActor", guardArkaneBarrierUpdate);
  Hooks.on("dnd5e.preApplyDamage", carryArkaneBarrierDamage);
  Hooks.on("updateActor", actor => {
    report(observeArkaneAppearance(actor));
    report(cleanupArkaneBarrier(actor));
  });
  Hooks.on("updateToken", (token, changes) => {
    if (token.actor && (changes.delta || Object.keys(changes).some(k => k.startsWith("delta.")))) {
      report(observeArkaneAppearance(token.actor));
      report(cleanupArkaneBarrier(token.actor));
    }
  });
  for (const name of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"])
    Hooks.on(name, effect => {
      if (effect.parent?.documentName === "Actor") report(observeArkaneAppearance(effect.parent));
    });
  Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
    if ((result.longRest || result.type === "long" || config?.type === "long") && arkaneHas(actor, "body")) {
      const id = (result.arkaneRestId ??= result.message?.uuid ?? foundry.utils.randomID());
      report(requestGm("arkane-rest", actor, {}, { requestId: `arkane-rest:${id}` }));
    }
  });
  installArkaneStormHooks();
}
