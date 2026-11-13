import { MODULE_ID } from "../shared/constants.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
import { addCombatBenefit, inFeet } from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { hdDC } from "./halfdragon.mjs";
export const hdGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export const hdTargets = (actor, source, range, title, { max = 1, self = false } = {}) =>
  chooseSceneTokens(actor, source.parent, {
    title,
    min: 1,
    max,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
export const hdAvailableHitDice = actor =>
  [...(actor.items ?? [])]
    .filter(i => i.type === "class")
    .reduce(
      (n, i) =>
        n +
        Math.max(
          0,
          Number(
            i.system.hd?.value ??
              Number(i.system.hd?.max ?? i.system.levels ?? 0) - Number(i.system.hd?.spent ?? i.system.hitDiceUsed ?? 0)
          )
        ),
      0
    );
export function hdExpense(activity, { resource = activity.item, cost = 0, activation = "action", hitDice = 0 } = {}) {
  if (cost && (!resource || resource.isSuppressed || itemUses(resource).remaining < cost))
    throw Error("Недостаточно применений/костей дыхания.");
  if (hitDice && hdAvailableHitDice(activity.actor) < hitDice) throw Error("Не хватает пяти доступных костей хитов.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: [
        ...(cost ? [{ type: "itemUses", target: resource.id, value: String(cost) }] : []),
        ...(hitDice ? [{ type: "hitDice", target: "smallest", value: String(hitDice) }] : [])
      ]
    }
  };
}
export const useHdCost = (activity, options = {}) =>
  useNativeUtility(activity, {
    dataPatch: hdExpense(activity, options),
    workflowOptions: { allowIncapacitated: options.activation === "special" }
  });
export async function hdPulse(
  source,
  item,
  targets,
  { save = null, dc = hdDC(source.actor), damage = [], onSave = "none", requestId, metadata = {} } = {}
) {
  if (!targets.length) return true;
  const p = t => t.object ?? { actor: t.actor, document: t };
  const result = await useAuraPulse({
    scene: source.parent,
    sourceToken: p(source),
    sourceItem: item,
    targets: targets.map(p),
    eventKey: requestId,
    event: {
      allowIncapacitated: true,
      ...(save ? { save, dc: String(dc), returnSaveOutcome: true } : {}),
      damage,
      onSave,
      metadata: { halfdragonResolved: true, ...metadata }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export async function hdCondition(
  source,
  target,
  item,
  { kind, statuses = [], seconds = null, repeat = null, extra = {}, changes = [] }
) {
  const immune = target.actor.system.traits?.ci?.value;
  if (statuses.some(s => immune?.has?.(s) || immune?.includes?.(s))) return false;
  const [e] = await target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `${item.name}: ${kind}`,
      img: item.img,
      type: "base",
      transfer: false,
      disabled: false,
      origin: item.uuid,
      statuses,
      ...(seconds
        ? temporaryEffectTiming({ seconds, actor: target.actor, expiry: "updateWorldTime" })
        : { start: null, duration: { value: null, units: "seconds", expiry: null, expired: false } }),
      flags: {
        [MODULE_ID]: {
          halfdragonCondition: {
            kind,
            sourceActorUuid: source.actor.uuid,
            sourceTokenUuid: source.uuid,
            targetTokenUuid: target.uuid,
            sourceItemUuid: item.uuid,
            ...extra
          },
          ...(repeat
            ? {
                repeatSave: {
                  ability: repeat,
                  dc: hdDC(source.actor),
                  event: "turnEnd",
                  sourceTokenUuid: source.uuid,
                  targetTokenUuid: target.uuid,
                  sourceItemUuid: item.uuid,
                  damage: [],
                  metadata: { halfdragonResolved: true }
                }
              }
            : {})
        },
        dae: { expiryMode: "delete" }
      },
      system: { changes }
    }
  ]);
  return e;
}
export async function hdTurnBenefit(source, target, item, kind, changes = []) {
  const combat = encounterForScene(source.parent, source);
  return addCombatBenefit(source, target, item, {
    kind,
    expiry: combat?.started ? "sourceEnd" : null,
    changes,
    halfdragonTurnRule: true
  });
}
