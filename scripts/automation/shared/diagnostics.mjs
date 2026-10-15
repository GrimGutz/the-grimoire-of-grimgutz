import { FLAGS, MODULE_ID, SETTINGS } from "./constants.mjs";
import { automationAction, automationConfig, automationData, findFeature, itemIdentifier } from "./helpers.mjs";
import { isLikelyModuleItem, moduleItemSources } from "../effects/module-passives.mjs";
import { migrationFingerprint, ownedItemMigrationPlan } from "./owned-item-migration.mjs";
import { listAutomationEvents } from "./event-ledger.mjs";
import {doomedLevel,doomedCapacity,doomedAccepted} from "./doomed-state.mjs";
import {nightmareLevel,nightmareResourceState,nightmareKnown,nightmareState} from "./nightmare-state.mjs";
import {empathLevel,empathState,empathEffects,empathEffectData} from "./empath-state.mjs";
import {inspectArkane} from "../transformations/arkane.mjs";
import {inspectAutomaton} from "../transformations/automaton.mjs";
import {inspectBroodmother} from "../transformations/broodmother.mjs";
import {inspectChimera} from "../transformations/chimera.mjs";
import {inspectDeathknight} from "../transformations/deathknight.mjs";
import {inspectDullahan} from "../transformations/dullahan.mjs";
import {inspectFactory} from "../transformations/factory.mjs";
import {inspectGod} from "../transformations/god.mjs";
import {inspectHalfdragon} from "../transformations/halfdragon.mjs";
import {inspectHag} from "../transformations/hag.mjs";

const timeUnits = { seconds: 1, minutes: 60, hours: 3600, days: 86400, weeks: 604800, months: 2592000, years: 31536000 };
function values(collection) { return collection?.values ? [...collection.values()] : Object.values(collection ?? {}); }
function effectReport(effect) {
  const data = effect.toObject?.() ?? effect;
  const duration = data.duration ?? {}, start = data.start ?? {};
  const expiresAt = timeUnits[duration.units] && duration.value != null && start.time != null
    ? Number(start.time) + Number(duration.value) * timeUnits[duration.units] : null;
  const expired = duration.expired === true || (expiresAt !== null && expiresAt <= Number(game.time?.worldTime ?? 0));
  const reasons = [data.disabled && "disabled", effect.isSuppressed && "suppressed", expired && "expired"].filter(Boolean);
  const snapshot = data.flags?.[MODULE_ID]?.managedPassiveChanges;
  const edited = snapshot && snapshot !== migrationFingerprint(data.system?.changes ?? []);
  const legacyWeaponScope = ["witch-crystallization", "ethereal-storm"].includes(data.flags?.[MODULE_ID]?.[FLAGS.WEAPON_BUFF_EFFECT])
    && !data.flags?.[MODULE_ID]?.[FLAGS.WEAPON_BUFF_DATA]?.weaponUuids?.length;
  return { uuid: effect.uuid ?? null, name: effect.name, origin: data.origin ?? null, active: !reasons.length, reasons,
    warnings: [edited && "manual-passive-edit", legacyWeaponScope && "legacy-weapon-scope-missing"].filter(Boolean),
    duration: structuredClone(duration), start: structuredClone(start), expiresAt,
    remainingSeconds: expiresAt === null ? null : Math.max(0, expiresAt - Number(game.time?.worldTime ?? 0)),
    changes: structuredClone(data.system?.changes ?? []), moduleFlags: structuredClone(data.flags?.[MODULE_ID] ?? {}) };
}

