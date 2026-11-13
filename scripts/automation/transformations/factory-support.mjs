import { MODULE_ID } from "../shared/constants.mjs";
import { factoryAugment } from "./factory.mjs";
import { factoryChildSnapshot } from "./factory-homunculi.mjs";
import { askOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { temporaryEffectTiming, isEffectActive } from "../effects/temporary-effects.mjs";
import { onPrepareDamage } from "../shared/damage-events.mjs";

onPrepareDamage(async ({ actor, activity }) => {
  const ctx = factoryChildSnapshot(actor);
  if (
    ctx?.material !== "clay" ||
    !activity?.flags?.[MODULE_ID]?.factoryHomunculusSlam ||
    ![...(actor.effects ?? [])].some(e => e.getFlag?.(MODULE_ID, "factoryClay") && isEffectActive(e))
  )
    return null;
  return { bonuses: [{ name: "Кислотная абсорбция: удвоенная ступень", value: ctx.tier }] };
});
export async function factorySupportDamage({ actor, amount, event }) {
  if (!(amount > 0)) return;
  const types = event.damageTypes ?? [event.damageType],
    ctx = factoryChildSnapshot(actor),
    target = await fromUuid(event.targetTokenUuid);
  if (target?.actor?.uuid !== actor.uuid) return;
  if (ctx?.material === "clay" && types.includes("acid"))
    await applyNativeOnce(
      actor,
      {
        requestId: `factory-clay:${event.workflowId}:${target.uuid}`,
        action: "factory-clay",
        activityUuid: event.activityUuid
      },
      async () => true,
      async () => {
        for (const e of [...actor.effects]) if (e.getFlag?.(MODULE_ID, "factoryClay")) await e.delete();
        await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: "Кислотная абсорбция: Большой, Дробление +ступень",
            type: "base",
            transfer: false,
            disabled: false,
            statuses: [],
            ...temporaryEffectTiming({ rounds: 2, actor, expiry: "turnEnd" }),
            flags: { [MODULE_ID]: { factoryClay: true }, dae: { expiryMode: "delete" } },
            system: {
              changes: [{ key: "system.traits.size", type: "override", value: "lg", phase: "initial", priority: 20 }]
            }
          }
        ]);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content:
            "<p>Глиняный гомункул: на два раунда Большой, бонус Дробления удвоен автоматически. Досягаемость +5 футов и увеличение занимаемых токеном клеток контролирует GM.</p>"
        });
        return true;
      }
    );
  if (ctx?.material === "flesh" && types.includes("lightning"))
    await applyNativeOnce(
      actor,
      {
        requestId: `factory-flesh:${event.workflowId}:${target.uuid}`,
        action: "factory-flesh",
        activityUuid: event.activityUuid
      },
      async () => true,
      async () => {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content:
            "<p>Гомункул из плоти: после полученного электрического урона дополнительная атака до конца следующего своего хода. Её выполняет владелец; эта карточка не разыгрывает новую атаку автоматически.</p>"
        });
        return true;
      }
    );
  if (!factoryAugment(actor, "biomonitor")) return;
  const hp = actor.system.attributes.hp,
    max = Number(hp.effectiveMax ?? hp.max);
  if (!(Number(event.beforeHp) > max / 2 && Number(hp.value) <= max / 2)) return;
  const potions = [...(actor.items ?? [])]
    .filter(i => i.type === "consumable" && i.system.type?.value === "potion" && Number(i.system.quantity ?? 1) > 0)
    .flatMap(i =>
      [...(i.system.activities?.values?.() ?? [])].filter(
        a => a.type === "heal" || a.damage?.parts?.some(p => [...(p.types ?? [])].includes("healing"))
      )
    );
  if (!potions.length) return;
  await applyNativeOnce(
    actor,
    {
      requestId: `factory-biomonitor:${event.workflowId}:${target.uuid}`,
      action: "factory-biomonitor",
      activityUuid: event.activityUuid
    },
    async () => {
      const uuid = await askOwner(actor, {
          title: "Биомонитор: использовать имеющееся зелье лечения?",
          choices: [["no", "Не использовать"], ...potions.map(a => [a.uuid, a.item.name])]
        }),
        use = potions.find(a => a.uuid === uuid);
      if (!use) return false;
      const d = use.toObject();
      d.activation = { type: "special", value: null, override: true };
      d.flags = { [MODULE_ID]: { factoryResolved: true, action: "" } };
      const clone = use.item.clone({ system: { activities: { [use.id]: d } } }, { keepId: true });
      return MidiQOL.completeActivityUse(
        clone.system.activities.get(use.id),
        {
          midiOptions: {
            targetUuids: [target.uuid],
            workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
          }
        },
        { configure: false }
      );
    },
    async () => true
  );
}
