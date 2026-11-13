import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature } from "../shared/helpers.mjs";
import { broodmotherHas, broodmotherDC, broodmotherState } from "./broodmother.mjs";
import { broodmotherChildren } from "./broodmother-summons.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { areaDamagePart } from "../shared/area-definitions.mjs";
import {
  broodmotherExpense,
  broodmotherTarget,
  broodmotherPulse,
  broodmotherCondition,
  broodmotherGm
} from "./broodmother-use.mjs";
import { calculatedDamage, commitCalculatedDamage } from "../midi/damage-packet.mjs";

export function broodmotherAttackData(activity, kind) {
  const actor = activity.actor,
    data = activity.toObject(),
    quill = kind === "quill";
  data.type = "attack";
  delete data.roll;
  Object.assign(data, broodmotherExpense(activity, { activation: "special" }));
  data.attack = {
    flat: true,
    bonus: String(Number(actor.system.attributes.prof) + Number(actor.system.abilities[quill ? "dex" : "str"].mod)),
    ability: "",
    type: { value: quill ? "ranged" : "melee", classification: quill ? "weapon" : "unarmed" }
  };
  data.damage = {
    includeBase: false,
    parts: [
      areaDamagePart({ formula: quill ? "1d6" : `1d6 + ${Number(actor.system.abilities.str.mod)}`, type: "piercing" }),
      ...(quill ? [areaDamagePart({ formula: "1d6", type: "poison" })] : [])
    ]
  };
  data.range = { value: quill ? "60" : "5", units: "ft", override: true };
  data.target = {
    ...data.target,
    override: true,
    prompt: false,
    affects: { type: "creature", count: "1", choice: false },
    template: { type: "" }
  };
  data.flags = { [MODULE_ID]: { action: "", broodmotherResolved: true } };
  return data;
}
export async function useBroodmotherAttack(actor, activity, source, kind, requestId) {
  const target = await broodmotherTarget(actor, source, kind === "quill" ? 60 : 5, activity.item.name);
  if (!target) return false;
  if (
    !(await confirmOwner(
      actor,
      "Замена одной атаки",
      "Эта активность заменяет одну вашу доступную атаку; она не даёт дополнительной бесплатной атаки. Продолжить?"
    ))
  )
    return false;
  const data = broodmotherAttackData(activity, kind),
    item = activity.item.clone({ system: { activities: { [activity.id]: data } } }, { keepId: true });
  return applyNativeOnce(
    actor,
    { requestId, action: `broodmother-${kind}`, activityUuid: activity.uuid },
    () =>
      MidiQOL.completeActivityUse(
        item.system.activities.get(activity.id),
        {
          midiOptions: {
            targetUuids: [target.uuid],
            workflowOptions: { ignoreUserTargets: true, targetConfirmation: "none" }
          }
        },
        { configure: false }
      ),
    async workflow => {
      if (kind !== "quill") return true;
      if (!(workflow.hitTargets instanceof Set)) return { status: "needs-review" };
      if (![...workflow.hitTargets].some(t => (t.document?.uuid ?? t.uuid) === target.uuid)) return true;
      const save = await broodmotherPulse(source, activity.item, [target], {
        save: "con",
        poison: true,
        requestId: `${requestId}:poison`
      });
      if (save.status !== "success") return { status: "needs-review" };
      if (save.failedSaves.includes(target.uuid))
        await broodmotherCondition(source, target, activity.item, {
          kind: "quill-poison",
          statuses: ["poisoned"],
          seconds: 60,
          repeat: "con"
        });
      return true;
    }
  );
}
export function applyBroodmotherToxicDamage(token, { workflow, damageItem }) {
  if (
    !enabled() ||
    !token?.actor ||
    !broodmotherHas(workflow?.actor, "toxicologist") ||
    (damageItem.damageSelector && damageItem.damageSelector !== "combinedDamage")
  )
    return;
  const parts = calculatedDamage(damageItem);
  if (!parts.some(p => p.type === "poison")) return;
  const selector = damageItem.damageSelector ?? "combinedDamage",
    raw = damageItem.damageDetails?.[`raw${selector}`] ?? damageItem.rawDamageDetail;
  if (!raw?.some(p => p.type === "poison") || typeof token.actor.calculateDamage !== "function") return;
  const fingerprint = () =>
    JSON.stringify([
      raw.filter(p => p.type === "poison"),
      calculatedDamage(damageItem).filter(p => p.type === "poison")
    ]);
  if (damageItem.grimgutzBroodmotherToxic === fingerprint()) return;
  const options = structuredClone(
    damageItem.damageDetails?.calcDamageOptions?.[selector] ?? damageItem.calcDamageOptions ?? { invertHealing: true }
  );
  if (options.ignore === true) return;
  options.ignore ??= {};
  for (const key of ["immunity", "resistance"]) {
    if (options.ignore[key] !== true) options.ignore[key] = new Set([...(options.ignore[key] ?? []), "poison"]);
  }
  const immune =
    parts.some(p => p.type === "poison" && p.active?.immunity) ||
    token.actor.system.traits?.di?.value?.has?.("poison") ||
    token.actor.system.traits?.di?.value?.includes?.("poison");
  const fresh = token.actor.calculateDamage(structuredClone(raw.filter(p => p.type === "poison")), options);
  for (const part of fresh)
    if (part.type === "poison" && immune && Number(part.value) > 0) {
      part.value = Math.floor(Number(part.value) / 2);
      part.active ??= {};
      part.active.resistance = true;
    }
  const remaining = parts.filter(p => p.type !== "poison");
  commitCalculatedDamage(token, damageItem, [...remaining, ...fresh]);
  damageItem.grimgutzBroodmotherToxic = fingerprint();
}
export function prepareBroodmotherPoisonSave(target, workflow, details) {
  if (
    !enabled() ||
    (details.rollType && details.rollType !== "save") ||
    !broodmotherHas(workflow?.actor, "toxicologist") ||
    !workflow.activity?.flags?.[MODULE_ID]?.broodmotherPoison
  )
    return;
  const immune = target?.actor?.system?.traits?.ci?.value;
  if (immune?.has?.("poisoned") || immune?.includes?.("poisoned")) {
    details.advantage = true;
    details.modifierTracker?.advantage?.add?.(`${MODULE_ID}.toxicologist`, "Токсиколог: иммунитет к отравлению");
  }
}

