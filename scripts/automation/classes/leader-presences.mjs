import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { findFeature, enabled, notify } from "../shared/helpers.mjs";
import { registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { LEADER_PRESENCE_KEYS, presenceChoices, presenceApplies } from "../shared/leader-presence-definitions.mjs";
export { inspiringTemporaryHp } from "../shared/leader-presence-definitions.mjs";
import { chooseSceneTokens, confirmOwner } from "../shared/owner-prompts.mjs";
import {
  activeBenefits,
  addCombatBenefit,
  onPrepareAttack,
  inFeet,
  tokenRef,
  canReact,
  turnKey,
  appendCalculatedBonus,
  combatForScene
} from "../shared/combat-benefits.mjs";
import { automationActors } from "../effects/temporary-effects.mjs";
import { onConfirmedDamage, onPrepareDamage } from "../shared/damage-events.mjs";
import { calculatedDamage } from "../midi/damage-packet.mjs";
import { syncLeaderPassiveEffects } from "./leader.mjs";
import { leaderDistance } from "./leader-stratagems.mjs";
import { isGmAuthority } from "../shared/gm-requests.mjs";

function sources(scene, target, key) {
  return [...(scene?.tokens ?? [])].filter(source => presenceApplies(source, target, key));
}
function strongest(list, value) {
  return list.sort((a, b) => value(b) - value(a) || a.uuid.localeCompare(b.uuid))[0];
}
const prof = actor => Number(actor.system.attributes.prof);
const mod = (actor, ability) => Math.max(1, Number(actor.system.abilities[ability].mod));
registerGmRequest("leader-presence-targets", async (actor, data) => {
  const source = await fromUuid(data.sourceTokenUuid),
    item = findFeature(actor, data.key);
  if (!source || source.actor.uuid !== actor.uuid || !item || !LEADER_PRESENCE_KEYS.includes(data.key))
    throw Error("Присутствие недоступно.");
  const targets = await chooseSceneTokens(actor, source.parent, {
    title: item.name,
    min: 0,
    max: source.parent.tokens.size ?? source.parent.tokens.length,
    exclude: [source.uuid]
  });
  if (targets == null) return { status: "cancelled" };
  const records = presenceChoices(actor).filter(
    record => record.sourceTokenUuid !== source.uuid || record.key !== data.key
  );
  records.push({
    sourceTokenUuid: source.uuid,
    sceneId: source.parent.id,
    key: data.key,
    targetUuids: targets.map(token => token.uuid)
  });
  if (data.key === "boisterous-presence") {
    const legacy = [...actor.effects].filter(
      effect => effect.getFlag?.(MODULE_ID, FLAGS.LEADER_PASSIVE) === "boisterous-presence"
    );
    const conflict = legacy.some(
      effect =>
        effect.name !== item.name ||
        effect.origin !== item.uuid ||
        (effect.system?.changes ?? []).some(
          change => !change.key.startsWith("system.attributes.movement.") || Number(change.value) !== 10
        )
    );
    await actor.setFlag(MODULE_ID, "leaderLegacyBoiConflict", conflict);
    if (conflict)
      notify(
        "Ручной пассив скорости сохранён. Собственная скорость Лидера не усиливается повторно; союзники получают присутствие.",
        "warn"
      );
  }
  await actor.setFlag(MODULE_ID, "leaderPresenceRecipients", records);
  await syncLeaderPassiveEffects(actor);
  return { status: "success" };
});
export async function chooseLeaderPresenceTargets(actor, key) {
  const source =
    canvas.tokens?.controlled?.find(token => token.actor.uuid === actor.uuid)?.document ??
    actor.getActiveTokens?.()[0]?.document;
  if (!source) {
    notify("Выберите токен Лидера на сцене.", "warn");
    return false;
  }
  return requestGm("leader-presence-targets", actor, { key, sourceTokenUuid: source.uuid }, { timeoutMs: 120000 });
}

onPrepareAttack(async ({ attacker, target, data }) => {
  const scene = attacker.parent,
    results = [];
  const source = strongest(sources(scene, target, "insightful-presence"), () => 3);
  if (source) {
    const claims = source.actor.getFlag(MODULE_ID, "insightfulPresenceClaims") ?? {};
    if (!claims[target.uuid]) {
      const existing = activeBenefits(attacker.actor).find(
        effect =>
          effect.getFlag(MODULE_ID, "combatBenefit")?.presenceKind === "insightful" &&
          effect.getFlag(MODULE_ID, "combatBenefit").workflowId === data.workflowId
      );
      const effect =
        existing ??
        (await addCombatBenefit(source, attacker, findFeature(source.actor, "insightful-presence"), {
          kind: "attack-bonus",
          amount: -3,
          remaining: 1,
          presenceKind: "insightful",
          workflowId: data.workflowId,
          protectedTarget: target.uuid
        }));
      results.push({ kind: "attack-bonus", amount: -3, name: "Проницательное присутствие", effectUuid: effect.uuid });
    }
  }
  return results;
});
onPrepareDamage(async ({ actor, attacker, target, activity, data }) => {
  if (data.automatic || activity.item.type !== "weapon") return;
  const scene = attacker.parent;
  const tactical = sources(scene, attacker, "tactical-presence").find(
    source =>
      source.uuid !== attacker.uuid &&
      inFeet(source, target, leaderDistance(source.actor, 60), scene) &&
      [...scene.tokens].some(
        ally =>
          ally.uuid !== attacker.uuid &&
          presenceApplies(source, ally, "tactical-presence") &&
          inFeet(ally, target, 5, scene)
      )
  );
  if (tactical) {
    const claims = attacker.actor.getFlag(MODULE_ID, "tacticalPresenceClaims") ?? {},
      key = turnKey(combatForScene(scene));
    const reserved = actor.getFlag(MODULE_ID, "tacticalPresenceReservation");
    if (key && !claims[key] && (!reserved || reserved.key === data.key || reserved.turn !== key)) {
      await actor.setFlag(MODULE_ID, "tacticalPresenceReservation", { key: data.key, turn: key });
      return {
        bonuses: [{ value: 1 + Math.floor(prof(tactical.actor) / 2), name: "Тактическое присутствие" }],
        context: { tacticalTurn: key }
      };
    }
  }
});
onConfirmedDamage(async ({ event, amount }) => {
  if (amount <= 0) return;
  const attacker = await fromUuid(event.sourceTokenUuid),
    target = await fromUuid(event.targetTokenUuid);
  if (!attacker || !target) return;
  if (event.tacticalTurn) {
    const claims = attacker.actor.getFlag(MODULE_ID, "tacticalPresenceClaims") ?? {};
    claims[event.tacticalTurn] = true;
    await attacker.actor.setFlag(MODULE_ID, "tacticalPresenceClaims", claims);
    await attacker.actor.unsetFlag(MODULE_ID, "tacticalPresenceReservation");
  }
  // A confirmed zero-HP transition fires the team's next-damage bonus; the
  // separate critical hook handles a critical even if it does not kill.
  if (event.beforeHp > 0 && target.actor.system.attributes.hp.value <= 0 && target.disposition !== attacker.disposition)
    await inspireBoisterous(attacker, target.uuid, event.workflowId ?? event.key);
});
async function inspireBoisterous(attacker, excluded, eventId) {
  const leaders = sources(attacker.parent, attacker, "boisterous-presence"),
    source = strongest(leaders, token => prof(token.actor));
  if (!source) return;
  const claims = source.actor.getFlag(MODULE_ID, "boisterousPresenceClaims") ?? [];
  if (claims.includes(eventId)) return;
  await source.actor.setFlag(MODULE_ID, "boisterousPresenceClaims", [...claims, eventId].slice(-128));
  for (const target of attacker.parent.tokens) {
    if (
      target.uuid === attacker.uuid ||
      target.uuid === excluded ||
      !presenceApplies(source, target, "boisterous-presence")
    )
      continue;
    const old = activeBenefits(target.actor).filter(
      effect => effect.getFlag(MODULE_ID, "combatBenefit")?.presenceKind === "boisterous"
    );
    for (const effect of old) await effect.delete();
    await addCombatBenefit(source, target, findFeature(source.actor, "boisterous-presence"), {
      kind: "damage-bonus",
      amount: 2 * prof(source.actor),
      remaining: 1,
      presenceKind: "boisterous",
      eventId
    });
  }
}
registerGmRequest("leader-critical-presence", async (actor, data) => {
  const source = await fromUuid(data.sourceUuid);
  if (source?.actor?.uuid !== actor.uuid) throw Error("Неверный источник критического попадания.");
  await inspireBoisterous(source, null, data.workflowId);
  return { status: "success" };
});
export async function handleLeaderCritical(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !workflow.isCritical ||
    !workflow.attackRoll ||
    !workflow.token ||
    !workflow.hitTargets?.size
  )
    return;
  return requestGm("leader-critical-presence", workflow.actor, {
    sourceUuid: tokenRef(workflow.token).uuid,
    workflowId: workflow.id
  });
}
export async function handleDistractingPresence(workflow) {
  if (
    !enabled() ||
    workflow?.aborted ||
    !workflow.attackRoll ||
    workflow.targets?.size !== 1 ||
    workflow.hitTargets?.size
  )
    return;
  if (workflow.grimgutzAttackBenefits?.some(bonus => bonus.presenceKind === "distracting")) return;
  return requestGm("leader-distracting-presence", workflow.actor, {
    sourceUuid: tokenRef(workflow.token).uuid,
    targetUuid: tokenRef([...workflow.targets][0]).uuid,
    workflowId: workflow.id
  });
}
registerGmRequest("leader-distracting-presence", async (actor, data) => {
  const attacker = await fromUuid(data.sourceUuid),
    target = await fromUuid(data.targetUuid);
  if (!attacker || attacker.actor.uuid !== actor.uuid || !target || target.parent.id !== attacker.parent.id)
    throw Error("Неверный промах.");
  if (activeBenefits(actor).some(effect => effect.getFlag(MODULE_ID, "combatBenefit")?.presenceKind === "distracting"))
    return { status: "success" };
  const source = sources(attacker.parent, attacker, "distracting-presence").find(
    source =>
      canReact(source.actor) &&
      (source.uuid === target.uuid || inFeet(source, target, leaderDistance(source.actor, 30), source.parent))
  );
  if (source)
    await addCombatBenefit(source, attacker, findFeature(source.actor, "distracting-presence"), {
      kind: "attack-disadvantage",
      remaining: 1,
      presenceKind: "distracting",
      expiry: "targetEnd",
      originWorkflowId: data.workflowId
    });
  return { status: "success" };
});
export function calmingHealingBonus(
  source,
  {
    spellLevel = null,
    longDuration = false,
    fast = false,
    multiple = false,
    hitDice = 0,
    classHealing = false,
    base = 0
  }
) {
  const proficiency = prof(source.actor);
  if (hitDice) return Math.floor(proficiency / 2) * hitDice;
  if (spellLevel != null) {
    const bonus = Math.max(proficiency, 2 * spellLevel);
    return longDuration || fast || multiple ? Math.floor(bonus / 2) : bonus;
  }
  return classHealing && base > 4 ? Math.floor(proficiency / 2) : 0;
}
registerGmRequest("leader-healing-bonuses", async (actor, data) => {
  const source = await fromUuid(data.sourceUuid),
    target = await fromUuid(data.targetUuid),
    activity = await fromUuid(data.activityUuid);
  if (
    !source ||
    source.actor.uuid !== actor.uuid ||
    activity?.item?.actor?.uuid !== actor.uuid ||
    !target ||
    target.parent.id !== source.parent.id
  )
    throw Error("Неверный контекст лечения.");
  const recipients = sources(source.parent, target, "calming-presence");
  const info = { ...data.info, classHealing: activity.item.system?.type?.value === "class" };
  if (activity.item.type !== "spell" && !info.classHealing && recipients.length)
    info.classHealing = await confirmOwner(actor, "Успокаивающее присутствие", "Это лечение классовой особенностью?");
  if (activity.item.type !== "spell") info.spellLevel = null;
  const chosen = strongest(recipients, source => calmingHealingBonus(source, info));
  const inspiring = strongest(sources(source.parent, target, "inspiring-presence"), source => mod(source.actor, "cha"));
  return {
    status: "success",
    healing: chosen ? calmingHealingBonus(chosen, info) : 0,
    temporary: inspiring ? mod(inspiring.actor, "cha") : 0
  };
});
export async function prepareLeaderHealing(token, { workflow, damageItem }) {
  if (!enabled() || !workflow?.actor || !workflow.token || !token?.actor || damageItem.grimgutzHealingPrepared) return;
  const parts = calculatedDamage(damageItem),
    healing = parts.filter(part => part.type === "healing"),
    temp = parts.filter(part => part.type === "temphp");
  if (!healing.length && !temp.length) return;
  const activity = workflow.activity,
    duration = activity.duration?.units ?? workflow.item.system.duration?.units;
  const result = await requestGm(
    "leader-healing-bonuses",
    workflow.actor,
    {
      activityUuid: activity.uuid,
      sourceUuid: tokenRef(workflow.token).uuid,
      targetUuid: tokenRef(token).uuid,
      info: {
        spellLevel: workflow.castData?.castLevel ?? workflow.item.system.level ?? null,
        base: Math.abs(healing.reduce((sum, part) => sum + part.value, 0)),
        longDuration: duration && duration !== "inst",
        fast: activity.activation?.type !== "action",
        multiple:
          workflow.targets?.size > 1 ||
          Number(activity.target?.affects?.count) > 1 ||
          Boolean(activity.target?.template?.type)
      }
    },
    { requestId: `healing-presence:${workflow.id}:${tokenRef(token).uuid}`, timeoutMs: 120000 }
  );
  if (result.status !== "success") return;
  const selector = damageItem.damageSelector ?? "combinedDamage",
    raw = damageItem.damageDetails?.[`raw${selector}`] ?? damageItem.rawDamageDetail ?? [];
  if (healing.length && result.healing) {
    const sign = raw.find(part => part.type === "healing")?.value < 0 ? -1 : 1;
    await appendCalculatedBonus(token, damageItem, sign * result.healing, "healing");
  }
  if (temp.length && result.temporary) await appendCalculatedBonus(token, damageItem, result.temporary, "temphp");
  damageItem.grimgutzHealingPrepared = true;
}
export function installLeaderPresenceHooks() {
  Hooks.on("dnd5e.preRollHitDie", config => {
    if (!enabled()) return;
    const actor = config.subject,
      target = actor.getActiveTokens?.()[0]?.document;
    if (!target) return;
    const source = strongest(sources(target.parent, target, "calming-presence"), source => prof(source.actor));
    if (!source || config[MODULE_ID]?.calmingHitDie) return;
    config[MODULE_ID] = { ...(config[MODULE_ID] ?? {}), calmingHitDie: true };
    for (const roll of config.rolls ?? []) {
      const dice = (roll.parts ?? []).reduce(
        (sum, part) => sum + [...String(part).matchAll(/(\d+)d\d+/g)].reduce((n, match) => n + Number(match[1]), 0),
        0
      );
      roll.parts ??= [];
      roll.parts.push(String(calmingHealingBonus(source, { hitDice: dice })));
    }
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (!isGmAuthority() || !Object.hasOwn(changes, "turn") || !combat.combatant?.actor) return;
    const targetUuid = combat.combatant.token?.uuid;
    for (const actor of automationActors()) {
      const claims = actor.getFlag(MODULE_ID, "insightfulPresenceClaims");
      if (claims)
        void actor.setFlag(
          MODULE_ID,
          "insightfulPresenceClaims",
          Object.fromEntries(Object.entries(claims).filter(([key]) => key !== targetUuid))
        );
    }
    void combat.combatant.actor.unsetFlag(MODULE_ID, "tacticalPresenceClaims");
  });
}
