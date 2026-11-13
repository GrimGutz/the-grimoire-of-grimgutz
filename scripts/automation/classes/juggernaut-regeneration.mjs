import { MODULE_ID } from "../shared/constants.mjs";
import { enabled, findFeature, notify, reportFailure } from "../shared/helpers.mjs";
import { juggernautLevel } from "./juggernaut.mjs";
import { askOwner } from "../shared/owner-prompts.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { combatTurnSnapshot, encounterForScene, isForwardTurn } from "../shared/combat-flow.mjs";
import { runAutomationEvent } from "../shared/event-ledger.mjs";
import { onConfirmedDamage } from "../shared/damage-events.mjs";

export const REGENERATION_FLAWS = {
  purity: { name: "Чистота тела", types: ["poison"], statuses: ["poisoned", "diseased", "paralyzed", "petrified"] },
  mechanism: { name: "Встроенная механика", types: ["lightning"], environment: true },
  luck: { name: "Божественная удача", types: [], statuses: ["cursed"], environment: true },
  honor: { name: "Святые помыслы", types: ["psychic"], environment: true },
  vitality: { name: "Внутренняя жизненная сила", types: ["necrotic"], statuses: ["exhaustion"], environment: true },
  thief: { name: "Похититель жизни", types: [], environment: true },
  night: { name: "Ночной хищник", types: ["radiant"], environment: true },
  metabolism: { name: "Быстрый метаболизм", types: ["cold"], environment: true },
  silver: { name: "Реактивная кровь", types: ["fire"], environment: true },
  troll: { name: "Плоть тролля", types: ["acid", "fire"] }
};
export function regenerationAmounts(actor, level = juggernautLevel(actor)) {
  const hp = actor.system.attributes.hp,
    prof = Math.floor(Number(actor.system.attributes.prof) / 2);
  const threshold = Math.floor(Number(hp.max) * (level >= 5 ? 1 / 2 : level >= 3 ? 1 / 3 : 1 / 4));
  const amount = Math.max(1, Number(actor.system.abilities.con.mod) + [0, 1, 3, 3, 6, 6][Math.min(level, 5)] + prof);
  return {
    temporary: Number(hp.value) > 0 ? Math.min(Math.max(0, hp.max - hp.value), prof) : 0,
    healing: Number(hp.value) > 0 && hp.value <= threshold ? Math.max(0, Math.min(amount, threshold - hp.value)) : 0
  };
}
export function regenerationUnavailable(actor) {
  const key = actor.getFlag(MODULE_ID, "juggernautFlaw"),
    flaw = REGENERATION_FLAWS[key];
  if (!juggernautLevel(actor) || !findFeature(actor, "regenerating-soul")) return "Нет способности";
  if (!flaw) return "Не выбран недостаток";
  if (actor.getFlag(MODULE_ID, "juggernautBlock")) return "Отключено до конца следующего хода";
  if (flaw.environment && actor.getFlag(MODULE_ID, "juggernautEnvironmentAllowed") !== true)
    return "Требуется решение GM об условиях недостатка";
  if (flaw.types.some(type => actor.system.traits?.di?.value?.has?.(type))) return "Иммунитет к типу урона недостатка";
  if (
    flaw.statuses?.some(status => actor.statuses?.has?.(status)) ||
    (key === "vitality" && Number(actor.system.attributes.exhaustion) > 0)
  )
    return "Состояние отключает регенерацию";
  return null;
}
registerGmRequest("configure-juggernaut-regeneration", async (actor, _data, context) => {
  if (!juggernautLevel(actor)) return false;
  const previous = actor.getFlag(MODULE_ID, "juggernautFlaw"),
    requester = game.users?.get?.(context.requesterId) ?? game.user;
  if (previous && !requester.isGM) {
    notify("Изменение недостатка согласует GM.", "warn");
    return false;
  }
  const key = await askOwner(actor, {
    title: "Недостаток регенерации",
    choices: Object.entries(REGENERATION_FLAWS).map(([key, flaw]) => [key, flaw.name]),
    defaultValue: previous
  });
  if (!key) return false;
  let allowed = true;
  if (REGENERATION_FLAWS[key].environment) {
    const choice = await askOwner(
      { uuid: actor.uuid, testUserPermission: user => user.isGM },
      {
        title: "Регенерация: решение GM",
        label: "Окружение и сюжетные условия выбранного недостатка позволяют регенерацию?",
        choices: [
          ["no", "Нет / неизвестно"],
          ["yes", "Да"]
        ],
        defaultValue: "no"
      }
    );
    if (choice == null) return false;
    allowed = choice === "yes";
  }
  await actor.update({
    [`flags.${MODULE_ID}.juggernautFlaw`]: key,
    [`flags.${MODULE_ID}.juggernautEnvironmentAllowed`]: allowed
  });
  return true;
});
export function configureJuggernautRegeneration(actor) {
  return requestGm("configure-juggernaut-regeneration", actor, {});
}
export async function suppressJuggernautRegeneration(actor, scene) {
  const combat = encounterForScene(scene),
    snapshot = combat && combatTurnSnapshot(combat);
  await actor.setFlag(MODULE_ID, "juggernautBlock", {
    combatId: combat?.id ?? null,
    skipCurrentEnd: snapshot?.current.token?.actor?.uuid === actor.uuid
  });
}
export async function clearRegenerationTemporaryHp(actor) {
  const record = actor.getFlag(MODULE_ID, "juggernautTempHp"),
    hp = actor.system.attributes.hp;
  if (!record || Number(hp.value) < Number(hp.max)) return;
  const update = { [`flags.${MODULE_ID}.-=juggernautTempHp`]: null };
  if (Number(hp.temp) === record.remaining) update["system.attributes.hp.temp"] = 0;
  await actor.update(update);
}
export async function regenerateJuggernaut(actor) {
  await clearRegenerationTemporaryHp(actor);
  if (regenerationUnavailable(actor)) return false;
  const amounts = regenerationAmounts(actor),
    hp = actor.system.attributes.hp,
    patch = {};
  if (amounts.healing) patch["system.attributes.hp.value"] = Number(hp.value) + amounts.healing;
  if (amounts.temporary > Number(hp.temp ?? 0)) {
    patch["system.attributes.hp.temp"] = amounts.temporary;
    patch[`flags.${MODULE_ID}.juggernautTempHp`] = { remaining: amounts.temporary };
  }
  if (Object.keys(patch).length) await actor.update(patch, { [MODULE_ID]: { regeneration: true } });
  await clearRegenerationTemporaryHp(actor);
  return true;
}
onConfirmedDamage(async ({ actor, amount, event }) => {
  const key = actor.getFlag(MODULE_ID, "juggernautFlaw"),
    flaw = REGENERATION_FLAWS[key];
  if (!flaw || amount <= 0) return;
  const types = event.damageTypes ?? [event.damageType];
  const activity = key === "silver" ? await fromUuid(event.activityUuid) : null;
  if (
    flaw.types.some(type => types.includes(type)) ||
    (key === "silver" && activity?.item?.system?.properties?.has?.("sil"))
  )
    await suppressJuggernautRegeneration(actor, game.scenes?.get?.(event.sceneId));
});
export function installJuggernautRegenerationHooks() {
  const reportJuggernaut = reportFailure("Juggernaut regeneration failed");
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || !isGmAuthority() || !isForwardTurn(combat, changes)) return;
    const snapshot = combatTurnSnapshot(combat);
    void (async () => {
      const previous = snapshot.previous.token?.actor,
        blocked = previous?.getFlag(MODULE_ID, "juggernautBlock");
      if (blocked && (!blocked.combatId || blocked.combatId === combat.id)) {
        if (blocked.skipCurrentEnd)
          await previous.setFlag(MODULE_ID, "juggernautBlock", { ...blocked, skipCurrentEnd: false });
        else await previous.unsetFlag(MODULE_ID, "juggernautBlock");
      }
      const token = snapshot.current.token,
        actor = token?.actor;
      if (actor && juggernautLevel(actor))
        await runAutomationEvent(
          {
            id: `juggernaut:${token.uuid}:${snapshot.id}:${snapshot.current.round}:${snapshot.current.turn}`,
            kind: "juggernaut-regeneration",
            sceneId: token.parent.id,
            sourceActorUuid: actor.uuid,
            name: "Регенерирующая душа"
          },
          () => regenerateJuggernaut(actor)
        );
    })().catch(error => console.error(`${MODULE_ID} | Regeneration`, error));
  });
  Hooks.on("preUpdateActor", (actor, changes, options = {}) => {
    const record = actor.getFlag?.(MODULE_ID, "juggernautTempHp"),
      temp = changes["system.attributes.hp.temp"] ?? changes.system?.attributes?.hp?.temp;
    if (
      record &&
      temp !== undefined &&
      !options[MODULE_ID]?.regeneration &&
      !changes[`flags.${MODULE_ID}.juggernautTempHp`]
    )
      changes[`flags.${MODULE_ID}.-=juggernautTempHp`] = null;
  });
  Hooks.on("dnd5e.preApplyDamage", (actor, amount, changes) => {
    const record = actor.getFlag?.(MODULE_ID, "juggernautTempHp"),
      temp = changes["system.attributes.hp.temp"];
    if (record && amount > 0 && temp !== undefined && Number(temp) <= Number(actor.system.attributes.hp.temp))
      changes[`flags.${MODULE_ID}.juggernautTempHp`] = { remaining: Number(temp) };
  });
  Hooks.on("updateActor", actor => {
    if (enabled() && isGmAuthority() && actor.getFlag?.(MODULE_ID, "juggernautTempHp"))
      reportJuggernaut(clearRegenerationTemporaryHp(actor));
  });
  const naturalOne = (rolls, config) => {
    const actor = config?.subject?.actor ?? config?.subject;
    if (!enabled() || !isGmAuthority() || actor?.getFlag?.(MODULE_ID, "juggernautFlaw") !== "luck") return;
    if (
      (rolls ?? []).some(roll =>
        roll.dice?.some(
          die =>
            die.faces === 20 &&
            die.results?.some(result => result.result === 1 && result.active !== false && !result.discarded)
        )
      )
    )
      reportJuggernaut(suppressJuggernautRegeneration(actor, actor.getActiveTokens?.()[0]?.document?.parent));
  };
  Hooks.on("dnd5e.rollAttack", naturalOne);
  Hooks.on("dnd5e.rollSavingThrow", naturalOne);
}
