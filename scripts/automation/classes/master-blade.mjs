import {MODULE_ID} from "../shared/constants.mjs";
import {automationData, enabled, findFeature, notify} from "../shared/helpers.mjs";
import {masterPath, masterMatchesWeapon, masterFeatureAvailable} from "./master.mjs";
import {confirmOwner} from "../shared/owner-prompts.mjs";
import {registerGmRequest, requestGm} from "../shared/gm-requests.mjs";
import {serialMutation} from "../shared/transactions.mjs";
import {encounterForScene} from "../shared/combat-flow.mjs";
import {tokenRef, turnKey} from "../shared/combat-benefits.mjs";

const FLAG = "masterBladeUses";
const plain = value => JSON.parse(JSON.stringify(value));
const stateFor = actor => structuredClone(actor.getFlag(MODULE_ID, FLAG) ?? {offers: [], turns: []});
const persist = (actor, state) => actor.setFlag(MODULE_ID, FLAG, {offers: state.offers.slice(-20), turns: state.turns.slice(-40)});
const featureFor = actor => {
  const item = findFeature(actor, "master-path-blade");
  return masterPath(actor) === "blade" && item && masterFeatureAvailable(actor, item) ? item : null;
};
const matches = (actor, activity) => actor && enabled() && featureFor(actor) && activity?.type === "attack"
  && activity.damage?.includeBase === true && !automationData(activity).auraPulse && masterMatchesWeapon(actor, activity.item);

/** Only a native weapon's base pool; never guess a custom formula or an added damage part. */
export function masterBladeBase(item, attackMode) {
  const base = item?.system?.damage?.base;
  let part = base;
  if (item?.system?.isVersatile && attackMode === "twoHanded") {
    const versatile = item.system.damage.versatile;
    if (!versatile) return null;
    part = {...versatile, number: versatile.number || base?.number,
      denomination: versatile.denomination || base?.steppedDenomination?.()};
  }
  return part && !part.custom?.enabled && Number.isInteger(Number(part.number)) && Number(part.number) > 0
    && Number.isInteger(Number(part.denomination)) && Number(part.denomination) > 1
    ? {number: Number(part.number), faces: Number(part.denomination)} : null;
}

/** Select after native critical expansion. An extra die is added once, not multiplied by criticals. */
export function masterBladeTerm(data, base) {
  const term = data?.terms?.[0];
  if (!base || !data.evaluated || !Number.isFinite(data.total) || ["healing", "temphp"].includes(data.options?.type)
    || data.options?.[MODULE_ID]?.masterBlade || term?.class !== "Die" || term.faces !== base.faces
    || (term.options?.baseNumber ?? term.number) !== base.number || !Number.isInteger(term.number) || term.number < base.number
    || term.number > 100 || term.options?.criticalBonusDamage || term.options?.criticalFlatBonus) return null;
  // Keep/drop, exploding, success-counting and nested pools need an explicit ruling.
  if ((term.modifiers ?? []).some(m => !/^(?:r{1,2}(?:[<>=]+)?\d+|min\d+|max\d+)$/i.test(m))) return null;
  const active = (term.results ?? []).filter(r => r.active);
  if (active.length !== term.number || active.some(r => !Number.isFinite(r.result) || (r.count !== undefined && !Number.isFinite(r.count)))) return null;
  return term;
}

