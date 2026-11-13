import { MODULE_ID } from "../shared/constants.mjs";
import { NIGHTMARE_PROFILES } from "../shared/nightmare-definitions.mjs";
import {
  nightmareLevel,
  nightmareDC,
  nightmareState,
  nightmareManifested,
  nightmareFrightened
} from "../shared/nightmare-state.mjs";
import { createSummonedGroup } from "../shared/summons.mjs";
import { dismissSummonActor } from "../shared/summon-lifecycle.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { isGmAuthority, registerGmRequest, requestGm } from "../shared/gm-requests.mjs";
import { enabled, automationData, notify } from "../shared/helpers.mjs";
import { serialMutation } from "../shared/transactions.mjs";
import { applyNativeOnce, nativeApplicationReply } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { sourceTokenForActor } from "../shared/zones.mjs";
import { onPrepareAttack, inFeet, addCombatBenefit } from "../shared/combat-benefits.mjs";
import { useAuraPulse } from "../midi/aura-workflow.mjs";

export const nightmareSummons = owner =>
  [...(game.actors ?? [])].filter(
    actor =>
      actor.getFlag?.(MODULE_ID, "summonSource") === "nightmare-call" &&
      actor.getFlag(MODULE_ID, "summonedBy") === owner.uuid
  );
