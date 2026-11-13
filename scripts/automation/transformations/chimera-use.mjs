import { MODULE_ID } from "../shared/constants.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { chimeraDC } from "./chimera.mjs";
export function chimeraExpense(activity, { activation = "action", cost = 0 } = {}) {
  if (cost && itemUses(activity.item).remaining < cost) throw Error("Способность ещё не перезарядилась.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: cost ? [{ type: "itemUses", target: activity.item.id, value: String(cost) }] : []
    }
  };
}
export async function chimeraTargets(actor, source, range, title, { max = 1, self = false } = {}) {
  return chooseSceneTokens(actor, source.parent, {
    title,
    min: 1,
    max,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
}
export async function chimeraPulse(
  source,
  item,
  targets,
  { save = null, dc = chimeraDC(source.actor), damage = [], onSave = "none", requestId } = {}
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
      metadata: { chimeraResolved: true }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export async function chimeraCondition(
  source,
  target,
  item,
  { kind, statuses = [], seconds = null, repeat = null, extra = {} }
) {
  const immune = target.actor.system?.traits?.ci?.value,
    has = id => immune?.has?.(id) || immune?.includes?.(id);
  if (statuses.some(has)) return false;
  return target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `${item.name}: ${kind}`,
      img: item.img,
      type: "base",
      transfer: false,
      disabled: false,
      origin: item.uuid,
      statuses,
      ...(seconds
        ? temporaryEffectTiming({ seconds, actor: target.actor })
        : { start: null, duration: { value: null, units: "seconds", expiry: null, expired: false } }),
      flags: {
        [MODULE_ID]: {
          chimeraCondition: {
            kind,
            sourceActorUuid: source.actor.uuid,
            sourceTokenUuid: source.uuid,
            targetTokenUuid: target.uuid,
            sourceItemUuid: item.uuid,
            dc: chimeraDC(source.actor),
            ...extra
          },
          ...(repeat
            ? {
                repeatSave: {
                  ability: repeat,
                  dc: chimeraDC(source.actor),
                  event: "turnEnd",
                  sourceTokenUuid: source.uuid,
                  targetTokenUuid: target.uuid,
                  sourceItemUuid: item.uuid,
                  damage: [],
                  metadata: { chimeraResolved: true }
                }
              }
            : {})
        },
        dae: { expiryMode: "delete" }
      },
      system: { changes: [] }
    }
  ]);
}