/** Preserve every original result and modifier. Only discard the worst die from base pool + one new die. */
export function replaceMasterBladeDie(data, base, bonus) {
  const term = masterBladeTerm(data, base);
  const extra = bonus?.terms?.[0], results = extra?.results?.filter(r => r.active) ?? [];
  if (!term || !bonus.evaluated || extra?.class !== "Die" || extra.faces !== base.faces || results.length !== 1
    || !Number.isFinite(results[0].result) || (results[0].count !== undefined && !Number.isFinite(results[0].count))) return null;
  const result = structuredClone(data), changed = result.terms[0], keep = changed.number;
  changed.number++;
  changed.modifiers = [...(changed.modifiers ?? []), `kh${keep}`];
  changed.results.push(...structuredClone(extra.results));
  // On ties discard the new die, keeping the existing result identities stable.
  const active = changed.results.filter(r => r.active);
  const value = r => r.count ?? r.result;
  const worst = active.reduce((a, b) => value(b) <= value(a) ? b : a);
  worst.active = false; worst.discarded = true;
  result.total += value(results[0]) - value(worst);
  result.options ??= {}; result.options[MODULE_ID] = {...result.options[MODULE_ID], masterBlade: true};
  return result;
}

async function sourceActivity(actor, data) {
  const source = await fromUuid(data.sourceUuid), activity = await fromUuid(data.activityUuid);
  if (source?.actor?.uuid !== actor.uuid || activity?.actor?.uuid !== actor.uuid || !matches(actor, activity)) return null;
  return {source, activity};
}

registerGmRequest("master-blade-offer", (actor, data) => serialMutation(`master-blade:${actor.uuid}`, async () => {
  const context = await sourceActivity(actor, data);
  if (!context || !data.workflowId) return false;
  const state = stateFor(actor), previous = state.offers.find(row => row.workflowId === data.workflowId);
  if (previous) return previous.approved ? {status: "success", value: true} : false;
  const turn = turnKey(encounterForScene(context.source.parent, context.source));
  const base = masterBladeBase(context.activity.item, data.attackMode);
  if (!turn || turn !== data.turn || !base || state.turns.includes(turn)) return false;
  const hits = [];
  for (const uuid of [...new Set(data.hits ?? [])]) {
    const target = await fromUuid(uuid);
    if (target?.actor && target.parent?.id === context.source.parent.id) hits.push(uuid);
  }
  if (!hits.length) return false;
  const approved = await confirmOwner(actor, "Путь Клинка", "Бросить дополнительную кость избранного оружия и заменить худшую? Один раз за ход.",
    {id: `master-blade:${actor.uuid}:${data.workflowId}`});
  state.offers.push({workflowId: data.workflowId, activityUuid: context.activity.uuid, sourceUuid: context.source.uuid,
    turn, base, hits, approved, status: "offered"});
  await persist(actor, state);
  return approved;
}));

const fingerprint = rolls => JSON.stringify(rolls.map(r => ({formula: r.formula, terms: r.terms, total: r.total})));
registerGmRequest("master-blade-complete", (actor, data) => serialMutation(`master-blade:${actor.uuid}`, async () => {
  const state = stateFor(actor), receipt = state.offers.find(row => row.workflowId === data.workflowId);
  if (!receipt?.approved || !await sourceActivity(actor, receipt) || !Array.isArray(data.rolls) || !data.rolls.length || data.rolls.length > 12) return false;
  const signature = fingerprint(data.rolls);
  if (receipt.status === "applied") return receipt.signature === signature ? {status: "success", rolls: receipt.rolls} : {status: "needs-review"};
  if (receipt.status === "needs-review") return {status: "needs-review"};
  if (state.turns.includes(receipt.turn)) return false;
  const term = masterBladeTerm(data.rolls[0], receipt.base);
  if (!term) return false;
  // Claim only after an evaluated native damage roll exists. Cancelling its dialog spends nothing.
  receipt.status = "needs-review"; receipt.signature = signature;
  state.turns.push(receipt.turn);
  await persist(actor, state);
  const bonus = await new Roll(`1d${term.faces}${(term.modifiers ?? []).join("")}`).evaluate();
  const changed = replaceMasterBladeDie(data.rolls[0], receipt.base, plain(bonus));
  if (!changed) return {status: "needs-review"};
  const RollClass = CONFIG.Dice.DamageRoll;
  const restored = RollClass.fromData(changed);
  // Public native API rebuilds both formula and total without evaluating any original dice again.
  const finalRoll = RollClass.fromTerms(restored.terms, {...restored.options, configured: true, preprocessed: true});
  receipt.rolls = [plain(finalRoll), ...data.rolls.slice(1)]; receipt.status = "applied";
  await persist(actor, state);
  return {status: "success", rolls: receipt.rolls};
}));

