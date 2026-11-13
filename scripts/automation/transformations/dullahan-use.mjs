import { itemUses } from "../shared/helpers.mjs";
import { chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { dullahanDC } from "./dullahan.mjs";
export const dullahanGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export function dullahanExpense(activity, { activation = "action", cost = 0 } = {}) {
  if (cost && itemUses(activity.item).remaining < cost) throw Error("Недостаточно ресурса способности.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: cost ? [{ type: "itemUses", target: activity.item.id, value: String(cost) }] : []
    }
  };
}
export async function dullahanTargets(actor, source, range, title, { max = 1, self = false } = {}) {
  return chooseSceneTokens(actor, source.parent, {
    title,
    min: 1,
    max,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
}
export async function dullahanPulse(
  source,
  item,
  targets,
  { save = null, dc = dullahanDC(source.actor), damage = [], onSave = "none", requestId, metadata = {} } = {}
) {
  const place = t => t.object ?? { actor: t.actor, document: t };
  const result = await useAuraPulse({
    scene: source.parent,
    sourceToken: place(source),
    sourceItem: item,
    targets: targets.map(place),
    eventKey: requestId,
    event: {
      ...(save ? { save, dc: String(dc), returnSaveOutcome: true } : {}),
      damage,
      onSave,
      metadata: { dullahanResolved: true, ...metadata }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export const dullahanImmune = (actor, status) =>
  actor.system?.traits?.ci?.value?.has?.(status) || actor.system?.traits?.ci?.value?.includes?.(status);
