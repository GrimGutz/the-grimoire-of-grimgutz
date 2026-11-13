import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { dkHas, dkPassiveActive } from "./deathknight.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";
import { applyDeathknightHealing } from "./deathknight-combat.mjs";
const nonDamage = new Set(["healing", "temphp", "maximum", "midi-none"]);
registerGmRequest("deathknight-spell-type", async (actor, data, { requestId }) => {
  const activity = await fromUuid(data.activityUuid);
  if (
    !enabled() ||
    !isGmAuthority() ||
    activity?.actor?.uuid !== actor.uuid ||
    activity.item?.type !== "spell" ||
    !dkHas(actor, "souls") ||
    !dkPassiveActive(actor, "souls") ||
    !data.workflowId
  )
    return false;
  const old = nativeApplicationReply(actor, requestId);
  if (old) return old;
  return applyNativeOnce(
    actor,
    { requestId, action: "deathknight-spell-type", activityUuid: activity.uuid },
    async () => {
      return confirmOwner(
        actor,
        "Связь душ",
        "Заменить урон этого конкретного заклинания некротическим? Это добровольно и не меняет последующие заклинания."
      );
    },
    async () => true
  );
});
export async function prepareDeathknightSpell(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow.item?.type !== "spell" ||
    !dkHas(workflow.actor, "souls") ||
    !dkPassiveActive(workflow.actor, "souls") ||
    workflow.grimgutzDeathknightSpellPrepared
  )
    return;
  const parts = workflow.activity?.damage?.parts ?? [],
    base = workflow.item.system?.damage?.base;
  if (
    !parts.some(p => [...(p.types ?? [])].some(t => !nonDamage.has(t))) &&
    !(workflow.activity?.damage?.includeBase && base && [...(base.types ?? [])].some(t => !nonDamage.has(t)))
  )
    return;
  workflow.grimgutzDeathknightSpellPrepared = true;
  const result = await requestGm(
    "deathknight-spell-type",
    workflow.actor,
    { activityUuid: workflow.activity.uuid, workflowId: workflow.id },
    { requestId: `deathknight-type:${workflow.id}`, timeoutMs: 180000 }
  );
  workflow.grimgutzDeathknightNecrotic = result.status === "success";
}
export function applyDeathknightPacket(token, context) {
  const { workflow, damageItem } = context;
  if (!enabled() || workflow?.aborted || !token?.actor) return;
  const selector = damageItem.damageSelector ?? "combinedDamage";
  if (selector !== "combinedDamage") return;
  const smite = workflow.activity?.item?.system?.identifier === "divine-smite" && dkHas(workflow.actor, "anchor");
  if (smite || workflow.grimgutzDeathknightNecrotic) {
    const raw = damageItem.damageDetails?.[`raw${selector}`] ?? damageItem.rawDamageDetail;
    if (raw && typeof token.actor.calculateDamage === "function") {
      const fingerprint = () => JSON.stringify([raw, calculatedDamage(damageItem)]);
      if (damageItem.grimgutzDeathknightType !== fingerprint()) {
        const converted = structuredClone(raw).map(p =>
            !nonDamage.has(p.type) && Number(p.value) > 0 ? { ...p, type: "necrotic" } : p
          ),
          options = structuredClone(
            damageItem.damageDetails?.calcDamageOptions?.[selector] ??
              damageItem.calcDamageOptions ?? { invertHealing: true }
          );
        commitCalculatedDamage(token, damageItem, token.actor.calculateDamage(converted, options));
        damageItem.grimgutzDeathknightType = fingerprint();
      }
    }
  }
  applyDeathknightHealing(token, context);
}
