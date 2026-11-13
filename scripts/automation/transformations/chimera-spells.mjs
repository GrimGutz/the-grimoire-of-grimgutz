import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, notify } from "../shared/helpers.mjs";
import { chimeraCarapaceActive, chimeraHas, chimeraMutation, chimeraPassiveActive } from "./chimera.mjs";
import { rollChimeraMutation, chimeraGm } from "./chimera-choices.mjs";
import { chimeraPulse, chimeraCondition } from "./chimera-use.mjs";
import { confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { nativeApplicationReply, applyNativeOnce } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";
export const chimeraBronzeWeapon = item =>
  item?.type === "weapon" &&
  (item.getFlag?.(MODULE_ID, "chimeraBronze") === true ||
    String(item.system?.material?.value ?? item.system?.material ?? "").toLowerCase() === "bronze");
registerGmRequest("chimera-incoming-spell", (caster, data, { requestId }) =>
  serialMutation(`chimera-reflection:${caster.uuid}`, async () => {
    const activity = await fromUuid(data.activityUuid);
    if (
      !enabled() ||
      !isGmAuthority() ||
      activity?.actor?.uuid !== caster.uuid ||
      activity.item?.type !== "spell" ||
      activity.type !== "attack" ||
      activity.attack?.type?.value !== "ranged" ||
      !data.workflowId
    )
      return false;
    const old = nativeApplicationReply(caster, requestId);
    if (old)
      return {
        status: old.status,
        protectedTargets: caster.getFlag(MODULE_ID, "chimeraSpellResults")?.[requestId] ?? []
      };
    const protectedTargets = [];
    const reply = await applyNativeOnce(
      caster,
      { requestId, action: "chimera-reflection", activityUuid: activity.uuid },
      async () => true,
      async () => {
        for (const uuid of [...new Set(data.targets ?? [])]) {
          const target = await fromUuid(uuid);
          if (!chimeraCarapaceActive(target?.actor)) continue;
          const roll = await new Roll("1d6").evaluate();
          await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target.actor }), flavor: "Панцирь Тараска" });
          if (Number(roll.total) >= 4) protectedTargets.push(uuid);
          if (Number(roll.total) === 6)
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: target.actor }),
              whisper: [game.user.id],
              content: `<p>Панцирь Тараска: отражение «${foundry.utils.escapeHTML(activity.item.name)}» на исходного заклинателя. GM проводит отдельное нативное применение от защищённого существа, без расхода исходной ячейки повторно и без автопопадания. Исходная цель исключена.</p>`
            });
        }
        await caster.setFlag(
          MODULE_ID,
          "chimeraSpellResults",
          Object.fromEntries(
            Object.entries({
              ...caster.getFlag(MODULE_ID, "chimeraSpellResults"),
              [requestId]: protectedTargets
            }).slice(-80)
          )
        );
        return true;
      }
    );
    return { status: reply.status, protectedTargets };
  })
);
export async function prepareChimeraSpellTargets(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow?.item?.type !== "spell" ||
    workflow.activity?.type !== "attack" ||
    workflow.activity.attack?.type?.value !== "ranged" ||
    workflow.grimgutzChimeraReflected ||
    ![...(workflow.targets ?? [])].some(t => chimeraCarapaceActive(t.actor))
  )
    return;
  workflow.grimgutzChimeraReflected = true;
  const result = await requestGm(
    "chimera-incoming-spell",
    workflow.actor,
    {
      activityUuid: workflow.activity.uuid,
      workflowId: workflow.id,
      targets: [...workflow.targets].map(t => t.document?.uuid ?? t.uuid)
    },
    { requestId: `chimera-reflect:${workflow.id}`, timeoutMs: 180000 }
  );
  if (result.status !== "success") {
    notify("Панцирь Тараска: результат требует проверки GM.", "warn");
    return;
  }
  const ids = new Set(result.protectedTargets);
  workflow.targets = new Set([...workflow.targets].filter(t => !ids.has(t.document?.uuid ?? t.uuid)));
}
registerGmRequest("chimera-bronze-attack", (caster, data, { requestId }) =>
  serialMutation(`chimera-bronze:${caster.uuid}`, async () => {
    const activity = await fromUuid(data.activityUuid);
    if (
      !enabled() ||
      !isGmAuthority() ||
      activity?.actor?.uuid !== caster.uuid ||
      activity.type !== "attack" ||
      !chimeraBronzeWeapon(activity.item) ||
      !data.workflowId
    )
      return false;
    return applyNativeOnce(
      caster,
      { requestId, action: "chimera-bronze", activityUuid: activity.uuid },
      async () => true,
      async () => {
        for (const uuid of [...new Set(data.targets ?? [])]) {
          const target = await fromUuid(uuid);
          if (!target?.actor || !chimeraHas(target.actor, "bronze")) continue;
          const item = target.actor.items.find(i => i.system.identifier === "chimera-bronze"),
            result = await chimeraPulse(target, item, [target], { save: "con", requestId: `${requestId}:${uuid}` });
          if (result.status !== "success") return { status: "needs-review" };
          if (result.failedSaves.includes(uuid))
            await chimeraCondition(target, target, item, { kind: "bronze", statuses: ["poisoned"], seconds: 60 });
        }
        return true;
      }
    );
  })
);
export async function prepareChimeraBronzeAttack(workflow) {
  if (!enabled() || workflow?.aborted || workflow.activity?.type !== "attack" || !chimeraBronzeWeapon(workflow.item))
    return;
  const targets = [...(workflow.targets ?? [])].filter(t => chimeraHas(t.actor, "bronze"));
  if (!targets.length) return;
  if (workflow.targets.size === 1)
    workflow.attackRollModifierTracker?.advantage?.add?.(`${MODULE_ID}.chimera-bronze`, "Аллергия на бронзу: эта цель");
  else notify("Бронзовое оружие: для преимущества против Химеры разыгрывайте атаку отдельно по этой цели.", "warn");
  if (workflow.grimgutzChimeraBronze) return;
  workflow.grimgutzChimeraBronze = true;
  return requestGm(
    "chimera-bronze-attack",
    workflow.actor,
    {
      activityUuid: workflow.activity.uuid,
      workflowId: workflow.id,
      targets: targets.map(t => t.document?.uuid ?? t.uuid)
    },
    { requestId: `chimera-bronze:${workflow.id}`, timeoutMs: 180000 }
  );
}
export function applyChimeraDamagePacket(token, { workflow, damageItem }) {
  if (
    !enabled() ||
    !token?.actor ||
    !workflow?.activity ||
    workflow.aborted ||
    (damageItem.damageSelector && damageItem.damageSelector !== "combinedDamage")
  )
    return;
  const actor = token.actor;
  if (chimeraHas(actor, "bronze") && chimeraBronzeWeapon(workflow.item) && workflow.activity.type === "attack") {
    const selector = damageItem.damageSelector ?? "combinedDamage",
      raw = damageItem.damageDetails?.[`raw${selector}`] ?? damageItem.rawDamageDetail;
    const fingerprint = () => JSON.stringify([raw, calculatedDamage(damageItem)]);
    if (
      raw &&
      typeof actor.calculateDamage === "function" &&
      damageItem.grimgutzChimeraBronzePacket !== fingerprint()
    ) {
      const doubled = structuredClone(raw).map(p =>
        !["healing", "temphp", "maximum", "midi-none"].includes(p.type) && Number(p.value) > 0
          ? { ...p, value: Number(p.value) * 2 }
          : p
      );
      const options = structuredClone(
        damageItem.damageDetails?.calcDamageOptions?.[selector] ??
          damageItem.calcDamageOptions ?? { invertHealing: true }
      );
      commitCalculatedDamage(token, damageItem, actor.calculateDamage(doubled, options));
      damageItem.grimgutzChimeraBronzePacket = fingerprint();
    }
  }
  if (
    chimeraMutation(actor) !== "healing" ||
    !chimeraPassiveActive(actor, "mutation") ||
    workflow.actor?.uuid === actor.uuid ||
    !workflow.actor ||
    !["spell", "feat"].includes(workflow.item?.type)
  )
    return;
  const parts = calculatedDamage(damageItem),
    healing = parts.find(p => p.type === "healing" && Number(p.value) < 0);
  if (!healing || parts.some(p => p.active?.[MODULE_ID]?.chimeraHealing)) return;
  const extra = Math.max(0, Number(actor.system.abilities.con.mod));
  if (!extra) return;
  healing.value -= extra;
  healing.active ??= {};
  healing.active[MODULE_ID] = { ...healing.active[MODULE_ID], chimeraHealing: true };
  commitCalculatedDamage(token, damageItem, parts);
}
registerGmRequest("chimera-failed-magic", async (caster, data) => {
  const activity = await fromUuid(data.activityUuid);
  if (!enabled() || !isGmAuthority() || activity?.actor?.uuid !== caster.uuid || !data.workflowId) return false;
  const spell = activity.item.type === "spell";
  for (const uuid of [...new Set(data.targets ?? [])]) {
    const target = await fromUuid(uuid),
      actor = target?.actor;
    if (!chimeraHas(actor, "blood")) continue;
    const key = `chimera-mutation:${data.workflowId}:${uuid}`;
    if (nativeApplicationReply(actor, key)) continue;
    await serialMutation(`chimera-mutation:${actor.uuid}`, () =>
      applyNativeOnce(
        actor,
        { requestId: key, action: "chimera-blood", activityUuid: activity.uuid },
        async () =>
          spell ||
          (await confirmOwner(
            chimeraGm(actor),
            "Раздражённая кровь",
            "GM подтверждает, что провален именно спасбросок против магической способности, а не обычной немагической атаки?"
          )),
        () => rollChimeraMutation(actor, { onlyLower: true })
      )
    );
  }
  return true;
});
export async function finishChimeraMagicalSaves(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !workflow.activity ||
    !(workflow.failedSaves instanceof Set) ||
    workflow.grimgutzChimeraSaves
  )
    return;
  const targets = [...workflow.failedSaves].filter(t => chimeraHas(t.actor, "blood"));
  if (!targets.length) return;
  workflow.grimgutzChimeraSaves = true;
  return requestGm(
    "chimera-failed-magic",
    workflow.actor,
    {
      activityUuid: workflow.activity.uuid,
      workflowId: workflow.id,
      targets: targets.map(t => t.document?.uuid ?? t.uuid)
    },
    { requestId: `chimera-failed:${workflow.id}`, timeoutMs: 180000 }
  );
}
export function filterChimeraHearingTargets(workflow) {
  const flags = workflow?.activity?.flags?.[MODULE_ID];
  if (
    !enabled() ||
    !flags?.chimeraHearing ||
    !["chimera-siren", "chimera-menagerie"].includes(workflow.item?.system?.identifier) ||
    workflow.activity?.type !== "save"
  )
    return;
  workflow.targets = new Set(
    [...(workflow.targets ?? [])].filter(t => {
      if (t.actor?.statuses?.has?.("deafened")) return false;
      const ci = t.actor?.system?.traits?.ci?.value;
      return (
        workflow.item.system.identifier !== "chimera-siren" || !(ci?.has?.("charmed") || ci?.includes?.("charmed"))
      );
    })
  );
}
