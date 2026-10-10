import { FLAGS, MODULE_ID } from "../shared/constants.mjs";
import { automationData, enabled, findFeature, itemIdentifier, notify } from "../shared/helpers.mjs";
import { leaderLevel } from "../shared/selectors.mjs";
import { registerGmRequest, requestGm, isGmAuthority } from "../shared/gm-requests.mjs";
import { runAutomationEvent, registerAutomationEvent } from "../shared/event-ledger.mjs";
import { askOwner, confirmOwner, chooseSceneTokens } from "../shared/owner-prompts.mjs";
import { addCombatBenefit, canReact, inFeet, meleeReach, tokenRef, turnKey, recordModuleReaction } from "../shared/combat-benefits.mjs";
import { useNativeUtility, reactionAttack, prepareReactionAttack } from "../shared/native-actions.mjs";
import { handleStratagemUse, validateStratagemUse } from "./leader.mjs";
import { feetToSceneUnits } from "../shared/spatial.mjs";
import { dispatchAutomationPulse } from "../midi/aura-workflow.mjs";
import { inspiringTemporaryHp } from "../shared/leader-presence-definitions.mjs";
import { isAuraIncapacitated } from "../shared/aura-conditions.mjs";

export const STRATAGEM_RULES = Object.freeze({
  "stratagem-cunning-ruse": "contest", "stratagem-battle-cry": "battle-cry", "stratagem-command-caution": "caution",
  "stratagem-direct-attack": "direct", "stratagem-retreat-regroup": "retreat", "stratagem-guiding-magic": "guiding",
  "stratagem-helping-hand": "help", "stratagem-hold-the-line": "line", "stratagem-inspiring-word": "word",
  "stratagem-personal-example": "example", "stratagem-watch-out": "dodge", "stratagem-reinforcement": "reinforce",
  "stratagem-soothing-comfort": "comfort", "stratagem-sound-charge-retreat": "charge",
  "stratagem-subtle-misinformation": "mark", "stratagem-warlords-strike": "strike", "stratagem-wolf-pack-tactics": "wolf"
});
export function leaderDistance(actor, distance) { return findFeature(actor, "battlefield-conductor") && [30, 60].includes(distance) ? distance * 2 : distance; }
export function leaderDie(actor) { const level = leaderLevel(actor); return level >= 5 ? 8 : level >= 3 ? 6 : 4; }
export function movementChanges(actor, feet) {
  const value = feetToSceneUnits(feet, { grid: { units: actor.system?.attributes?.movement?.units ?? "ft" } });
  return ["walk", "fly", "climb", "swim", "burrow"].filter(key => Number(actor.system?.attributes?.movement?.[key]) > 0)
    .map(key => ({ key: `system.attributes.movement.${key}`, value: String(value), type: "add", phase: "final", priority: 20 }));
}
const change = (key, value) => ({ key, value: String(value), type: "add", phase: "initial", priority: 20 });
const participants = new Map();
export function onLeaderMechanic(name, handler) { participants.set(name, handler); }
async function roll(actor, formula, name) {
  const result = await new Roll(formula, actor.getRollData()).evaluate();
  await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: name }); return Number(result.total);
}
export async function giveLeaderTemporaryHp(source, target, item, amount, expiry = "sourceStart") {
  const actor = tokenRef(target).actor;
  amount = inspiringTemporaryHp(actor, amount);
  if (Number(actor.system.attributes.hp.temp ?? 0) >= amount) return false;
  const effect = await addCombatBenefit(source, target, item, { kind: "temporary-hp", expiry, amount });
  await actor.update({ "system.attributes.hp.temp": amount, [`flags.${MODULE_ID}.combatTempHp`]: { remaining: amount, effectUuid: effect.uuid } },
    { [MODULE_ID]: { tempHpGrant: true } });
  return effect;
}
async function skillRoll(actor, skill, bonus = 0, advantage = false, disadvantage = false) {
  const hook = Hooks.on("dnd5e.preRollSkill", config => {
    if (config.subject?.uuid !== actor.uuid) return;
    for (const roll of config.rolls ?? []) { roll.parts ??= []; roll.parts.push(String(bonus)); roll.options ??= {};
      if (advantage) roll.options.advantage = true; if (disadvantage) roll.options.disadvantage = true; }
  });
  try { return (await actor.rollSkill({ skill }, { configure: false }))?.[0]?.total; }
  finally { Hooks.off("dnd5e.preRollSkill", hook); }
}
async function applyStratagem(actor, data) {
  const activity = await fromUuid(data.activityUuid), source = await fromUuid(data.sourceTokenUuid), item = activity?.item;
  if (!item || activity.actor?.uuid !== actor.uuid || source?.actor?.uuid !== actor.uuid || !leaderLevel(actor)
    || !STRATAGEM_RULES[itemIdentifier(item)] || !validateStratagemUse(activity)) throw Error("Стратагема недоступна.");
  const scene = source.parent, level = leaderLevel(actor), prof = Number(actor.system.attributes.prof), rule = STRATAGEM_RULES[itemIdentifier(item)];
  if (isAuraIncapacitated(actor) || (activity.activation?.type === "reaction" && !canReact(actor))) return false;
  const combat = game.combats?.find?.(entry => entry.started && entry.scene?.id === scene.id);
  if (["battle-cry", "guiding", "line"].includes(rule) && combat?.combatant?.tokenId !== source.id)
    throw Error("Эта стратагема применяется в начале собственного хода; подтвердите момент в своём ходу.");
  if (["battle-cry", "guiding", "line"].includes(rule) && !await confirmOwner(actor, item.name, "Подтвердить: сейчас начало вашего хода?")) return false;
  const allies = token => token.uuid !== source.uuid && token.disposition === source.disposition && canReact(token.actor)
    && !token.actor.getFlag(MODULE_ID, "leaderStratagemReceived");
  const enemy = token => token.uuid !== source.uuid && token.disposition !== source.disposition;
  let selected = [], victim, mode, amount, defenderSkill, selectedSkill, helpKind;
  if (rule === "caution") mode = activity.activation?.type === "bonus" ? "check" : "protect";
  const select = async (relation, max = 1, range = null) => chooseSceneTokens(actor, scene, { title: item.name, max,
    relation: token => relation(token) && (range == null || inFeet(source, token, leaderDistance(actor, range), scene)) });
  if (["contest", "direct", "mark", "strike"].includes(rule) || (rule === "caution" && mode === "protect")) {
    [victim] = await select(enemy, 1, ["mark"].includes(rule) ? null : rule === "strike" ? 30 : 60) ?? [];
    if (!victim) return false;
  }
  if (["contest", "direct", "mark", "example"].includes(rule)
    && !await confirmOwner(actor, item.name, "Подтвердить указанное в карточке предшествующее попадание/урон и условия способности?")) return false;
  if (rule === "example") {
    const received = actor.getFlag(MODULE_ID, "lastReceivedDamage");
    amount = received?.turn === turnKey(combat) ? received.amount : await askOwner(actor, { kind: "number", title: item.name, label: "Фактически полученный урон", min: 1, max: 10000, defaultValue: 1 });
  }
  if (amount === null) return false;
  if (["direct", "guiding", "line"].includes(rule)) selected = [];
  else if (rule === "mark") selected = await select(token => allies(token) && inFeet(token, victim, 5, scene));
  else if (rule === "contest") selected = await select(token => allies(token) && inFeet(token, victim, leaderDistance(actor, 60), scene));
  else if (rule === "battle-cry") selected = await select(allies, 2 * level);
  else if (rule === "caution" && mode === "protect") selected = await select(allies, level);
  else if (rule === "example") selected = await select(allies, level, 60);
  else if (rule === "charge") selected = await select(allies, Math.max(1, scene.tokens.size ?? scene.tokens.length), 30);
  else selected = await select(allies, 1, ["word"].includes(rule) ? 30 : ["help", "comfort"].includes(rule) ? 5 : ["wolf", "reinforce"].includes(rule) ? 60 : null);
  if (selected == null || (!["direct", "guiding", "line"].includes(rule) && !selected.length)) return false;
  if (selected.length && !await confirmOwner(actor, item.name, "Получатели добровольны и выполняют условия связи из карточки?")) return false;
  if (rule === "reinforce") {
    const context = selected[0].actor.getFlag(MODULE_ID, "lastConfirmedDamage");
    const target = context ? await fromUuid(context.targetTokenUuid) : null;
    if (!context || context.automatic || !target || context.turn !== turnKey(combat) || (!combat && Number(game.time.worldTime) - context.time > 6)
      || (!inFeet(source, selected[0], leaderDistance(actor, 60), scene) && !inFeet(source, target, leaderDistance(actor, 60), scene)))
      throw Error("Нужен подтверждённый урон союзника в этом ходу и дистанция 60 футов до него или цели.");
  }
  if (["wolf", "retreat"].includes(rule)) {
    if (!await confirmOwner(selected[0].actor, item.name, "Использовать реакцию, выполнить перемещение вручную и продолжить?")) return false;
    // Native movement is deliberately not replaced by teleportation.
    if (!await confirmOwner(actor, item.name, "Перемещение союзника завершено?")) return false;
    if (rule === "wolf") { [victim] = await chooseSceneTokens(actor, scene, { title: "Цель следующего попадания", relation: token => enemy(token) && inFeet(selected[0], token, 15, scene) }) ?? []; if (!victim) return false; }
  }
  if (rule === "contest") {
    mode = await askOwner(actor, { title: item.name, choices: ["arc", "inv", "dec", "prf", "slt", "sur"].map(skill => [skill, CONFIG.DND5E.skills[skill].label]) });
    if (!mode) return false;
    defenderSkill = await askOwner(victim.actor, { title: item.name, choices: [["inv", "Расследование"], ["ins", "Проницательность"], ["prc", "Восприятие"]] });
    if (!defenderSkill) return false;
  }
  if (rule === "caution" && mode === "check") {
    selectedSkill = await askOwner(selected[0].actor, { title: item.name, choices: [["prc", "Восприятие"], ["inv", "Расследование"]] });
    if (!selectedSkill) return false;
  }
  if (rule === "help") {
    helpKind = await askOwner(selected[0].actor, { title: item.name, choices: [["stand", "Встать"], ["escape", "Вырваться из захвата"]] });
    if (!helpKind) return false;
    if (helpKind === "escape") {
      selectedSkill = await askOwner(selected[0].actor, { title: item.name, choices: [["ath", "Атлетика"], ["acr", "Акробатика"]] });
      if (!selectedSkill) return false;
    }
  }
  const preparedAttack = rule === "strike" ? await prepareReactionAttack(selected[0], victim, {name: item.name}) : null;
  if (rule === "strike" && !preparedAttack) return false;
  const native = await useNativeUtility(activity);
  if (native === false || native?.aborted) return false;
  await handleStratagemUse(activity);
  if (native === undefined) return { status: "needs-review" };
  if (!isGmAuthority()) return {status: "needs-review"};
  if (activity.activation?.type === "reaction") await recordModuleReaction(actor, scene);
  if (["wolf", "retreat"].includes(rule)) { await globalThis.MidiQOL?.setReactionUsed?.(selected[0].actor); await recordModuleReaction(selected[0].actor, scene); }
  const commandId = native.id ?? foundry.utils.randomID();
  for (const target of selected) await target.actor.setFlag(MODULE_ID, "leaderStratagemReceived", { combatId: combat?.id ?? null, turn: turnKey(combat), commandId });
  const add = (target, options) => addCombatBenefit(source, target, item, { commandId, ...options });
  if (rule === "word") { const action = activity.activation?.type === "action"; await giveLeaderTemporaryHp(source, selected[0], item,
    await roll(actor, action ? `1d4 + ${level + prof}` : `1d4 + ${Math.floor(prof / 2)}`, item.name), "targetEnd"); }
  if (rule === "example") for (const target of selected) await giveLeaderTemporaryHp(source, target, item, Math.min(level, Math.floor(amount / 2)), "targetEnd");
  if (rule === "direct") await add(victim, { kind: "direct-attack", remaining: 1 + level, formula: `1d${leaderDie(actor)} + ${Math.floor(prof / 2)}`,
    weaponOnly: true, attackers: [...scene.tokens].filter(allies).map(token => token.uuid) });
  if (rule === "contest") {
    const attack = await skillRoll(actor, mode, level, false, true), defense = await skillRoll(victim.actor, defenderSkill, 0, true);
    if (attack > defense) await add(selected[0], { kind: "attack-advantage", against: [victim.uuid], expiry: "sourceEnd" });
  }
  if (rule === "battle-cry") for (const target of selected) await add(target, { kind: "battle-cry", amount: level });
  if (rule === "caution") {
    if (mode === "check") await skillRoll(selected[0].actor, selectedSkill, level);
    else for (const target of selected) await add(target, { kind: "caution", against: [victim.uuid], remaining: 1 });
  }
  if (rule === "retreat") {
    await add(selected[0], { kind: "opportunity-ac", amount: level, expiry: "sourceStart" });
    for (const target of [...scene.tokens].filter(token => allies(token) && inFeet(source, token, 5, scene))) await giveLeaderTemporaryHp(source, target, item, Math.floor(prof / 2));
  }
  if (rule === "guiding") await add(source, { kind: "guiding-magic", amount: level });
  if (rule === "help") {
    if (helpKind === "stand") for (const effect of [...selected[0].actor.effects].filter(effect => effect.statuses?.has?.("prone"))) await effect.delete();
    if (helpKind === "escape") await skillRoll(selected[0].actor, selectedSkill, level);
    await add(selected[0], { kind: "save-bonus", expiry: "targetEnd", changes: [change("system.bonuses.abilities.save", 1 + level)] });
  }
  if (rule === "line") for (const target of [...scene.tokens].filter(allies)) {
    await add(target, { kind: "attack-advantage", weaponOnly: true, opportunityOnly: true, rangeSource: meleeReach(actor) });
    await add(target, { kind: "damage-bonus", weaponOnly: true, opportunityOnly: true, rangeSource: meleeReach(actor), amount: level });
  }
  if (rule === "dodge") { await add(selected[0], { kind: "dodge", expiry: "targetStart" });
    if (level >= 5) await add(selected[0], { kind: "start-disengage", expiry: "targetEnd" }); }
  if (rule === "reinforce") {
    const context = selected[0].actor.getFlag(MODULE_ID, "lastConfirmedDamage"), target = await fromUuid(context.targetTokenUuid), sourceItem = await fromUuid(context.activityUuid);
    await dispatchAutomationPulse({ scene, sourceToken: selected[0].object ?? { actor: selected[0].actor, document: selected[0] },
      sourceItem: sourceItem.item, targets: [target.object ?? { actor: target.actor, document: target }],
      event: { damage: [{ formula: `1d${leaderDie(actor)} + ${level}`, type: context.damageType }] },
      eventKey: `reinforcement:${source.uuid}:${context.key}` });
  }
  if (rule === "comfort") await add(selected[0], { kind: "maximize-hit-dice", amount: level, remaining: level });
  if (rule === "charge") for (const target of [source, ...selected]) await add(target, { kind: "charge", dash: true,
    changes: movementChanges(target.actor, level >= 5 ? 20 : level >= 3 ? 15 : 10) });
  if (rule === "mark") {
    for (const effect of [...victim.actor.effects].filter(effect => effect.getFlag?.(MODULE_ID, "combatBenefit")?.kind === "mark")) await effect.delete();
    await add(victim, { kind: "mark", protectedBy: selected[0].uuid, expiry: null });
  }
  if (rule === "strike") return reactionAttack(selected[0], victim, { name: item.name, attackBonus: level, prepared: preparedAttack,
    damageBonus: findFeature(selected[0].actor, "extra-attack") ? prof : 0 });
  if (rule === "wolf") await add(selected[0], { kind: "damage-bonus", against: [victim.uuid], weaponOnly: true, remaining: 1, amount: level + prof });
  return true;
}

