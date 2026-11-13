import { MODULE_ID } from "../shared/constants.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { godPool, godDC, godFunctional } from "./god.mjs";
import { canReact, inFeet } from "../shared/combat-benefits.mjs";
import { chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { serialMutation } from "../shared/transactions.mjs";
export const godGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export function godExpense(activity, { points = 0, activation = "action" } = {}) {
  const actor = activity.actor,
    pool = godPool(actor);
  if (!godFunctional(actor) || !pool || pool.isSuppressed) throw Error("Божественное рвение недоступно.");
  if (!Number.isInteger(points) || points < 0 || itemUses(pool).remaining < points) throw Error("Недостаточно ОР.");
  if (activation === "reaction" && !canReact(actor)) throw Error("Нет свободной реакции.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: points ? [{ type: "itemUses", target: pool.id, value: String(points) }] : []
    }
  };
}
export const useGodCost = (activity, options) =>
  useNativeUtility(activity, {
    dataPatch: godExpense(activity, options),
    workflowOptions: { allowIncapacitated: options?.activation === "special" }
  });
export const godTargets = (actor, source, range, title, { max = 1, self = false, min = 1 } = {}) =>
  chooseSceneTokens(actor, source.parent, {
    title,
    min,
    max,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
export async function godPulse(
  source,
  item,
  targets,
  { save = null, dc = godDC(source.actor), damage = [], onSave = "none", requestId, metadata = {} } = {}
) {
  if (!targets.length) return true;
  if (metadata.godJudgmentOwn)
    await serialMutation(`god-pulses:${source.actor.uuid}`, () =>
      source.actor.setFlag(
        MODULE_ID,
        "godPulseOrigins",
        Object.fromEntries(
          [
            ...Object.entries(source.actor.getFlag(MODULE_ID, "godPulseOrigins") ?? {}),
            [requestId, { judgment: true }]
          ].slice(-128)
        )
      )
    );
  const place = t => t.object ?? { actor: t.actor, document: t },
    result = await useAuraPulse({
      scene: source.parent,
      sourceToken: place(source),
      sourceItem: item,
      targets: targets.map(place),
      eventKey: requestId,
      event: {
        ...(save ? { save, dc: String(dc), returnSaveOutcome: true } : {}),
        damage,
        onSave,
        metadata: { godResolved: true, ...metadata }
      }
    });
  return result == null || result === false || result.aborted || ["needs-review", "pending"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export async function applyGodHealing(sourceActor, targetActor, amount) {
  let n = Math.max(0, Math.floor(Number(amount)));
  const { godHas } = await import("./god.mjs");
  if (sourceActor.uuid !== targetActor.uuid && godHas(targetActor, "curse")) n = Math.floor(n / 2);
  const hp = targetActor.system.attributes.hp,
    before = Number(hp.value),
    max = Number(hp.effectiveMax ?? hp.max),
    next = Math.min(max, before + n);
  if (next !== before) await targetActor.update({ "system.attributes.hp.value": next });
  return next - before;
}
