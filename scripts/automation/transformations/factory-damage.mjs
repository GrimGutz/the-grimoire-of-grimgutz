import { MODULE_ID } from "../shared/constants.mjs";
import { enabled } from "../shared/helpers.mjs";
import { factoryAugment, factoryContext, factoryState, patchFactory } from "./factory.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { onPrepareDamage } from "../shared/damage-events.mjs";
import { appendCalculatedBonus } from "../shared/combat-benefits.mjs";
import { calculatedDamage } from "../midi/damage-packet.mjs";
import { flagKey } from "../shared/flag-write.mjs";
export const factoryIsUnarmed = activity =>
  activity?.type === "attack" &&
  (activity.attack?.type?.classification === "unarmed" ||
    ["unarmed-strike", "unarmed"].includes(activity.item?.system?.identifier));
// fromUuid resolves the real owned activity, not its transient aura clone.
// Preserve the GM-recorded pulse origin in the confirmed damage receipt.
onPrepareDamage(async ({ actor, data }) => {
  if (!enabled() || !data.automatic || !data.auraEventKey) return null;
  const origin = actor.getFlag(MODULE_ID, "factoryPulseOrigins")?.[data.auraEventKey];
  return origin ? { context: { factoryReflection: origin.reflection, factoryRetaliation: origin.retaliation } } : null;
});
onPrepareDamage(async ({ actor, activity }) => {
  if (!enabled() || activity.type !== "attack") return null;
  const bonuses = [],
    melee = activity.attack?.type?.value === "melee",
    ability = activity.ability ?? activity.attack?.ability ?? activity.item?.system?.ability;
  const gorilla = factoryAugment(actor, "gorilla"),
    berserk = factoryAugment(actor, "berserk");
  if (gorilla && factoryIsUnarmed(activity))
    bonuses.push({
      name: "Кулаки гориллы",
      value: Number(factoryContext(actor, gorilla).int) + (factoryAugment(actor, "back") ? 1 : 0)
    });
  if (berserk && melee && ability === "str")
    bonuses.push({ name: "Ярость берсерка", value: Number(factoryContext(actor, berserk).int) });
  return bonuses.length ? { bonuses } : null;
});
registerGmRequest("factory-damage", (actor, data) =>
  serialMutation(`factory-damage:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || !data.workflowId) return false;
    const activity = await fromUuid(data.activityUuid),
      target = await fromUuid(data.targetUuid);
    if (activity?.actor?.uuid !== actor.uuid || !target?.actor) return false;
    const key = flagKey(`${data.workflowId}:${target.uuid}`),
      previous = factoryState(actor).damageClaims?.[key];
    if (previous) return previous;
    const melee = activity.type === "attack" && activity.attack?.type?.value === "melee",
      charged = melee && factoryAugment(actor, "charged"),
      fangs =
        activity.item?.getFlag?.(MODULE_ID, "factoryInstalled")?.augmentId === "fangs" &&
        factoryAugment(actor, "fangs") &&
        factoryAugment(actor, "blood"),
      drive = activity.item?.type === "spell" && factoryState(actor).driveClaims?.[flagKey(data.workflowId)];
    if (!charged && !fangs && (!drive || drive.refunded)) return { status: "success", bonuses: [] };
    await patchFactory(actor, {
      damageClaims: { ...factoryState(actor).damageClaims, [key]: { status: "needs-review" } }
    });
    const bonuses = [],
      dice = data.critical ? 2 : 1;
    const roll = async (formula, type, name) => {
      const r = await new Roll(formula, actor.getRollData()).evaluate();
      await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: name });
      return { value: Number(r.total), type, name };
    };
    if (fangs) bonuses.push(await roll(`${dice}d4`, "poison", "Имплантированные клыки: Отравленная кровь"));
    if (
      charged &&
      (await confirmOwner(actor, "Заряженный", `Добавить ${dice}к10 электричества только этому рукопашному попаданию?`))
    )
      bonuses.push(await roll(`${dice}d10`, "lightning", "Заряженный"));
    if (drive && !drive.refunded && data.damageType) {
      let value = drive.value;
      if (value == null) {
        const result = await roll(
          `${drive.level * dice}d6`,
          data.damageType,
          "Интеллект-привод: одна общая добавка заклинания"
        );
        value = result.value;
        await patchFactory(actor, {
          driveClaims: { ...factoryState(actor).driveClaims, [flagKey(data.workflowId)]: { ...drive, value } }
        });
      }
      const saved = data.saved && activity.type === "save";
      if (!saved || activity.damage?.onSave !== "none")
        bonuses.push({
          value: saved && activity.damage?.onSave === "half" ? Math.floor(value / 2) : value,
          type: data.damageType,
          name: "Интеллект-привод"
        });
    }
    const reply = { status: "success", bonuses },
      claims = { ...factoryState(actor).damageClaims, [key]: reply };
    await patchFactory(actor, {
      damageClaims: Object.fromEntries([
        ...Object.entries(claims).filter(([, v]) => v.status !== "success"),
        ...Object.entries(claims)
          .filter(([, v]) => v.status === "success")
          .slice(-100)
      ])
    });
    return reply;
  })
);
export async function applyFactoryDamage(token, { workflow, damageItem }) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !token?.actor ||
    !workflow.actor ||
    !workflow.activity ||
    (damageItem.damageSelector ?? "combinedDamage") !== "combinedDamage"
  )
    return;
  const target = token.document ?? token,
    key = flagKey(`${workflow.id}:${target.uuid}`);
  if (damageItem.grimgutzFactoryDamage === key) return;
  if (
    workflow.activity.type === "attack" &&
    ![...(workflow.hitTargets ?? [])].some(t => (t.document?.uuid ?? t.uuid) === target.uuid)
  )
    return;
  if (
    !factoryAugment(workflow.actor, "charged") &&
    !factoryAugment(workflow.actor, "fangs") &&
    !factoryState(workflow.actor).driveClaims?.[flagKey(workflow.id)]
  )
    return;
  const saved = [...(workflow.saves ?? [])].some(t => (t.document?.uuid ?? t.uuid) === target.uuid),
    type = calculatedDamage(damageItem).find(
      p => !["healing", "temphp", "maximum", "midi-none"].includes(p.type)
    )?.type;
  const result = await requestGm(
    "factory-damage",
    workflow.actor,
    {
      activityUuid: workflow.activity.uuid,
      targetUuid: target.uuid,
      workflowId: workflow.id,
      critical: Boolean(workflow.isCritical && workflow.attackRoll),
      saved,
      damageType: type
    },
    { requestId: `factory-damage:${key}`, timeoutMs: 180000 }
  );
  if (result.status !== "success") return;
  for (const b of result.bonuses ?? []) if (b.value) await appendCalculatedBonus(token, damageItem, b.value, b.type);
  damageItem.grimgutzFactoryDamage = key;
}
