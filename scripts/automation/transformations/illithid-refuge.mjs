import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, automationAction, automationData } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { askOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { inFeet } from "../shared/combat-benefits.mjs";
import { encounterForScene } from "../shared/combat-flow.mjs";
import { ilHas, ilRefuge, ilRules } from "./illithid.mjs";
import { useIlCost, ilCondition, planIllithidConcentration, beginIllithidConcentration } from "./illithid-use.mjs";
const doc = t => t.document ?? t;
export const ILLITHID_AURAS = [
  {
    id: "illithid-refuge",
    name: "Ментальное Убежище",
    radius: 10,
    affects: "all",
    sourceFeature: "illithid-refuge",
    indicatorColor: "#ab72d5",
    sourceCondition: t =>
      Boolean(
        ilRefuge(t.actor) && ilRefuge(t.actor).getFlag(MODULE_ID, "illithidCondition")?.sourceTokenUuid === doc(t).uuid
      )
  }
];
export function illithidRefugeSources(token) {
  return [...(token?.parent?.tokens ?? [])].filter(
    t =>
      ilHas(t.actor, "refuge") &&
      ilRefuge(t.actor)?.getFlag(MODULE_ID, "illithidCondition")?.sourceTokenUuid === t.uuid &&
      inFeet(t, token, 10, token.parent)
  );
}
export async function activateIllithidRefuge(actor, activity, source, requestId) {
  if (ilRefuge(actor)) throw Error("Ментальное Убежище уже действует.");
  const rules = ilRules(actor),
    plan = await planIllithidConcentration(actor, rules.refugeConcentration);
  if (!plan) return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-refuge", activityUuid: activity.uuid },
    () => useIlCost(activity),
    async () => {
      const r = ilRules(actor),
        concentration = await beginIllithidConcentration(actor, activity, plan, r.refugeSeconds);
      const e = await ilCondition(source, source, activity.item, {
        kind: "refuge",
        seconds: r.refugeSeconds || null,
        extra: { concentrationUuid: concentration?.uuid ?? null }
      });
      await e.setFlag(MODULE_ID, "illithidRefuge", true);
      return true;
    }
  );
}
export async function endIllithidRefuge(actor) {
  for (const e of [...(actor.effects ?? [])]) if (e.getFlag?.(MODULE_ID, "illithidRefuge")) await e.delete();
  return true;
}
const nativeEligible = a =>
  ["action", "bonus"].includes(a?.activation?.type) && !automationAction(a) && !automationData(a).illithidResolved;
registerGmRequest("illithid-refuge-use", async (actor, data, { requestId }) => {
  const source = await fromUuid(data.sourceUuid),
    a = await fromUuid(data.activityUuid);
  if (
    !enabled() ||
    !isGmAuthority() ||
    a?.actor?.uuid !== actor.uuid ||
    source?.actor?.uuid !== actor.uuid ||
    !nativeEligible(a) ||
    !illithidRefugeSources(source).length
  )
    return false;
  return applyNativeOnce(
    actor,
    { requestId, action: "illithid-refuge-use", activityUuid: a.uuid },
    async () => {
      const swap = a.activation.type === "action" ? "bonus" : "action",
        choice = await askOwner(actor, {
          title: `Ментальное Убежище: ${a.item.name}`,
          choices: [
            ["normal", `Штатно: ${a.activation.type}`],
            ["swap", `Заменить: ${swap}`]
          ]
        });
      if (!["normal", "swap"].includes(choice)) return false;
      if (!illithidRefugeSources(source).length) return false;
      const row = a.toObject();
      row.activation = {
        ...row.activation,
        type: choice === "swap" ? swap : a.activation.type,
        value: 1,
        override: true
      };
      row.flags = {
        ...row.flags,
        [MODULE_ID]: { ...row.flags?.[MODULE_ID], illithidResolved: true, areaResolved: true, action: "" }
      };
      const native = a.item
        .clone({ system: { activities: { [a.id]: row } } }, { keepId: true })
        .system.activities.get(a.id);
      return MidiQOL.completeActivityUse(
        native,
        {
          midiOptions: {
            targetUuids: data.targetUuids ?? [],
            workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
          }
        },
        { configure: true }
      );
    },
    async () => true
  );
});
export async function useIllithidRefuge(actorOrUuid, activityOrUuid = null) {
  const actor = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
  if (!actor) throw Error("Персонаж не найден.");
  if (!actor.isOwner && !game.user.isGM) throw Error("Нет доступа к персонажу.");
  const source =
    canvas.tokens?.controlled?.map(doc).find(t => t.actor?.uuid === actor.uuid) ??
    canvas.tokens?.placeables?.map(doc).find(t => t.actor?.uuid === actor.uuid);
  if (!source || !illithidRefugeSources(source).length)
    throw Error("Выбранный токен не находится в Ментальном Убежище.");
  let a = typeof activityOrUuid === "string" ? await fromUuid(activityOrUuid) : activityOrUuid;
  if (!a) {
    const acts = [...actor.items].flatMap(i => [...(i.system.activities?.values?.() ?? [])]).filter(nativeEligible),
      uuid = await askOwner(actor, {
        title: "Нативная активность для обмена действиями",
        choices: acts.map(c => [c.uuid, `${c.item.name}: ${c.name}`])
      });
    a = acts.find(c => c.uuid === uuid);
  }
  if (!a) return false;
  return requestGm(
    "illithid-refuge-use",
    actor,
    {
      sourceUuid: source.uuid,
      activityUuid: a.uuid,
      targetUuids: [...(game.user.targets ?? [])].map(t => doc(t).uuid)
    },
    { timeoutMs: 180000 }
  );
}
const pending = new Map();
export function interceptIllithidRefuge(a) {
  if (!enabled() || !nativeEligible(a)) return;
  const actor = a.actor,
    source =
      canvas.tokens?.controlled?.map(doc).find(t => t.actor?.uuid === actor.uuid) ??
      canvas.tokens?.placeables?.map(doc).find(t => t.actor?.uuid === actor.uuid);
  if (!source || !encounterForScene(source.parent, source)?.started || !illithidRefugeSources(source).length) return;
  const f = actor.getFlag?.("midi-qol", "actions") ?? {},
    action = Boolean(f.action),
    bonus = globalThis.MidiQOL?.hasUsedBonusAction?.(actor) ?? Boolean(f.bonus);
  if (!((a.activation.type === "action" && action && !bonus) || (a.activation.type === "bonus" && bonus && !action)))
    return;
  if (!pending.has(a.uuid)) {
    const p = useIllithidRefuge(actor, a)
      .catch(e => console.error(`${MODULE_ID} | Refuge exchange`, e))
      .finally(() => pending.delete(a.uuid));
    pending.set(a.uuid, p);
  }
  return false;
}
