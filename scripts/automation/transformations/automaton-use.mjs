import { MODULE_ID } from "../shared/constants.mjs";
import { itemUses } from "../shared/helpers.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { canReact, inFeet } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";
import { automatonDC } from "./automaton.mjs";
export const automatonGm = actor => ({ uuid: actor.uuid, testUserPermission: user => user.isGM });
export const automatonPlaceable = token => token.object ?? { actor: token.actor, document: token };
export function automatonExpense(activity, { activation = "action", cost = 0 } = {}) {
  if (cost && itemUses(activity.item).remaining < cost) throw Error("Нет использований способности.");
  if (activation === "reaction" && !canReact(activity.actor)) throw Error("Нет свободной реакции.");
  return {
    activation: { type: activation, value: activation === "special" ? null : 1, override: true },
    consumption: {
      spellSlot: false,
      targets: cost ? [{ type: "itemUses", target: activity.item.id, value: String(cost) }] : []
    }
  };
}
export async function automatonTarget(actor, source, range, title) {
  const targets = await chooseSceneTokens(actor, source.parent, {
    title,
    min: 1,
    max: 1,
    exclude: [source.uuid],
    relation: t => inFeet(source, t, range, source.parent)
  });
  return targets?.[0] ?? null;
}
export async function automatonPulse(
  source,
  item,
  targets,
  { save = null, damage = [], onSave = "none", requestId } = {}
) {
  const result = await useAuraPulse({
    scene: source.parent,
    sourceToken: automatonPlaceable(source),
    sourceItem: item,
    targets: targets.map(automatonPlaceable),
    eventKey: requestId,
    event: {
      ...(save ? { save, dc: String(automatonDC(source.actor)), returnSaveOutcome: true } : {}),
      damage,
      onSave,
      metadata: { automatonResolved: true }
    }
  });
  return result == null || result === false || result.aborted || ["pending", "needs-review"].includes(result.status)
    ? { status: "needs-review" }
    : result;
}
export async function automatonStateEffect(actor, item, key, { changes = [], statuses = [], description = "" } = {}) {
  const old = [...(actor.effects ?? [])].filter(e => e.getFlag?.(MODULE_ID, "automatonStateEffect") === key);
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
    {
      name: item.name,
      img: item.img,
      type: "base",
      transfer: false,
      disabled: false,
      showIcon: 1,
      origin: item.uuid,
      statuses,
      description,
      start: null,
      duration: { value: null, units: "seconds", expiry: null, expired: false },
      flags: { [MODULE_ID]: { automatonStateEffect: key } },
      system: { changes }
    }
  ]);
  if (!effect) throw Error("Эффект не создан.");
  for (const e of old) await e.delete();
  return effect;
}
export async function removeAutomatonStateEffect(actor, key) {
  for (const e of [...(actor.effects ?? [])])
    if (e.getFlag?.(MODULE_ID, "automatonStateEffect") === key) await e.delete();
}
export async function automatonRoll(actor, formula, title) {
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: title });
  return Number(roll.total);
}
export async function confirmAutomatonGm(actor, title, text) {
  return confirmOwner(automatonGm(actor), title, text);
}
export async function automatonDamageType(actor, title) {
  return askOwner(automatonGm(actor), {
    title,
    choices: Object.entries(
      CONFIG.DND5E.damageTypes ?? { force: "Силовой", bludgeoning: "Дробящий", lightning: "Электричество" }
    ).map(([k, v]) => [k, typeof v === "string" ? v : (game.i18n?.localize?.(v.label) ?? k)])
  });
}