export function nightmareSummonRecipe(owner, kind) {
  const profile = NIGHTMARE_PROFILES.find(entry => entry.id === kind);
  if (!profile || nightmareLevel(owner) < 2 || nightmareDC(owner) == null) throw Error("Недоступный призыв Кошмара.");
  const prof = Number(owner.system.attributes.prof),
    mod = Number(owner.system.abilities[nightmareState(owner).ability].mod),
    features = [];
  if (kind === "scout")
    features.push({
      key: "nightmare-scout-senses",
      name: "Чужие чувства",
      description:
        "Владелец действием воспринимает чувства Соглядатая до начала своего следующего хода в пределах 1 мили на том же плане; пользуйтесь кнопкой владельца. Соглядатай не атакует."
    });
  if (kind === "pursuer")
    features.push({
      key: "nightmare-pursuer-touch",
      name: "Мучительное касание",
      description:
        "Чутьё страха даёт преимущество только по испуганной цели или проявлению навязанного страха именно владельца.",
      activities: [
        {
          name: "Мучительное касание",
          type: "attack",
          attackBonus: prof + mod,
          attackType: "melee",
          range: 5,
          formula: `2d6 + ${prof}`,
          damageType: "psychic"
        }
      ]
    });
  if (kind === "warden")
    features.push({
      key: "nightmare-warden-gaze",
      name: "Подавляющий взгляд",
      description:
        "Видимая цель в 30 футах: Мудрость, при провале 1к6 + БМ психического урона и не может говорить до начала следующего хода Надзирателя. Не является атакой.",
      activities: [
        {
          name: "Подавляющий взгляд",
          type: "utility",
          action: "nightmare-summon-control",
          metadata: { nightmareSummonAbility: "gaze" },
          range: 30
        }
      ]
    });
  return {
    kind: `nightmare-${kind}`,
    source: "nightmare-call",
    unique: false,
    name: `${profile.name} (${owner.name})`,
    img: profile.img,
    size: profile.size,
    type: "aberration",
    ac: 13 + prof,
    hp: 10 * nightmareLevel(owner),
    hpFormula: "",
    abilities: { str: 8, dex: 14, con: 12, int: 6, wis: 14, cha: 8 },
    movement: profile.movement,
    senses: { darkvision: 60 },
    ci: { value: ["frightened"] },
    ...(kind === "scout"
      ? {
          skills: {
            prc: { value: 0, bonuses: { check: String(prof), passive: "" } },
            ste: { value: 0, bonuses: { check: String(prof), passive: "" } }
          }
        }
      : {}),
    languages: {
      value: [...(owner.system.traits?.languages?.value ?? [])],
      custom: "Понимает языки владельца, но не говорит"
    },
    lifecycle: { seconds: 600 },
    snapshot: { prof, dc: nightmareDC(owner), ownerUuid: owner.uuid, level: nightmareLevel(owner) },
    features,
    note: "Уклонение без команды; ход сразу после владельца. Команда — бонусное действие, на 5-м уровне без действия в свой ход. Перемещение, порядок боя и особый облик контролирует GM."
  };
}
export async function summonNightmare(actor, activity, source, { requestId, use } = {}) {
  if (!source?.parent) throw Error("Нужен токен владельца.");
  const choice = await askOwner(actor, {
    title: "Зов кошмара",
    choices: NIGHTMARE_PROFILES.map(entry => [entry.id, entry.name])
  });
  if (!NIGHTMARE_PROFILES.some(entry => entry.id === choice)) return false;
  const recipe = nightmareSummonRecipe(actor, choice);
  if (
    !(await confirmOwner(
      { uuid: actor.uuid, testUserPermission: user => user.isGM },
      "Место призыва (GM)",
      "Справа рядом с токеном владельца — видимое свободное пространство для выбранного размера, не дальше 30 футов? Если нет, отмените до расхода и подготовьте место."
    ))
  )
    return false;
  const old = nightmareSummons(actor).map(actor => actor.uuid);
  return applyNativeOnce(
    actor,
    { requestId, action: "nightmare-summon", activityUuid: activity.uuid },
    use,
    async () => {
      const result = await createSummonedGroup(actor, [recipe], {
        scene: source.parent,
        sourceTokenId: source.id,
        requireScene: true,
        requestId: `${requestId}:create`,
        resource: {
          itemUuid: activity.actor.items.find(item => item.system.identifier === "nightmare-feeding").uuid,
          cost: 2,
          consumed: true
        }
      });
      if (result.status !== "success") return { status: "needs-review" };
      for (const uuid of old) {
        const previous = await fromUuid(uuid);
        if (previous) await dismissSummonActor(previous);
      }
      return true;
    }
  );
}
export async function cleanNightmareSummonEffects(requestId) {
  if (!isGmAuthority() || !requestId) return;
  const { automationActors } = await import("../effects/temporary-effects.mjs");
  for (const actor of automationActors())
    for (const effect of [...(actor.effects ?? [])])
      if (effect.getFlag?.(MODULE_ID, "nightmareSummonEffect") === requestId) await effect.delete();
}
export async function expireNightmaresForDeadOwner(owner) {
  if (!enabled() || !isGmAuthority()) return;
  const dead =
    owner.statuses?.has?.("dead") ||
    Number(owner.system?.attributes?.death?.failure) >= 3 ||
    (owner.type === "npc" &&
      Number(owner.system?.attributes?.hp?.value) <= 0 &&
      !owner.getFlag?.(MODULE_ID, "auraDeathRequiresStatus"));
  if (dead) for (const summoned of nightmareSummons(owner)) await dismissSummonActor(summoned);
}
onPrepareAttack(async ({ actor, target, activity }) => {
  if (
    actor.getFlag?.(MODULE_ID, "summonSource") !== "nightmare-call" ||
    actor.getFlag(MODULE_ID, "summonKind") !== "nightmare-pursuer" ||
    activity.type !== "attack"
  )
    return [];
  return nightmareFrightened(target.actor) || nightmareManifested(target.actor, actor.getFlag(MODULE_ID, "summonedBy"))
    ? [{ kind: "attack-advantage", effectUuid: `nightmare-pursuer:${actor.uuid}`, name: "Чутьё страха" }]
    : [];
});
registerGmRequest("nightmare-summon-ability", (actor, data, { requestId }) =>
  serialMutation(`nightmare-summon:${actor.uuid}`, async () => {
    if (
      !enabled() ||
      !isGmAuthority() ||
      actor.getFlag(MODULE_ID, "summonSource") !== "nightmare-call" ||
      Number(actor.system.attributes.hp.value) <= 0
    )
      return false;
    const previous = nativeApplicationReply(actor, requestId);
    if (previous) return previous;
    const source = await fromUuid(data.sourceUuid),
      activity = await fromUuid(data.activityUuid);
    if (
      source?.actor?.uuid !== actor.uuid ||
      activity?.actor?.uuid !== actor.uuid ||
      automationData(activity).nightmareSummonAbility !== "gaze" ||
      canvas.scene?.id !== source.parent.id ||
      !canvas.ready
    )
      return false;
    const targets = await chooseSceneTokens(actor, source.parent, {
      title: "Видимая цель Подавляющего взгляда",
      min: 1,
      max: 1,
      relation: token => inFeet(source, token, 30, source.parent)
    });
    if (
      !targets?.length ||
      !(await confirmOwner(
        { uuid: actor.uuid, testUserPermission: user => user.isGM },
        "Подавляющий взгляд (GM)",
        "Цель видима, а Надзирателю приказано совершить именно это действие в его следующий ход?"
      ))
    )
      return false;
    const snapshot = actor.getFlag(MODULE_ID, "summonTemplate")?.snapshot;
    if (!snapshot) return false;
    return applyNativeOnce(
      actor,
      { requestId, action: "nightmare-gaze", activityUuid: activity.uuid },
      () =>
        useNativeUtility(activity, {
          dataPatch: {
            activation: { type: "action", value: 1, override: true },
            consumption: { targets: [], spellSlot: false }
          }
        }),
      async () => {
        const target = targets[0],
          result = await useAuraPulse({
            scene: source.parent,
            sourceToken: source.object ?? { actor, document: source },
            sourceItem: activity.item,
            targets: [target.object ?? { actor: target.actor, document: target }],
            eventKey: requestId,
            event: {
              save: "wis",
              dc: String(snapshot.dc),
              damage: [{ formula: `1d6 + ${snapshot.prof}`, type: "psychic" }],
              onSave: "none",
              returnSaveOutcome: true
            }
          });
        if (result?.status !== "success") return { status: "needs-review" };
        if (result.failedSaves.includes(target.uuid)) {
          const effect = await addCombatBenefit(source, target, activity.item, {
            kind: "nightmare-silence",
            expiry: "sourceStart",
            remaining: null
          });
          await effect.update({
            [`flags.${MODULE_ID}.nightmareSummonEffect`]: actor.getFlag(MODULE_ID, "summonRequestId")
          });
          notify(
            "Подавляющий взгляд: цель не может говорить до начала следующего хода Надзирателя. Вне боя окончание хода подтверждает GM."
          );
          const { encounterForScene } = await import("../shared/combat-flow.mjs");
          if (!encounterForScene(source.parent, source))
            await effect.update({
              start: null,
              duration: { value: null, units: "seconds", expiry: null, expired: false }
            });
        }
        return true;
      }
    );
  })
);
const pending = new Map();
export function controlNightmareSummon(actor, activity) {
  const key = `${actor.uuid}:${activity.id}`;
  if (pending.has(key)) return pending.get(key);
  const task = requestGm(
    "nightmare-summon-ability",
    actor,
    { activityUuid: activity.uuid, sourceUuid: sourceTokenForActor(actor)?.document.uuid },
    { timeoutMs: 120000 }
  );
  pending.set(key, task);
  void task.finally(() => pending.delete(key)).catch(() => {});
  return task;
}
