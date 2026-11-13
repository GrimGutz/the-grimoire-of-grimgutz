import { MODULE_ID } from "../shared/constants.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { inFeet, canReact } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { factoryDC } from "./factory.mjs";
import { serialMutation } from "../shared/transactions.mjs";
export const factoryGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export function factoryExpense(activity, { activation = "action", cost = 0 } = {}) {
  if (cost && itemUses(activity.item).remaining < cost) throw Error("Нет доступных применений.");
  if (activation === "reaction" && !canReact(activity.actor)) throw Error("Нет свободной реакции.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: cost ? [{ type: "itemUses", target: activity.item.id, value: String(cost) }] : []
    }
  };
}
export async function factoryTargets(actor, source, range, title, { max = 1, self = false } = {}) {
  return chooseSceneTokens(actor, source.parent, {
    title,
    min: 1,
    max,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
}
export async function factoryPulse(
  source,
  item,
  targets,
  { save = null, dc = factoryDC(source.actor), damage = [], onSave = "none", requestId, metadata = {} } = {}
) {
  if (metadata.factoryReflection || metadata.factoryRetaliation)
    await serialMutation(`factory-pulse:${source.actor.uuid}`, async () => {
      const old = source.actor.getFlag(MODULE_ID, "factoryPulseOrigins") ?? {};
      await source.actor.setFlag(
        MODULE_ID,
        "factoryPulseOrigins",
        Object.fromEntries(
          [
            ...Object.entries(old),
            [
              requestId,
              { reflection: metadata.factoryReflection === true, retaliation: metadata.factoryRetaliation === true }
            ]
          ].slice(-128)
        )
      );
    });
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
      metadata: { factoryResolved: true, ...metadata }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