/** Read-only: no validators, rolls, updateDuration(), synchronization or document writes. */
export async function inspectAutomation(actorOrUuid, { actionHandlers = new Map() } = {}) {
  const actor = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
  if (!actor || (actor.documentName && actor.documentName !== "Actor")) throw new TypeError("Ожидается Actor или UUID актёра.");
  if (!game.user?.isGM && !actor.testUserPermission?.(game.user, "OWNER")) throw Error("Диагностика доступна GM или владельцу персонажа.");
  const automationEnabled = game.settings.get(MODULE_ID, SETTINGS.AUTOMATION);
  const strictPrerequisites = game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES);
  const dependencies = ["midi-qol", "dae", "itemacro"].map(id => ({ id, active: game.modules?.get(id)?.active === true,
    version: game.modules?.get(id)?.version ?? null, required: id === "midi-qol" ? "advanced-combat" : "optional" }));
  const activeGM = game.users?.activeGM;
  const effects = values(actor.effects).map(effectReport);
  let sources = new Map(), sourceError = null;
  try { sources = await moduleItemSources(); } catch (error) { sourceError = String(error.message ?? error); }
  const items = values(actor.items).map(item => {
    const data = automationData(item), config = automationConfig(item);
    const uses = item.system?.uses ?? {}, max = Number(uses.max), spent = Number(uses.spent ?? 0);
    const available = Number.isFinite(Number(uses.value)) && uses.value != null ? Number(uses.value)
      : Number.isFinite(max) ? Math.max(0, max - spent) : null;
    const source = sources.get(itemIdentifier(item));
    const migration = source && isLikelyModuleItem(item, source) ? ownedItemMigrationPlan(item, source).conflicts : [];
    const actions = values(item.system?.activities).map(activity => {
      const actionData = automationData(activity);
      const action = automationAction(activity);
      if (!action) return null;
      const reasons = [!automationEnabled && "automation-disabled", !actionHandlers.has(action) && "unregistered-action",
        /summon|spirit-protection/.test(action) && !activeGM && "no-active-gm"].filter(Boolean);
      const consumedItems = values(activity.consumption?.targets).filter(target => target.type === "itemUses");
      for (const target of consumedItems) {
        const resource = target.target ? actor.items?.get?.(target.target) ?? values(actor.items).find(candidate => candidate.id === target.target) : item;
        if (!resource) { reasons.push("missing-resource"); continue; }
        const resourceUses = resource.system?.uses ?? {};
        const remaining = resourceUses.value ?? (Number(resourceUses.max) - Number(resourceUses.spent ?? 0));
        if (Number.isFinite(Number(remaining)) && Number(remaining) < Number(target.value ?? 1)) reasons.push("insufficient-resource");
      }
      for (const [field, feature] of [["witchBladeRageCost", "witch-hunter"], ["ritualistRitualPointCost", "binding-ritual"], ["hollowCost", "magic-eradicator"]]) {
        if (actionData[field] == null) continue;
        const resource = findFeature(actor, feature);
        if (!resource) { reasons.push("missing-resource"); continue; }
        const uses = resource.system?.uses ?? {}, remaining = uses.value ?? (Number(uses.max) - Number(uses.spent ?? 0));
        const cost = actionData[field] === "all" ? 1 : Number(actionData[field]);
        if (Number.isFinite(cost) && Number(remaining) < cost) reasons.push("insufficient-resource");
      }
      return { id: activity.id ?? activity._id, name: activity.name, action, registered: actionHandlers.has(action), reasons,
        consumption: structuredClone(activity.toObject?.().consumption ?? activity.consumption ?? {}),
        requirements: config.requirements, prerequisitesEnforced: strictPrerequisites };
    }).filter(Boolean);
    const relevantEffects = effects.filter(effect => effect.origin === item.uuid || effect.moduleFlags[FLAGS.PASSIVE_SOURCE]?.itemId === item.id);
    const passiveTemplates = values(item.effects).filter(effect => effect.getFlag?.(MODULE_ID, "passiveEffect") === true);
    return { uuid: item.uuid, name: item.name, identifier: itemIdentifier(item), feature: data.feature ?? null,
      resources: { max: uses.max ?? null, spent, available, recovery: structuredClone(uses.toObject?.().recovery ?? uses.recovery ?? []) },
      actions, effects: relevantEffects.map(effect => effect.uuid), migration,
      warnings: passiveTemplates.length && !relevantEffects.length ? ["passive-effect-missing"] : [] };
  });
  const summons = values(game.actors).filter(candidate => candidate.getFlag?.(MODULE_ID, "summonedBy") === actor.uuid
    && (game.user?.isGM || candidate.testUserPermission?.(game.user, "OWNER"))).map(candidate => ({
    uuid: candidate.uuid, name: candidate.name, kind: candidate.getFlag(MODULE_ID, "summonKind"),
    hp: candidate.system?.attributes?.hp?.value, maxHp: candidate.system?.attributes?.hp?.max,
    lifecycle: structuredClone(candidate.getFlag(MODULE_ID, "summonLifecycle") ?? null),
    warnings: candidate.getFlag(MODULE_ID, "summonManaged") ? [] : ["legacy-summon-without-snapshot"]
  }));
  return { actor: { uuid: actor.uuid, name: actor.name, synthetic: actor.isToken === true }, automationEnabled, strictPrerequisites,
    dependencies, authority: { activeGM: activeGM?.id ?? null, currentUser: game.user?.id ?? null,
      moduleSocket: game.modules?.get(MODULE_ID)?.socket === true }, sourceError, effects, items, summons,
    summonRequests: structuredClone(actor.getFlag?.(MODULE_ID, "summonRequests") ?? {}),
    nativeApplications: structuredClone(actor.getFlag?.(MODULE_ID, "nativeApplications") ?? {}),
    master: {configuration: structuredClone(actor.getFlag?.(MODULE_ID, "masterConfiguration") ?? null),
      ready: structuredClone(actor.getFlag?.(MODULE_ID, "masterReady") ?? null), series: structuredClone(actor.getFlag?.(MODULE_ID, "masterSeries") ?? null),
      usage: structuredClone(actor.getFlag?.(MODULE_ID, "masterTechniqueUsage") ?? null),
      blade: structuredClone(actor.getFlag?.(MODULE_ID, "masterBladeUses") ?? null)},
    bountyHunter:{configuration:structuredClone(actor.getFlag?.(MODULE_ID,"hunterConfiguration")??null),
      ready:structuredClone(actor.getFlag?.(MODULE_ID,"hunterReady")??null),uses:structuredClone(actor.getFlag?.(MODULE_ID,"hunterHitUses")??null),
      recoveryClaims:structuredClone(actor.getFlag?.(MODULE_ID,"hunterRecoveryClaims")??[]),
      fireDamage:structuredClone(actor.getFlag?.(MODULE_ID,"hunterFireDamage")??null),undeadTemporaryHp:structuredClone(actor.getFlag?.(MODULE_ID,"hunterUndeadTemp")??null)},
    jester:{ability:actor.getFlag?.(MODULE_ID,"jesterAbility")??null,roleChoice:actor.getFlag?.(MODULE_ID,"jesterRoleChoice")??null,
      role:structuredClone(actor.getFlag?.(MODULE_ID,"jesterRole")??null),laughterClaims:structuredClone(actor.getFlag?.(MODULE_ID,"jesterLaughterClaims")??[])},
    flagellant:{maximumDebts:structuredClone(actor.getFlag?.(MODULE_ID,"flagellantMaxDebts")??[]),
      sacrifice:structuredClone(actor.getFlag?.(MODULE_ID,"flagellantSacrifice")??null),applications:structuredClone(actor.getFlag?.(MODULE_ID,"flagellantApplications")??[]),
      prices:structuredClone(actor.getFlag?.(MODULE_ID,"flagellantPriceClaims")??{})},
    doomed:{level:doomedLevel(actor),slots:doomedCapacity(actor),missingCards:doomedAccepted(actor).filter(entry=>!findFeature(actor,entry.key)).map(entry=>entry.key),
      state:structuredClone(actor.getFlag?.(MODULE_ID,"doomedState")??null),
      increase:structuredClone(actor.getFlag?.(MODULE_ID,"doomedIncrease")??null),
      giftTurns:structuredClone(actor.getFlag?.(MODULE_ID,"doomedGiftTurns")??{}),
      decayTurns:structuredClone(actor.getFlag?.(MODULE_ID,"doomedDecayTurns")??[])},
    arkane:inspectArkane(actor),
    automaton:inspectAutomaton(actor),
    broodmother:inspectBroodmother(actor),
    chimera:inspectChimera(actor),
    deathknight:inspectDeathknight(actor),
    dullahan:inspectDullahan(actor),
    factory:inspectFactory(actor),
    god:inspectGod(actor),
    hag:inspectHag(actor),
    halfdragon:inspectHalfdragon(actor),
    empath:{level:empathLevel(actor),state:structuredClone(empathState(actor)),effects:empathEffects(actor).map(effect=>({uuid:effect.uuid,...structuredClone(empathEffectData(effect))})),lostActions:structuredClone(actor.getFlag?.(MODULE_ID,"empathLostActions")??null)},
    nightmare:{level:nightmareLevel(actor),resource:nightmareResourceState(actor),known:nightmareKnown(actor).map(entry=>entry.id),
      state:structuredClone(nightmareState(actor)),cooldowns:structuredClone(actor.getFlag?.(MODULE_ID,"nightmareFearCooldowns")??{}),
      feedRounds:structuredClone(actor.getFlag?.(MODULE_ID,"nightmareFeedRounds")??[]),increase:structuredClone(actor.getFlag?.(MODULE_ID,"nightmareIncrease")??null)},
    links: { bloodDrain: structuredClone(actor.getFlag?.(MODULE_ID, "bloodDrainLink") ?? null),
      leaderPresences: structuredClone(actor.getFlag?.(MODULE_ID, "leaderPresenceRecipients") ?? []),
      bloodSpell: structuredClone(actor.getFlag?.(MODULE_ID, "bloodSpellArmed") ?? null) },
    limitedBonuses: effects.filter(effect => effect.moduleFlags.combatBenefit).map(effect => ({uuid: effect.uuid, name: effect.name,
      active: effect.active, reasons: effect.reasons, ...effect.moduleFlags.combatBenefit})),
    pendingEvents: (await listAutomationEvents()).filter(event => event.sourceActorUuid === actor.uuid && ["queued", "running", "needs-review"].includes(event.state)) };
}