const workflowEligible = workflow => !workflow?.aborted && matches(workflow?.actor, workflow?.activity)
  && Boolean(workflow.attackRoll) && Boolean(workflow.hitTargets?.size || workflow.hitTargetsEC?.size);
const workflowKey = workflow => {
  const id = String(workflow.id ?? "");
  // Without a chat card Midi temporarily uses the activity UUID for every use.
  return id && id !== workflow.activity?.uuid ? id : `${workflow.activity.uuid}:${foundry.utils.randomID()}`;
};

export async function offerMasterBlade(workflow) {
  if (!workflowEligible(workflow)) return;
  if (workflow.grimgutzMasterBlade) return workflow.grimgutzMasterBlade.promise;
  const source = tokenRef(workflow.token), base = masterBladeBase(workflow.item, workflow.attackMode);
  if (!source?.parent || !base) return;
  const turn = turnKey(encounterForScene(source.parent, source)), workflowId = workflowKey(workflow);
  const state = workflow.grimgutzMasterBlade = {approved: false, workflowId};
  if (!turn) {notify("Путь Клинка: вне боя лимит «раз за ход» подтверждается вручную.", "info"); return;}
  state.promise = requestGm("master-blade-offer", workflow.actor, {workflowId, turn, attackMode: workflow.attackMode,
    sourceUuid: source.uuid, activityUuid: workflow.grimgutzMaster?.originalActivityUuid ?? workflow.activity.uuid,
    hits: [...new Set([...(workflow.hitTargets ?? []), ...(workflow.hitTargetsEC ?? [])])].map(t => tokenRef(t).uuid)},
  {requestId: `master-blade-offer:${workflowId}`, timeoutMs: 120000}).then(reply => {
    state.approved = reply.status === "success"; return reply;
  });
  return state.promise;
}

export async function completeMasterBlade(workflow) {
  const state = workflow?.grimgutzMasterBlade;
  if (!workflowEligible(workflow) || !state?.approved || state.applied || !workflow.damageRolls?.length) return;
  if (state.completing) return state.completing;
  state.completing = (async () => {
    const rolls = workflow.damageRolls.map(plain);
    if (!masterBladeTerm(rolls[0], masterBladeBase(workflow.item, workflow.attackMode))) {
      notify("Путь Клинка: нестандартная группа костей требует ручного сравнения.", "info"); return;
    }
    const reply = await requestGm("master-blade-complete", workflow.actor, {workflowId: state.workflowId, rolls},
      {requestId: `master-blade-complete:${state.workflowId}`, timeoutMs: 120000});
    if (reply.status === "success") {
      await workflow.setDamageRolls(reply.rolls.map(data => CONFIG.Dice.DamageRoll.fromData(data)));
      state.applied = true;
    } else if (["pending", "needs-review", "failed"].includes(reply.status)) {
      // Never let an unknown outcome silently apply the unmodified damage.
      workflow.aborted = true;
      notify("Путь Клинка: результат требует проверки GM; применение урона остановлено.", "warn");
    }
  })();
  try {return await state.completing;}
  catch (error) {
    workflow.aborted = true;
    notify(`Путь Клинка: применение урона остановлено; нужна проверка GM (${error.message}).`, "warn");
  } finally {state.completing = null;}
}

export function installMasterBladeHooks() {
  // Midi awaits these hooks. Native dnd5e.preRollDamage does NOT await async listeners.
  Hooks.on("midi-qol.preDamageRoll", workflow => offerMasterBlade(workflow));
  Hooks.on("midi-qol.DamageRollComplete", workflow => completeMasterBlade(workflow));
}