registerGmRequest("broodmother-arachnomancy", (actor, data, { requestId }) =>
  serialMutation(`broodmother-spell:${actor.uuid}`, async () => {
    if (!enabled() || !isGmAuthority() || !broodmotherHas(actor, "arachnomancy")) return false;
    const old = nativeApplicationReply(actor, requestId);
    if (old) return old;
    const activity = await fromUuid(data.activityUuid);
    if (activity?.actor?.uuid !== actor.uuid || activity.item?.type !== "spell" || !data.workflowId) return false;
    const children = broodmotherChildren(actor).filter(a => Number(a.system.attributes.hp.value) > 0);
    if (!children.length) return false;
    if (
      !(await confirmOwner(
        actor,
        "Арахномантия",
        "Принести одного паука в жертву для этого заклинания? Место исхода и дальность заклинания через паука GM проверяет вручную."
      ))
    )
      return false;
    const uuid = await askOwner(actor, { title: "Паук для жертвы", choices: children.map(a => [a.uuid, a.name]) }),
      child = children.find(a => a.uuid === uuid);
    if (!child) return false;
    const targets = (await Promise.all((data.targets ?? []).map(uuid => fromUuid(uuid)))).filter(t => t?.actor);
    const targetUuid = await askOwner(actor, {
      title: "Одна цель заклинания",
      choices: targets.map(t => [t.uuid, t.name])
    });
    if (!targets.some(t => t.uuid === targetUuid)) return false;
    const mode = activity.type === "attack" ? "attack" : "save";
    const result = await applyNativeOnce(
      actor,
      { requestId, action: "broodmother-arachnomancy", activityUuid: activity.uuid },
      async () => true,
      async () => {
        if (Number(child.system.attributes.hp.value) <= 0) return { status: "needs-review" };
        await child.update({ "system.attributes.hp.value": 0 });
        const records = {
          ...(actor.getFlag(MODULE_ID, "broodmotherCasts") ?? {}),
          [data.workflowId]: { targetUuid, mode }
        };
        await actor.setFlag(MODULE_ID, "broodmotherCasts", Object.fromEntries(Object.entries(records).slice(-50)));
        return true;
      }
    );
    return { ...result, ...(result.status === "success" ? { targetUuid, mode } : {}) };
  })
);
export async function prepareBroodmotherSpell(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    workflow?.item?.type !== "spell" ||
    !workflow.activity ||
    !broodmotherHas(workflow.actor, "arachnomancy") ||
    workflow.grimgutzBroodmotherPrepared
  )
    return;
  workflow.grimgutzBroodmotherPrepared = true;
  // A single native attack roll across several targets cannot safely have
  // advantage against just one. Leave that special use to the GM.
  if (workflow.activity.type === "attack" && workflow.targets?.size !== 1) return;
  const result = await requestGm(
    "broodmother-arachnomancy",
    workflow.actor,
    {
      activityUuid: workflow.activity.uuid,
      workflowId: workflow.id,
      targets: [...(workflow.targets ?? [])].map(t => t.document?.uuid ?? t.uuid)
    },
    { requestId: `broodmother-cast:${workflow.id}`, timeoutMs: 180000 }
  );
  if (result.status !== "success") return;
  workflow.grimgutzBroodmotherSpell = result;
  if (result.mode === "attack")
    workflow.attackRollModifierTracker?.advantage?.add?.(
      `${MODULE_ID}.arachnomancy`,
      "Жертва паука: эта цель заклинания"
    );
}
export function prepareBroodmotherSpellSave(target, workflow, details) {
  const cast = workflow?.grimgutzBroodmotherSpell;
  if (
    !enabled() ||
    cast?.mode !== "save" ||
    cast.targetUuid !== (target?.document?.uuid ?? target?.uuid) ||
    (details.rollType && details.rollType !== "save")
  )
    return;
  details.disadvantage = true;
  details.modifierTracker?.disadvantage?.add?.(`${MODULE_ID}.arachnomancy`, "Жертва паука: это заклинание");
}