registerAutomationEvent("leader-stratagem", async record => applyStratagem(await fromUuid(record.sourceActorUuid), record.input));
registerGmRequest("leader-stratagem", async (actor, data, context) => {
  const source = await fromUuid(data.sourceTokenUuid);
  if (source?.actor?.uuid !== actor.uuid) throw Error("Не найден токен Лидера.");
  return runAutomationEvent({ id: `leader:${context.requestId}`, kind: "leader-stratagem", sceneId: source.parent.id,
    sourceActorUuid: actor.uuid, name: "Стратагема Лидера", input: data }, () => applyStratagem(actor, data),
  { queued: !canvas?.ready || canvas.scene?.id !== source.parent.id });
});
export async function useLeaderStratagem(activity, {sourceTokenUuid = null} = {}) {
  const actor = activity.actor, source = sourceTokenUuid ? await fromUuid(sourceTokenUuid) : canvas.tokens?.controlled?.find(token => token.actor.uuid === actor.uuid)?.document ?? actor.getActiveTokens?.()[0]?.document;
  if (!source) { notify("Для стратагемы нужен токен Лидера на сцене.", "warn"); return false; }
  return requestGm("leader-stratagem", actor, { activityUuid: activity.uuid, sourceTokenUuid: source.uuid }, { timeoutMs: 120000 });
}
export function installLeaderStratagemHooks() {
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (!enabled() || automationData(activity).leaderResolved || !automationData(activity.item).stratagem) return;
    void useLeaderStratagem(activity).catch(error => notify(error.message, "warn")); return false;
  });
  Hooks.on("updateCombat", (combat, changes) => { if (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round")) return; const actor = combat.combatant?.actor;
    if (actor?.isOwner && actor.getFlag(MODULE_ID, "leaderStratagemReceived")) void actor.unsetFlag(MODULE_ID, "leaderStratagemReceived"); });
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    const record = actor.getFlag?.(MODULE_ID, "combatTempHp"), next = changes["system.attributes.hp.temp"] ?? changes.system?.attributes?.hp?.temp;
    if (!record || next === undefined || options?.[MODULE_ID]?.tempHpGrant) return;
    if (options?.[MODULE_ID]?.combatDamage && Number(next) <= Number(actor.system.attributes.hp.temp))
      changes[`flags.${MODULE_ID}.combatTempHp`] = { ...record, remaining: Number(next) };
    else changes[`flags.${MODULE_ID}.-=combatTempHp`] = null;
  });
  Hooks.on("dnd5e.preApplyDamage", (actor, amount, _updates, options) => { if (amount > 0 && actor.getFlag?.(MODULE_ID, "combatTempHp")) {
    options[MODULE_ID] ??= {}; options[MODULE_ID].combatDamage = true;
  } });
  Hooks.on("deleteActiveEffect", effect => { const record = effect.parent?.getFlag?.(MODULE_ID, "combatTempHp");
    if (effect.parent?.isOwner && record?.effectUuid === effect.uuid) { const update = { [`flags.${MODULE_ID}.-=combatTempHp`]: null };
      if (Number(effect.parent.system.attributes.hp.temp) === record.remaining) update["system.attributes.hp.temp"] = 0;
      void effect.parent.update(update); } });
}
