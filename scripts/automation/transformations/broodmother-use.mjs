import { MODULE_ID } from "../shared/constants.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { confirmOwner, askOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { canReact, inFeet } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { broodmotherDC, broodmotherHas } from "./broodmother.mjs";
import { temporaryEffectTiming } from "../effects/temporary-effects.mjs";
export const broodmotherGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export const broodmotherPlaceable = token => token.object ?? { actor: token.actor, document: token };
export function broodmotherExpense(activity, { activation = "action", cost = 0, hitDice = 0 } = {}) {
  if (cost && itemUses(activity.item).remaining < cost) throw Error("Способность ещё не перезарядилась.");
  if (activation === "reaction" && !canReact(activity.actor)) throw Error("Нет свободной реакции.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: [
        ...(cost ? [{ type: "itemUses", target: activity.item.id, value: String(cost) }] : []),
        ...(hitDice ? [{ type: "hitDice", target: "smallest", value: String(hitDice) }] : [])
      ]
    }
  };
}
export async function broodmotherTarget(actor, source, range, title, { self = false } = {}) {
  const targets = await chooseSceneTokens(actor, source.parent, {
    title,
    min: 1,
    max: 1,
    exclude: self ? [] : [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
  return targets?.[0] ?? null;
}
export async function broodmotherPulse(
  source,
  item,
  targets,
  { save = null, damage = [], onSave = "none", requestId, poison = false, dc = broodmotherDC(source.actor) } = {}
) {
  const result = await useAuraPulse({
    scene: source.parent,
    sourceToken: broodmotherPlaceable(source),
    sourceItem: item,
    targets: targets.map(broodmotherPlaceable),
    eventKey: requestId,
    event: {
      ...(save ? { save, dc: String(dc), returnSaveOutcome: true } : {}),
      damage,
      onSave,
      metadata: { broodmotherResolved: true, ...(poison ? { broodmotherPoison: true } : {}) }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export async function broodmotherCondition(
  source,
  target,
  item,
  { kind, statuses = [], seconds = null, repeat = null, extra = {} }
) {
  const timing = seconds
    ? temporaryEffectTiming({ seconds, actor: target.actor })
    : { start: null, duration: { value: null, units: "seconds", expiry: null, expired: false } };
  const poison = statuses.includes("poisoned"),
    toxic = poison && broodmotherHas(source.actor, "toxicologist"),
    immune = target.actor.system?.traits?.ci?.value;
  const immunePoison = immune?.has?.("poisoned") || immune?.includes?.("poisoned");
  if (poison && immunePoison && !toxic) return false;
  if (
    poison &&
    immunePoison &&
    !(await confirmOwner(
      broodmotherGm(source.actor),
      "Токсиколог: иммунная цель",
      "Спасбросок был с преимуществом. Отравление/паралич иммунной цели применяются GM вручную: постоянный иммунитет не удаляется. Записать связь состояния?"
    ))
  )
    return false;
  const final = [...statuses];
  if (toxic && !final.includes("paralyzed")) final.push("paralyzed");
  return target.actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `${item.name}: ${kind}`,
      img: item.img,
      type: "base",
      transfer: false,
      disabled: false,
      showIcon: 1,
      origin: item.uuid,
      statuses: final,
      ...timing,
      flags: {
        [MODULE_ID]: {
          broodmotherCondition: {
            kind,
            sourceActorUuid: source.actor.uuid,
            sourceTokenUuid: source.uuid,
            targetTokenUuid: target.uuid,
            sourceItemUuid: item.uuid,
            dc: broodmotherDC(source.actor),
            ...extra
          },
          ...(repeat
            ? {
                repeatSave: {
                  ability: repeat,
                  dc: broodmotherDC(source.actor),
                  event: "turnEnd",
                  sourceTokenUuid: source.uuid,
                  targetTokenUuid: target.uuid,
                  sourceItemUuid: item.uuid,
                  damage: [],
                  metadata: { broodmotherResolved: true, ...(poison ? { broodmotherPoison: true } : {}) }
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
export async function broodmotherChooseCondition(actor, source, kinds, { range = 5, self = false } = {}) {
  const token = await broodmotherTarget(actor, source, range, "Выберите существо со связанным эффектом", { self });
  if (!token) return null;
  const effects = [...(token.actor.effects ?? [])].filter(e =>
    kinds.includes(e.getFlag?.(MODULE_ID, "broodmotherCondition")?.kind)
  );
  const uuid = await askOwner(actor, {
    title: "Снять только выбранный эффект",
    choices: effects.map(e => [e.uuid, e.name])
  });
  const effect = effects.find(e => e.uuid === uuid);
  return effect ? { token, effect, data: effect.getFlag(MODULE_ID, "broodmotherCondition") } : null;
}
