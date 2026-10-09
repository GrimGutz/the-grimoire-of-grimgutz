import {
  FLAGS,
  MODULE_ID,
  SETTINGS,
  STYLES
} from "./shared/constants.mjs";
import {
  activityActor,
  automationAction,
  automationData,
  enabled,
  isAutomationAuthority,
  itemIdentifier,
  notify
} from "./shared/helpers.mjs";
import { clamp } from "./shared/dnd5e.mjs";
import { installTemporaryEffectHooks } from "./effects/temporary-effects.mjs";
import { automationActors } from "./effects/temporary-effects.mjs";
import { createActorSynchronizer } from "./shared/actor-sync.mjs";
import { syncUniqueSummons, summonRequestResult } from "./shared/summons.mjs";
import {
  deathKnightClass,
  deathKnightLevel,
  paladinLevel
} from "./shared/selectors.mjs";
import {
  juggernautPrerequisiteFailures,
  validateJuggernautFeaturePrerequisites,
  validateJuggernautPrerequisites
} from "./classes/juggernaut.mjs";
import {
  activateSoulShard,
  clearSoulShard,
  soulEaterPrerequisiteFailures,
  validateSoulEaterFeaturePrerequisites,
  validateSoulEaterPrerequisites
} from "./classes/soul-eater.mjs";
import {
  guardianPrerequisiteFailures,
  syncGuardianResources,
  validateGuardianFeaturePrerequisites,
  validateGuardianPrerequisites
} from "./classes/guardian.mjs";
import {
  activateCrusaderRage,
  condemnCrusaderTarget,
  crusaderPrerequisiteFailures,
  syncCrusaderResources,
  useCrusaderConsecration,
  validateCrusaderCondemnationUse,
  validateCrusaderConsecrationUse,
  validateCrusaderFeaturePrerequisites,
  validateCrusaderPrerequisites,
  validateCrusaderRageUse
} from "./classes/crusader.mjs";
import {
  applyFeyWarriorDamageAutomation,
  feyWarriorPrerequisiteFailures,
  syncFeyWarriorPassiveEffects,
  syncFeyWarriorResources,
  validateFeyWarriorFeaturePrerequisites,
  validateFeyWarriorPrerequisites
} from "./classes/fey-warrior.mjs";
import {
  activateSpiritForm,
  endSpiritForm,
  ghostWalkerPrerequisiteFailures,
  summonUnfinishedBusinessSpirit,
  syncGhostWalkerPassiveEffects,
  syncGhostWalkerResources,
  validateGhostWalkerFeaturePrerequisites,
  validateGhostWalkerPrerequisites,
  validateGhostWalkerSummonUse,
  validateSpiritFormUse
} from "./classes/ghost-walker.mjs";
import {
  activateSidewaysShift,
  applyBlinkerDamageAutomation,
  blinkerPrerequisiteFailures,
  syncBlinkerResources,
  useInnerBlink,
  useOuterBlink,
  validateBlinkUse,
  validateBlinkerFeaturePrerequisites,
  validateBlinkerPrerequisites
} from "./classes/blinker.mjs";
import {
  applyFallenPriestSpellProgression,
  fallenPriestPrerequisiteFailures,
  syncFallenPriestSpellcasting,
  validateFallenPriestFeaturePrerequisites,
  validateFallenPriestPrerequisites
} from "./classes/fallen-priest.mjs";
import {
  activateDiseaseForm,
  clearSmartInfections,
  createSmartInfection,
  endDiseaseForm,
  plagueDoctorPrerequisiteFailures,
  rollPlagueSneakAttack,
  syncPlagueDoctorResources,
  validatePlagueDoctorFeaturePrerequisites,
  validatePlagueDoctorPrerequisites
} from "./classes/plague-doctor.mjs";
import {
  detachCrawlingEye,
  insectLordPrerequisiteFailures,
  returnCrawlingEye,
  rollInsectBite,
  rollInsectBloodDrain,
  rollInsectBoneBlades,
  rollInsectSpew,
  rollInsectTailSting,
  summonInsectFamiliar,
  summonInsectSwarm,
  syncInsectLordPassiveEffects,
  syncInsectLordResources,
  useCrawlingArmor,
  validateInsectLordFeaturePrerequisites,
  validateInsectLordPrerequisites
} from "./classes/insect-lord.mjs";
import {
  acesBeat,
  dealThem,
  discardHeldAstralCard,
  drawAstralCard,
  gamblerPrerequisiteFailures,
  rollRoguesAreLucky,
  storeSleevedCard,
  syncGamblerResources,
  useHeldAstralCard,
  useSleevedCard,
  validateGamblerFeaturePrerequisites,
  validateGamblerPrerequisites
} from "./classes/gambler.mjs";
import {
  keeperPrerequisiteFailures,
  keeperSubclassPrerequisiteFailures,
  rollKeeperAllyStrike,
  rollKeeperMightDamage,
  rollKeeperRestRecovery,
  summonKeeperAlly,
  syncKeeperAllyPoints,
  syncKeeperResources,
  validateKeeperFeaturePrerequisites,
  validateKeeperPrerequisites,
  validateKeeperSubclassPrerequisites
} from "./classes/keeper.mjs";
import {
  applyBloodMagicCost,
  bloodMagePrerequisiteFailures,
  clearBloodMagicCosts,
  rollBloodMageSacrifice,
  validateBloodMagicCostUse,
  validateBloodMageFeaturePrerequisites,
  validateBloodMagePrerequisites,
  validateBloodMageSacrificeUse
} from "./classes/blood-mage.mjs";
import {
  onmyojiPrerequisiteFailures,
  summonOnmyojiShikigami,
  syncOnmyojiResources,
  useOnmyojiKi,
  validateOnmyojiFeaturePrerequisites,
  validateOnmyojiKiUse,
  validateOnmyojiShikigamiUse,
  validateOnmyojiPrerequisites
} from "./classes/onmyoji.mjs";
import {
  ritualistPrerequisiteFailures,
  rollRitualistSpiritAgony,
  rollRitualistSpiritDestructionDie,
  rollRitualistSpiritLife,
  rollRitualistSpiritProtection,
  rollRitualistSpiritSorrow,
  showRitualistSpiritChannel,
  showRitualistSpiritDC,
  summonRitualistSpirits,
  syncRitualistResources,
  useRitualistRitualPoints,
  validateRitualistFeaturePrerequisites,
  validateRitualistPrerequisites,
  validateRitualistRitualPointUse
} from "./classes/ritualist.mjs";
import {
  applyBlackMagicOil,
  applyDarkWarriorDamageAutomation,
  darkWarriorPrerequisiteFailures,
  drinkDarkWarriorElixir,
  syncDarkWarriorResources,
  validateDarkWarriorActivityUse,
  validateDarkWarriorFeaturePrerequisites,
  validateDarkWarriorPrerequisites
} from "./classes/dark-warrior.mjs";
import {
  applyHellfireDamageAutomation,
  applyHellfireFury,
  chooseDevilWorshipperAbility,
  devilWorshipperPrerequisiteFailures,
  gainDevilSoulAuraTempHp,
  rollDevilGlaiveDamage,
  rollDevilGlaiveGrappleDamage,
  showDarkLuck,
  showEmpoweredCharms,
  summonDevilGlaive,
  summonImpFamiliar,
  validateDevilWorshipperActivityUse,
  validateDevilWorshipperFeaturePrerequisites,
  validateDevilWorshipperPrerequisites
} from "./classes/devil-worshipper.mjs";
import {
  activateMiniMythal,
  castNethereseGreatSpell,
  nethereseArcanistPrerequisiteFailures,
  overloadMiniMythal,
  showScholarArcanist,
  teleportInMiniMythal,
  useAncientKnowledge,
  validateNethereseArcanistActivityUse,
  validateNethereseArcanistFeaturePrerequisites,
  validateNethereseArcanistPrerequisites
} from "./classes/netherese-arcanist.mjs";
import {
  activateSpiritFlow,
  applySpiritVesselDamageAutomation,
  beginSpiritVesselTurn,
  chooseSpiritVesselAbility,
  chooseSpiritVesselStrikeDamage,
  handleSpiritVesselAction,
  isSpiritVesselAction,
  rollSpiritVesselConcentratedStrike,
  spiritVesselPrerequisiteFailures,
  syncSpiritVesselPassiveEffects,
  syncSpiritVesselResources,
  validateSpiritVesselActivityUse,
  validateSpiritVesselFeaturePrerequisites,
  validateSpiritVesselPrerequisites,
  validateSpiritVesselSubclassPrerequisites
} from "./classes/spirit-vessel.mjs";
import {
  handleOracleAction,
  isOracleAction,
  oraclePrerequisiteFailures,
  syncOraclePassiveEffects,
  syncOracleResources,
  validateOracleActivityUse,
  validateOracleFeaturePrerequisites,
  validateOraclePrerequisites
} from "./classes/oracle.mjs";
import {
  activateDemonicVitality,
  beginDemonologistTurn,
  demonologistPrerequisiteFailures,
  handleDemonologistAction,
  isDemonologistAction,
  validateDemonologistActivityUse,
  validateDemonologistFeaturePrerequisites,
  validateDemonologistPrerequisites
} from "./classes/demonologist.mjs";
import {
  clearSanguinistRestState,
  handleSanguinistAction,
  isSanguinistAction,
  sanguinistPrerequisiteFailures,
  syncSanguinistResources,
  validateSanguinistActivityUse,
  validateSanguinistFeaturePrerequisites,
  validateSanguinistPrerequisites
} from "./classes/sanguinist.mjs";
import {
  gainHollowCharge,
  handleTransformationAction,
  isTransformationAction,
  syncHollowPassiveEffects,
  syncHollowTransformation,
  syncMurderspawnPassiveEffects,
  syncMurderspawnTransformation,
  syncTransformationPassiveEffects,
  syncTransformations,
  useHollowCharges,
  validateTransformationActivityUse
} from "./transformations/index.mjs";
import { createPrerequisiteValidators } from "./validation/prerequisites.mjs";
import { createAdvancementValidator } from "./validation/advancement.mjs";
import {
  isLikelyModuleItem,
  moduleItemSources,
  syncModulePassiveEffects
} from "./effects/module-passives.mjs";
import { installMidiQolHooks } from "./midi/hooks.mjs";
import { installSummonSocket } from "./shared/summons.mjs";
import {
  auraDefinitions,
  installAuraHooks,
  scheduleAuraSync,
  syncSceneAuras
} from "./shared/auras.mjs";
import {
  applyMidiWeaponBuffAttackAutomation,
  applyWeaponBuffAttackAutomation,
  applyWeaponBuffDamageAutomation
} from "./shared/weapon-buffs.mjs";
import {
  applyCrusherDamageAutomation,
  applyCrusherNativeAttackAutomation,
  applyMidiAttackDisadvantage,
  applyPowerfulCleaving,
  applySmithing,
  armSteelWill,
  canUseStyle,
  clearPendingSteelWill,
  finishMidiSteelWill,
  isMassiveWeapon,
  massiveWeapons,
  prepareMassiveWeaponProficiency,
  prepareMidiSteelWill,
  replaceDexteritySave,
  setStyle,
  syncCrusherPassiveEffects,
  syncSteelGiant,
  toggleGreatWeaponMaster,
  toggleStyle,
  updateOwnedMassiveWeaponProficiency,
  validateSteelWillUse
} from "./classes/crusher.mjs";
import {
  chooseOccultAbility,
  restoreDefiledHeart,
  syncHereticPassiveEffects,
  useOccultPoints,
  validateHereticActivityUse
} from "./classes/heretic.mjs";
import {
  activateEtherealStorm,
  activateWitchCrystallization,
  activateWitchHunterEmpower,
  openImmaterialWhirlwind,
  syncWitchBladeRage,
  useWitchBladeSealEvil,
  useWitchBladeRage,
  validateWitchBladeRageUse
} from "./classes/witch-blade.mjs";
import {
  armGlimpseOfGenius,
  beginLeaderTurn,
  clearLeaderCombatState,
  endLeaderTurn,
  handleStratagemUse,
  syncLeaderPassiveEffects,
  validateStratagemUse
} from "./classes/leader.mjs";
import {
  isDeathKnightHealingBlocked,
  syncDeathKnightPassiveEffects,
  syncMysticalPower
} from "./classes/death-knight.mjs";
import {
  applyForestLordSpellProgression,
  beginForestTurn,
  chooseForestBaseClass,
  clearForestCombatState,
  clearForestRootStateFromEffect,
  endForestTurn,
  markForestRootFireDamage,
  rollForestUnarmedDamage,
  syncDarkGuard,
  syncForestPassiveEffects,
  syncNatureMagic,
  takeRoot,
  validateForestAction,
  withdrawRoots
} from "./classes/forest-lord.mjs";
import {
  applyAberrantNativeAttackAutomation,
  applyGiantKiller,
  armDeadlyPrecision,
  syncAberrantPassiveEffects,
  useVigorousNature,
  validateAberrantAction
} from "./classes/aberrant.mjs";
import {
  chooseSchoolSteelWeapons,
  handleSchoolOfSteelAction,
  isSchoolOfSteelAction,
  syncSchoolOfSteel,
  validateSchoolOfSteelAction
} from "./subclasses/school-of-steel.mjs";

export {
  MODULE_ID,
  activateSpiritForm,
  activateSoulShard,
  activateCrusaderRage,
  activateWitchHunterEmpower,
  activateWitchCrystallization,
  activateEtherealStorm,
  condemnCrusaderTarget,
  useCrusaderConsecration,
  activateSidewaysShift,
  activateDiseaseForm,
  acesBeat,
  clearSmartInfections,
  createSmartInfection,
  dealThem,
  detachCrawlingEye,
  discardHeldAstralCard,
  drawAstralCard,
  endDiseaseForm,
  useInnerBlink,
  useOuterBlink,
  applySmithing,
  applyBloodMagicCost,
  armDeadlyPrecision,
  armGlimpseOfGenius,
  armSteelWill,
  chooseForestBaseClass,
  chooseOccultAbility,
  chooseSchoolSteelWeapons,
  endSpiritForm,
  summonUnfinishedBusinessSpirit,
  gainHollowCharge,
  rollForestUnarmedDamage,
  rollRoguesAreLucky,
  rollInsectBite,
  rollInsectBloodDrain,
  rollInsectBoneBlades,
  rollInsectSpew,
  rollInsectTailSting,
  summonInsectFamiliar,
  summonInsectSwarm,
  summonKeeperAlly,
  rollKeeperAllyStrike,
  rollKeeperMightDamage,
  rollKeeperRestRecovery,
  rollBloodMageSacrifice,
  summonOnmyojiShikigami,
  syncOnmyojiResources,
  rollRitualistSpiritAgony,
  rollRitualistSpiritDestructionDie,
  rollRitualistSpiritLife,
  rollRitualistSpiritProtection,
  rollRitualistSpiritSorrow,
  showRitualistSpiritChannel,
  showRitualistSpiritDC,
  summonRitualistSpirits,
  syncRitualistResources,
  applyBlackMagicOil,
  drinkDarkWarriorElixir,
  syncDarkWarriorResources,
  chooseDevilWorshipperAbility,
  showDarkLuck,
  showEmpoweredCharms,
  summonDevilGlaive,
  summonImpFamiliar,
  rollDevilGlaiveDamage,
  rollDevilGlaiveGrappleDamage,
  gainDevilSoulAuraTempHp,
  showScholarArcanist,
  activateMiniMythal,
  activateDemonicVitality,
  teleportInMiniMythal,
  overloadMiniMythal,
  useAncientKnowledge,
  castNethereseGreatSpell,
  chooseSpiritVesselAbility,
  chooseSpiritVesselStrikeDamage,
  rollSpiritVesselConcentratedStrike,
  activateSpiritFlow,
  syncOraclePassiveEffects,
  syncOracleResources,
  setStyle,
  syncAberrantPassiveEffects,
  syncCrusherPassiveEffects,
  syncDarkGuard,
  syncDeathKnightPassiveEffects,
  syncForestPassiveEffects,
  syncGuardianResources,
  syncCrusaderResources,
  syncFeyWarriorPassiveEffects,
  syncFeyWarriorResources,
  syncFallenPriestSpellcasting,
  syncGamblerResources,
  syncKeeperAllyPoints,
  syncKeeperResources,
  syncPlagueDoctorResources,
  syncGhostWalkerPassiveEffects,
  syncGhostWalkerResources,
  syncBlinkerResources,
  syncHereticPassiveEffects,
  syncInsectLordPassiveEffects,
  syncInsectLordResources,
  syncHollowPassiveEffects,
  syncHollowTransformation,
  syncLeaderPassiveEffects,
  syncModulePassiveEffects,
  syncMurderspawnPassiveEffects,
  syncMurderspawnTransformation,
  syncMysticalPower,
  syncNatureMagic,
  syncSchoolOfSteel,
  syncSpiritVesselPassiveEffects,
  syncSpiritVesselResources,
  syncSteelGiant,
  syncWitchBladeRage,
  clearBloodMagicCosts,
  takeRoot,
  toggleGreatWeaponMaster,
  toggleStyle,
  useOccultPoints,
  useCrawlingArmor,
  useHeldAstralCard,
  useSleevedCard,
  useVigorousNature,
  useWitchBladeRage,
  useWitchBladeSealEvil,
  openImmaterialWhirlwind,
  useOnmyojiKi,
  useRitualistRitualPoints,
  useHollowCharges,
  returnCrawlingEye,
  storeSleevedCard,
  withdrawRoots
};

function actionFromActivity(activity) {
  return automationAction(activity);
}

async function handleActivityAction(activity, context = {}) {
  if (!enabled()) return;
  const actor = activityActor(activity);
  const action = actionFromActivity(activity);
  if (!actor || !action) return;

  if (isTransformationAction(action)) {
    await handleTransformationAction(actor, activity, action);
    return;
  }
  if (isSchoolOfSteelAction(action)) {
    await handleSchoolOfSteelAction(actor, activity, action);
    return;
  }
  if (isSpiritVesselAction(action)) {
    await handleSpiritVesselAction(actor, activity, action);
    return;
  }
  if (isOracleAction(action)) {
    await handleOracleAction(actor, activity, action);
    return;
  }
  if (isDemonologistAction(action)) {
    await handleDemonologistAction(actor, activity, action);
    return;
  }
  if (isSanguinistAction(action)) {
    await handleSanguinistAction(actor, activity, action);
    return;
  }

  switch (action) {
    case "toggle-gwm":
      await toggleGreatWeaponMaster(actor);
      break;
    case "set-style-cleaving":
      await setStyle(actor, STYLES.CLEAVING);
      break;
    case "set-style-crushing":
      await setStyle(actor, STYLES.CRUSHING);
      break;
    case "toggle-style":
      await toggleStyle(actor);
      break;
    case "arm-steel-will":
      await armSteelWill(actor);
      break;
    case "sync-steel-giant":
      await syncSteelGiant(actor, { notifyResult: true });
      break;
    case "smithing":
      await applySmithing(actor);
      break;
    case "arm-glimpse-of-genius":
      await armGlimpseOfGenius(actor);
      break;
    case "choose-occult-ability":
      await chooseOccultAbility(actor);
      break;
    case "use-occult-points":
      await useOccultPoints(actor, activity);
      break;
    case "choose-forest-base-class":
      await chooseForestBaseClass(actor);
      break;
    case "forest-unarmed-damage":
      await rollForestUnarmedDamage(actor);
      break;
    case "take-root":
      await takeRoot(actor);
      break;
    case "withdraw-roots":
      await withdrawRoots(actor);
      break;
    case "arm-deadly-precision":
      await armDeadlyPrecision(actor);
      break;
    case "vigorous-nature":
      await useVigorousNature(actor);
      break;
    case "activate-soul-shard":
      await activateSoulShard(actor);
      break;
    case "use-witch-blade-rage":
      await useWitchBladeRage(actor, activity);
      break;
    case "activate-witch-hunter-empower":
      await activateWitchHunterEmpower(actor, activity);
      break;
    case "activate-witch-crystallization":
      await activateWitchCrystallization(actor);
      break;
    case "activate-ethereal-storm":
      await activateEtherealStorm(actor, activity);
      break;
    case "open-immaterial-whirlwind":
      await openImmaterialWhirlwind(actor, activity);
      break;
    case "use-witch-blade-seal-evil":
      await useWitchBladeSealEvil(actor, activity);
      break;
    case "activate-crusader-rage":
      await activateCrusaderRage(actor);
      break;
    case "use-crusader-consecration":
      await useCrusaderConsecration(actor);
      break;
    case "condemn-crusader-target":
      await condemnCrusaderTarget(actor);
      break;
    case "activate-spirit-form":
      await activateSpiritForm(actor);
      break;
    case "summon-ghost-walker-spirit":
      await summonUnfinishedBusinessSpirit(actor, activity, { consumed: context.nativeSummonConsumption === true });
      break;
    case "end-spirit-form":
      await endSpiritForm(actor);
      break;
    case "use-inner-blink":
      await useInnerBlink(actor);
      break;
    case "use-outer-blink":
      await useOuterBlink(actor);
      break;
    case "activate-sideways-shift":
      await activateSidewaysShift(actor);
      break;
    case "sync-fallen-priest-spellcasting":
      await syncFallenPriestSpellcasting(actor, { notifyResult: true });
      break;
    case "roll-plague-sneak-attack":
      await rollPlagueSneakAttack(actor);
      break;
    case "create-smart-infection":
      await createSmartInfection(actor, activity);
      break;
    case "clear-smart-infections":
      await clearSmartInfections(actor);
      break;
    case "activate-disease-form":
      await activateDiseaseForm(actor);
      break;
    case "end-disease-form":
      await endDiseaseForm(actor);
      break;
    case "draw-astral-card":
      await drawAstralCard(actor);
      break;
    case "use-held-astral-card":
      await useHeldAstralCard(actor);
      break;
    case "discard-held-astral-card":
      await discardHeldAstralCard(actor);
      break;
    case "deal-them":
      await dealThem(actor);
      break;
    case "rogues-are-lucky":
      await rollRoguesAreLucky(actor);
      break;
    case "store-sleeved-card":
      await storeSleevedCard(actor);
      break;
    case "use-sleeved-card":
      await useSleevedCard(actor);
      break;
    case "aces-beat":
      await acesBeat(actor);
      break;
    case "summon-keeper-ally":
      await summonKeeperAlly(actor, activity);
      break;
    case "sync-keeper-ally-points":
      await syncKeeperAllyPoints(actor);
      break;
    case "roll-keeper-ally-strike":
      await rollKeeperAllyStrike(actor);
      break;
    case "roll-keeper-rest-recovery":
      await rollKeeperRestRecovery(actor);
      break;
    case "roll-keeper-might-damage":
      await rollKeeperMightDamage(actor);
      break;
    case "apply-blood-magic-cost":
      await applyBloodMagicCost(actor, activity);
      break;
    case "roll-blood-mage-sacrifice":
      await rollBloodMageSacrifice(actor);
      break;
    case "sync-onmyoji-resources":
      await syncOnmyojiResources(actor, { notifyResult: true });
      break;
    case "summon-onmyoji-shikigami":
      await summonOnmyojiShikigami(actor);
      break;
    case "use-onmyoji-ki":
      await useOnmyojiKi(actor, activity);
      break;
    case "sync-ritualist-resources":
      await syncRitualistResources(actor, { notifyResult: true });
      break;
    case "summon-ritualist-spirits":
      await summonRitualistSpirits(actor, activity);
      break;
    case "use-ritualist-ritual-points":
      await useRitualistRitualPoints(actor, activity);
      break;
    case "show-ritualist-spirit-dc":
      await showRitualistSpiritDC(actor);
      break;
    case "roll-ritualist-spirit-agony":
      await rollRitualistSpiritAgony(actor);
      break;
    case "roll-ritualist-spirit-life":
      await rollRitualistSpiritLife(actor);
      break;
    case "roll-ritualist-spirit-protection":
      await rollRitualistSpiritProtection(actor);
      break;
    case "roll-ritualist-spirit-sorrow":
      await rollRitualistSpiritSorrow(actor);
      break;
    case "roll-ritualist-spirit-destruction-die":
      await rollRitualistSpiritDestructionDie(actor);
      break;
    case "show-ritualist-spirit-channel":
      await showRitualistSpiritChannel(actor);
      break;
    case "apply-black-magic-oil":
      await applyBlackMagicOil(actor);
      break;
    case "drink-dark-warrior-elixir":
      await drinkDarkWarriorElixir(actor, activity);
      break;
    case "sync-dark-warrior-resources":
      await syncDarkWarriorResources(actor, { notifyResult: true });
      break;
    case "choose-devil-worshipper-ability":
      await chooseDevilWorshipperAbility(actor);
      break;
    case "show-dark-luck":
      await showDarkLuck(actor);
      break;
    case "show-empowered-charms":
      await showEmpoweredCharms(actor);
      break;
    case "summon-devil-glaive":
      await summonDevilGlaive(actor);
      break;
    case "summon-devil-imp-familiar":
      await summonImpFamiliar(actor);
      break;
    case "roll-devil-glaive-damage":
      await rollDevilGlaiveDamage(actor);
      break;
    case "roll-devil-glaive-grapple-damage":
      await rollDevilGlaiveGrappleDamage(actor);
      break;
    case "gain-devil-soul-aura-temp-hp":
      await gainDevilSoulAuraTempHp(actor, activity);
      break;
    case "show-scholar-arcanist":
      await showScholarArcanist(actor);
      break;
    case "activate-mini-mythal":
      await activateMiniMythal(actor);
      break;
    case "teleport-in-mini-mythal":
      await teleportInMiniMythal(actor);
      break;
    case "overload-mini-mythal":
      await overloadMiniMythal(actor);
      break;
    case "use-ancient-knowledge":
      await useAncientKnowledge(actor);
      break;
    case "cast-netherese-great-spell":
      await castNethereseGreatSpell(actor, activity);
      break;
    case "roll-insect-tail-sting":
      await rollInsectTailSting(actor);
      break;
    case "summon-insect-familiar":
      await summonInsectFamiliar(actor, activity);
      break;
    case "roll-insect-bone-blades":
      await rollInsectBoneBlades(actor);
      break;
    case "roll-insect-bite":
      await rollInsectBite(actor);
      break;
    case "roll-insect-blood-drain":
      await rollInsectBloodDrain(actor);
      break;
    case "use-crawling-armor":
      await useCrawlingArmor(actor);
      break;
    case "roll-insect-spew":
      await rollInsectSpew(actor);
      break;
    case "summon-insect-swarm":
      await summonInsectSwarm(actor);
      break;
    case "detach-crawling-eye":
      await detachCrawlingEye(actor);
      break;
    case "return-crawling-eye":
      await returnCrawlingEye(actor);
      break;
  }
}

function validateActivityUse(activity) {
  if (!enabled()) return true;
  const actor = activityActor(activity);
  const action = actionFromActivity(activity);

  if (["choose-forest-base-class", "take-root", "withdraw-roots"].includes(action)) {
    return validateForestAction(actor, action);
  }
  if (action === "arm-deadly-precision") return validateAberrantAction(actor, action);
  if (action === "choose-occult-ability" || action === "use-occult-points") {
    return validateHereticActivityUse(activity);
  }
  if (isTransformationAction(action)) return validateTransformationActivityUse(activity, action);
  if (action === "use-witch-blade-rage") return validateWitchBladeRageUse(actor, activity);
  if (action === "activate-witch-hunter-empower") return validateWitchBladeRageUse(actor, activity);
  if (action === "activate-ethereal-storm") return validateWitchBladeRageUse(actor, activity);
  if (action === "open-immaterial-whirlwind") return validateWitchBladeRageUse(actor, activity);
  if (action === "use-witch-blade-seal-evil") return validateWitchBladeRageUse(actor, activity);
  if (action === "activate-crusader-rage") return validateCrusaderRageUse(actor);
  if (action === "use-crusader-consecration") return validateCrusaderConsecrationUse(actor);
  if (action === "condemn-crusader-target") return validateCrusaderCondemnationUse(actor);
  if (action === "activate-spirit-form") return validateSpiritFormUse(actor, activity);
  if (action === "summon-ghost-walker-spirit") return validateGhostWalkerSummonUse(actor, activity);
  if (action === "use-inner-blink" || action === "use-outer-blink") return validateBlinkUse(actor);
  if (action === "arm-steel-will") return validateSteelWillUse(actor);
  if (action === "apply-blood-magic-cost") return validateBloodMagicCostUse(actor, activity);
  if (action === "roll-blood-mage-sacrifice") return validateBloodMageSacrificeUse(actor);
  if (action === "use-onmyoji-ki") return validateOnmyojiKiUse(actor, activity);
  if (action === "summon-onmyoji-shikigami") return validateOnmyojiShikigamiUse(actor);
  if (action === "use-ritualist-ritual-points" || action === "summon-ritualist-spirits") return validateRitualistRitualPointUse(actor, activity);
  if (["apply-black-magic-oil", "drink-dark-warrior-elixir"].includes(action)) {
    return validateDarkWarriorActivityUse(actor, activity, action);
  }
  if ([
    "choose-devil-worshipper-ability",
    "show-dark-luck",
    "show-empowered-charms",
    "summon-devil-imp-familiar",
    "summon-devil-glaive",
    "roll-devil-glaive-damage",
    "roll-devil-glaive-grapple-damage",
    "gain-devil-soul-aura-temp-hp"
  ].includes(action)) {
    return validateDevilWorshipperActivityUse(actor, activity, action);
  }
  if ([
    "show-scholar-arcanist",
    "activate-mini-mythal",
    "teleport-in-mini-mythal",
    "overload-mini-mythal",
    "use-ancient-knowledge",
    "cast-netherese-great-spell"
  ].includes(action)) {
    return validateNethereseArcanistActivityUse(actor, activity, action);
  }

  if (isSchoolOfSteelAction(action)) return validateSchoolOfSteelAction(actor, action);
  if (isSpiritVesselAction(action)) return validateSpiritVesselActivityUse(actor, activity, action);
  if (isOracleAction(action)) return validateOracleActivityUse(actor, activity, action);
  if (isDemonologistAction(action)) return validateDemonologistActivityUse(actor, activity, action);
  if (isSanguinistAction(action)) return validateSanguinistActivityUse(actor, activity, action);
  if (action === "arm-glimpse-of-genius") {
    if (!actor?.getFlag(MODULE_ID, FLAGS.GLIMPSE_ARMED)) return true;
    notify(`${actor.name}: «Проблеск гения» уже подготовлен.`, "warn");
    return false;
  }

  return validateStratagemUse(activity);
}
function recalculateDamageItem(token, damageItem, rawDamage) {
  const actor = token.actor;
  const selector = damageItem.damageSelector ?? "combinedDamage";
  const options = damageItem.damageDetails?.calcDamageOptions?.[selector]
    ?? damageItem.calcDamageOptions
    ?? { invertHealing: true, multiplier: 1 };
  const calculated = foundry.utils.deepClone(actor.calculateDamage(rawDamage, options));

  damageItem.rawDamageDetail = rawDamage;
  damageItem.damageDetail = calculated;
  damageItem.damageDetails ??= { calcDamageOptions: {} };
  damageItem.damageDetails[`raw${selector}`] = rawDamage;
  damageItem.damageDetails[selector] = calculated;

  let damage = 0;
  let healing = 0;
  let temporary = 0;
  for (const detail of calculated) {
    if (detail.type === "temphp") temporary += Number(detail.value ?? 0);
    else if (detail.type === "healing") healing += Number(detail.value ?? 0);
    else if (!["midi-none", "vitality", "maximum"].includes(detail.type)) damage += Number(detail.value ?? 0);
  }

  damage = Math.max(0, damage);
  const adjusted = damage + healing;
  const rounded = adjusted < 0 ? Math.ceil(adjusted) : Math.floor(adjusted);
  const hp = actor.system.attributes.hp;
  const oldHP = Number(hp.value ?? 0);
  const oldTempHP = Number(hp.temp ?? 0);
  const absorbed = rounded > 0 ? Math.min(oldTempHP, rounded) : 0;
  const hpDamage = clamp(rounded - absorbed, -(Number(hp.damage ?? 0)), oldHP);

  damageItem.oldHP = oldHP;
  damageItem.newHP = oldHP - hpDamage;
  damageItem.oldTempHP = oldTempHP;
  damageItem.newTempHP = Math.floor(Math.max(0, oldTempHP - absorbed, temporary));
  damageItem.hpDamage = hpDamage;
  damageItem.tempDamage = oldTempHP - damageItem.newTempHP;
  damageItem.totalDamage = damage;
  damageItem.healingAdjustedTotalDamage = rounded;
}

function applyNativeAttackAutomation(config) {
  if (!enabled()) return;
  applyWeaponBuffAttackAutomation(config);
  applyAberrantNativeAttackAutomation(config);
  applyCrusherNativeAttackAutomation(config);
}

function applyDamageAutomation(config) {
  applyWeaponBuffDamageAutomation(config);
  applyCrusherDamageAutomation(config);
  applyFeyWarriorDamageAutomation(config);
  applyBlinkerDamageAutomation(config);
  applyDarkWarriorDamageAutomation(config);
  applyHellfireDamageAutomation(config);
  applySpiritVesselDamageAutomation(config);
}

async function applyGiantKillerHook(token, context) {
  return applyGiantKiller(token, context, {
    automationEnabled: enabled(),
    isMassiveWeapon,
    recalculateDamageItem
  });
}

function applyDeathKnightHealingRestriction(token, { workflow, damageItem }) {
  if (!enabled() || !token?.actor || !isDeathKnightHealingBlocked(workflow, token.actor)) return;
  if (damageItem.damageSelector && damageItem.damageSelector !== "combinedDamage") return;

  const selector = damageItem.damageSelector ?? "combinedDamage";
  const rawKey = `raw${selector}`;
  const rawDamage = foundry.utils.deepClone(
    damageItem.damageDetails?.[rawKey] ?? damageItem.rawDamageDetail ?? []
  );
  if (!rawDamage.some(detail => detail.type === "healing")) return;

  const filtered = rawDamage.filter(detail => detail.type !== "healing");
  recalculateDamageItem(token, damageItem, filtered);
  damageItem.details ??= [];
  damageItem.details.push("Нежить: лечение заклинанием или зельем не действует");
}

async function markForestRootFireDamageHook(token, context) {
  return markForestRootFireDamage(token, context, { automationEnabled: enabled() });
}

async function applyHellfireFuryHook(token, context) {
  return applyHellfireFury(token, context, {
    automationEnabled: enabled(),
    recalculateDamageItem
  });
}

function applyMysticalPowerProgression(progression, actor, cls, _spellcasting, count) {
  if (!enabled()) return;
  const identifier = itemIdentifier(cls);
  const rounding = count === 1 ? Math.ceil : Math.floor;

  if (identifier === "paladin" && deathKnightClass(actor)) {
    const effectivePaladinLevel = paladinLevel(actor) + deathKnightLevel(actor);
    progression.spell += rounding(effectivePaladinLevel / 2);
    return false;
  }

  const fallenPriestProgression = applyFallenPriestSpellProgression(progression, actor, cls, count);
  if (fallenPriestProgression === false) return false;

  return applyForestLordSpellProgression(progression, actor, cls, count);
}

const {
  aberrantPrerequisiteFailures,
  crusherPrerequisiteFailures,
  deathKnightPrerequisiteFailures,
  forestLordPrerequisiteFailures,
  hereticPrerequisiteFailures,
  leaderPrerequisiteFailures,
  validateAberrantFeaturePrerequisites,
  validateAberrantPrerequisites,
  validateCrusherPrerequisites,
  validateDeathKnightFeaturePrerequisites,
  validateDeathKnightPrerequisites,
  validateForestLordFeaturePrerequisites,
  validateForestLordPrerequisites,
  validateHereticFeaturePrerequisites,
  validateHereticPrerequisites,
  validateLeaderFeaturePrerequisites,
  validateLeaderPrerequisites,
  validateSchoolOfSteelFeaturePrerequisites,
  validateSchoolOfSteelPrerequisites,
  validateTechniquePrerequisites,
  validateWitchBladeFeaturePrerequisites,
  validateWitchBladePrerequisites,
  witchBladePrerequisiteFailures
} = createPrerequisiteValidators({ canUseStyle, massiveWeapons });

const validateAdvancement = createAdvancementValidator({
  aberrantPrerequisiteFailures,
  crusherPrerequisiteFailures,
  deathKnightPrerequisiteFailures,
  forestLordPrerequisiteFailures,
  hereticPrerequisiteFailures,
  juggernautPrerequisiteFailures,
  leaderPrerequisiteFailures,
  soulEaterPrerequisiteFailures,
  guardianPrerequisiteFailures,
  crusaderPrerequisiteFailures,
  feyWarriorPrerequisiteFailures,
  ghostWalkerPrerequisiteFailures,
  blinkerPrerequisiteFailures,
  fallenPriestPrerequisiteFailures,
  plagueDoctorPrerequisiteFailures,
  insectLordPrerequisiteFailures,
  gamblerPrerequisiteFailures,
  keeperPrerequisiteFailures,
  keeperSubclassPrerequisiteFailures,
  witchBladePrerequisiteFailures,
  bloodMagePrerequisiteFailures,
  onmyojiPrerequisiteFailures,
  ritualistPrerequisiteFailures,
  darkWarriorPrerequisiteFailures,
  devilWorshipperPrerequisiteFailures,
  nethereseArcanistPrerequisiteFailures,
  spiritVesselPrerequisiteFailures,
  oraclePrerequisiteFailures,
  demonologistPrerequisiteFailures,
  sanguinistPrerequisiteFailures
});
function actorFromEffect(effect) {
  if (effect?.parent instanceof Actor) return effect.parent;
  if (effect?.parent instanceof Item) return effect.parent.actor;
  return null;
}

function scheduleSteelGiantSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void syncSteelGiant(actor).catch(error => {
      console.error(`${MODULE_ID} | Steel Giant sync failed`, error);
    });
  }, 50);
}

function scheduleMysticalPowerSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void syncMysticalPower(actor).catch(error => {
      console.error(`${MODULE_ID} | Mystical Power sync failed`, error);
    });
  }, 50);
}

function scheduleNatureMagicSync(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  setTimeout(() => {
    void syncNatureMagic(actor).catch(error => {
      console.error(`${MODULE_ID} | Nature Magic sync failed`, error);
    });
  }, 50);
}

const actorSynchronizer = createActorSynchronizer([
  syncCrusherPassiveEffects, syncLeaderPassiveEffects, syncDeathKnightPassiveEffects,
  syncHereticPassiveEffects, syncForestPassiveEffects, syncAberrantPassiveEffects,
  syncTransformationPassiveEffects, syncModulePassiveEffects, syncWitchBladeRage,
  updateOwnedMassiveWeaponProficiency, syncSteelGiant, syncMysticalPower, syncNatureMagic,
  syncGuardianResources, syncCrusaderResources, syncFeyWarriorResources,
  syncFallenPriestSpellcasting, syncGamblerResources, syncKeeperResources,
  syncOnmyojiResources, syncRitualistResources, syncDarkWarriorResources,
  syncPlagueDoctorResources, syncInsectLordResources, syncInsectLordPassiveEffects,
  syncFeyWarriorPassiveEffects, syncGhostWalkerResources, syncGhostWalkerPassiveEffects,
  syncBlinkerResources, syncSpiritVesselResources, syncSpiritVesselPassiveEffects,
  syncOracleResources, syncOraclePassiveEffects, syncSanguinistResources,
  syncSchoolOfSteel, syncTransformations, syncDarkGuard, syncUniqueSummons
]);
const schedulePassiveSync = actorSynchronizer.schedule;

function activitiesOf(item) {
  const activities = item?.system?.activities;
  if (!activities) return [];
  if (typeof activities.values === "function") return [...activities.values()];
  return Object.values(activities);
}

function hasModuleAction(item) {
  return activitiesOf(item).some(activity => Boolean(actionFromActivity(activity)));
}

function moduleActionSignature(item) {
  return activitiesOf(item)
    .map(activity => actionFromActivity(activity))
    .filter(Boolean)
    .sort()
    .join("|");
}

async function migrateOwnedItems(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  const sources = await moduleItemSources();
  const updates = [];
  const effectSyncs = [];

  const effectSignature = effects => effects.map(effect => ({
    name: effect.name,
    transfer: effect.transfer,
    changes: effect.system?.changes ?? effect.system?.toObject?.().changes ?? []
  }));

  for (const item of actor.items) {
    const source = sources.get(itemIdentifier(item));
    if (!source || !isLikelyModuleItem(item, source)) continue;
    const sourceData = source.toObject();
    const update = { _id: item.id };
    let changed = false;

    if (!automationData(item).feature && !automationData(item).massiveWeapon) {
      update[`flags.${MODULE_ID}`] = sourceData.flags?.[MODULE_ID] ?? {};
      changed = true;
    }
    if (hasModuleAction(source) && moduleActionSignature(source) !== moduleActionSignature(item)) {
      update["system.activities"] = sourceData.system.activities;
      changed = true;
    }
    if (item.system.description?.value !== sourceData.system.description?.value) {
      update["system.description"] = sourceData.system.description;
      changed = true;
    }
    const currentEffects = item.effects?.map(effect => effect.toObject()) ?? [];
    if (
      (sourceData.effects?.length ?? 0) > 0
      && JSON.stringify(effectSignature(currentEffects)) !== JSON.stringify(effectSignature(sourceData.effects))
    ) {
      effectSyncs.push({
        item,
        effects: sourceData.effects
      });
    }
    if (changed) updates.push(update);
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates);
    console.log(`${MODULE_ID} | Migrated ${updates.length} owned items on ${actor.name}`);
  }
  for (const { item, effects } of effectSyncs) {
    const updates = [];
    const creates = [];
    for (const effect of effects) {
      if (item.effects.get(effect._id)) updates.push(effect);
      else creates.push(effect);
    }
    if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await item.createEmbeddedDocuments("ActiveEffect", creates, { keepId: true });
  }
  if (effectSyncs.length) {
    console.log(`${MODULE_ID} | Synchronized effects on ${effectSyncs.length} owned items for ${actor.name}`);
  }
}

function installHooks() {
  installSummonSocket();
  installAuraHooks();
  installTemporaryEffectHooks();
  Hooks.on("dnd5e.preAdvancementManagerComplete", validateAdvancement);
  Hooks.on("dnd5e.preUseActivity", validateActivityUse);
  Hooks.on("dnd5e.preActivityConsumption", (activity, usageConfig) => {
    if (!enabled() || actionFromActivity(activity) !== "summon-ghost-walker-spirit") return;
    // The GM reserves and refunds this resource as part of the summon transaction.
    usageConfig.consume = { ...(typeof usageConfig.consume === "object" ? usageConfig.consume : {}), resources: false };
    usageConfig[MODULE_ID] = { ...(usageConfig[MODULE_ID] ?? {}), managedSummonResource: true };
  });
  Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
    const deltas = results?.message?.system?.deltas?.item?.[activity.item?.id] ?? [];
    const nativeSummonConsumption = !usageConfig?.[MODULE_ID]?.managedSummonResource
      && deltas.some(delta => delta.keyPath === "system.uses.spent" && delta.delta > 0);
    void handleActivityAction(activity, { nativeSummonConsumption }).catch(error => console.error(`${MODULE_ID} | Activity automation failed`, error));
    void handleStratagemUse(activity).catch(error => console.error(`${MODULE_ID} | Stratagem automation failed`, error));
  });
  Hooks.on("dnd5e.preRollAttack", applyNativeAttackAutomation);
  Hooks.on("dnd5e.preRollDamage", applyDamageAutomation);
  Hooks.on("dnd5e.preRollSavingThrow", replaceDexteritySave);
  Hooks.on("dnd5e.computeLeveledProgression", applyMysticalPowerProgression);
  Hooks.on("dnd5e.computeSpellProgression", applyMysticalPowerProgression);
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    void restoreDefiledHeart(actor, result, { automationEnabled: enabled() }).catch(
      error => console.error(`${MODULE_ID} | Defiled Heart recovery failed`, error)
    );
    void clearBloodMagicCosts(actor, result, { automationEnabled: enabled() }).catch(
      error => console.error(`${MODULE_ID} | Blood Magic recovery failed`, error)
    );
    void clearSanguinistRestState(actor, result, { automationEnabled: enabled() }).catch(
      error => console.error(`${MODULE_ID} | Sanguinist recovery failed`, error)
    );
  });
  Hooks.on("dnd5e.rollSavingThrow", (_rolls, { subject }) => {
    void clearPendingSteelWill(subject);
  });

  installMidiQolHooks({
    applyMidiAttackDisadvantage,
    applyPowerfulCleaving,
    applyGiantKillerHook,
    applyDeathKnightHealingRestriction,
    markForestRootFireDamageHook,
    applyHellfireFuryHook,
    applyMidiWeaponBuffAttackAutomation,
    prepareMidiSteelWill,
    finishMidiSteelWill
  });

  Hooks.on("preCreateItem", (item, _data, options, userId) => {
    if (!enabled()) return true;
    if (validateCrusherPrerequisites(item, userId) === false) return false;
    if (validateLeaderPrerequisites(item, userId) === false) return false;
    if (validateDeathKnightPrerequisites(item, userId) === false) return false;
    if (validateHereticPrerequisites(item, userId) === false) return false;
    if (validateForestLordPrerequisites(item, userId) === false) return false;
    if (validateAberrantPrerequisites(item, userId) === false) return false;
    if (validateWitchBladePrerequisites(item, userId) === false) return false;
    if (validateJuggernautPrerequisites(item, userId) === false) return false;
    if (validateSoulEaterPrerequisites(item, userId) === false) return false;
    if (validateGuardianPrerequisites(item, userId) === false) return false;
    if (validateCrusaderPrerequisites(item, userId) === false) return false;
    if (validateFeyWarriorPrerequisites(item, userId) === false) return false;
    if (validateGhostWalkerPrerequisites(item, userId) === false) return false;
    if (validateBlinkerPrerequisites(item, userId) === false) return false;
    if (validateFallenPriestPrerequisites(item, userId) === false) return false;
    if (validatePlagueDoctorPrerequisites(item, userId) === false) return false;
    if (validateInsectLordPrerequisites(item, userId) === false) return false;
    if (validateGamblerPrerequisites(item, userId) === false) return false;
    if (validateKeeperPrerequisites(item, userId) === false) return false;
    if (validateBloodMagePrerequisites(item, userId) === false) return false;
    if (validateOnmyojiPrerequisites(item, userId) === false) return false;
    if (validateRitualistPrerequisites(item, userId) === false) return false;
    if (validateDarkWarriorPrerequisites(item, userId) === false) return false;
    if (validateDevilWorshipperPrerequisites(item, userId) === false) return false;
    if (validateNethereseArcanistPrerequisites(item, userId) === false) return false;
    if (validateSpiritVesselPrerequisites(item, userId) === false) return false;
    if (validateOraclePrerequisites(item, userId) === false) return false;
    if (validateDemonologistPrerequisites(item, userId) === false) return false;
    if (validateSanguinistPrerequisites(item, userId) === false) return false;
    if (validateKeeperSubclassPrerequisites(item, options, userId) === false) return false;
    if (validateSpiritVesselSubclassPrerequisites(item, options, userId) === false) return false;
    if (validateSchoolOfSteelPrerequisites(item, userId) === false) return false;
    if (validateTechniquePrerequisites(item, options, userId) === false) return false;
    if (validateLeaderFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateDeathKnightFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateHereticFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateForestLordFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateAberrantFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateWitchBladeFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateJuggernautFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateSoulEaterFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateGuardianFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateCrusaderFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateFeyWarriorFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateGhostWalkerFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateBlinkerFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateFallenPriestFeaturePrerequisites(item, options, userId) === false) return false;
    if (validatePlagueDoctorFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateInsectLordFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateGamblerFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateKeeperFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateBloodMageFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateOnmyojiFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateRitualistFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateDarkWarriorFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateDevilWorshipperFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateNethereseArcanistFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateSpiritVesselFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateOracleFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateDemonologistFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateSanguinistFeaturePrerequisites(item, options, userId) === false) return false;
    if (validateSchoolOfSteelFeaturePrerequisites(item, options, userId) === false) return false;
    prepareMassiveWeaponProficiency(item);
    return true;
  });
  Hooks.on("createItem", item => {
    const actor = item.parent;
    if (!actor) return;
    if (item.type === "class" && itemIdentifier(item) === "crusher") {
      if (isAutomationAuthority(actor)) void updateOwnedMassiveWeaponProficiency(actor);
    }
    scheduleSteelGiantSync(actor);
    scheduleMysticalPowerSync(actor);
    scheduleNatureMagicSync(actor);
    schedulePassiveSync(actor);
  });
  Hooks.on("updateItem", item => {
    scheduleSteelGiantSync(item.parent);
    scheduleMysticalPowerSync(item.parent);
    scheduleNatureMagicSync(item.parent);
    schedulePassiveSync(item.parent);
  });
  Hooks.on("deleteItem", item => {
    scheduleSteelGiantSync(item.parent);
    scheduleMysticalPowerSync(item.parent);
    scheduleNatureMagicSync(item.parent);
    schedulePassiveSync(item.parent);
  });
  Hooks.on("updateActor", actor => schedulePassiveSync(actor));
  Hooks.on("createToken", token => schedulePassiveSync(token.actor));
  Hooks.on("canvasReady", () => {
    for (const token of canvas?.scene?.tokens ?? []) schedulePassiveSync(token.actor);
  });
  Hooks.on("createActiveEffect", effect => scheduleSteelGiantSync(actorFromEffect(effect)));
  Hooks.on("updateActiveEffect", effect => scheduleSteelGiantSync(actorFromEffect(effect)));
  Hooks.on("deleteActiveEffect", effect => {
    scheduleSteelGiantSync(actorFromEffect(effect));
    void clearForestRootStateFromEffect(effect);
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round"))) return;
    if (!combat.started) return;
    const previousActor = combat.combatants?.get(combat.previous?.combatantId)?.actor
      ?? combat.turns?.[combat.previous?.turn]?.actor;
    const currentActor = combat.combatant?.actor;
    if (previousActor) {
      void endLeaderTurn(previousActor);
      void endForestTurn(previousActor, combat);
    }
    if (currentActor) {
      void beginLeaderTurn(currentActor);
      void beginForestTurn(currentActor, combat);
      void beginSpiritVesselTurn(currentActor);
      void beginDemonologistTurn(currentActor);
    }
  });
  Hooks.on("deleteCombat", combat => {
    if (!enabled()) return;
    for (const combatant of combat.combatants ?? []) {
      if (combatant.actor) {
        void clearLeaderCombatState(combatant.actor);
        void clearForestCombatState(combatant.actor);
        void clearSoulShard(combatant.actor);
      }
    }
  });
}

export function registerAutomation() {
  game.settings.register(MODULE_ID, SETTINGS.AUTOMATION, {
    name: "Автоматизация правил престиж-классов",
    hint: "Включает интеграцию всех престиж-классов Гриммуара с dnd5e, Midi-QOL и активными эффектами.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    restricted: true
  });
  game.settings.register(MODULE_ID, SETTINGS.STRICT_PREREQUISITES, {
    name: "Проверять требования престиж-классов",
    hint: "Если включено, модуль запрещает добавлять престиж-классы, их особенности, специализации и техники персонажам, которые не выполняют требования. По умолчанию выключено, чтобы Мастер мог сам решать допуск.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    restricted: true
  });
  installHooks();
}

export function exposeApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    summonRequestResult,
    setStyle,
    toggleStyle,
    toggleGreatWeaponMaster,
    armSteelWill,
    armGlimpseOfGenius,
    chooseOccultAbility,
    useOccultPoints,
    chooseForestBaseClass,
    rollForestUnarmedDamage,
    takeRoot,
    withdrawRoots,
    armDeadlyPrecision,
    useVigorousNature,
    activateCrusaderRage,
    condemnCrusaderTarget,
    useCrusaderConsecration,
    activateSpiritForm,
    summonUnfinishedBusinessSpirit,
    activateSidewaysShift,
    activateDiseaseForm,
    endSpiritForm,
    endDiseaseForm,
    activateSoulShard,
    useWitchBladeRage,
    useWitchBladeSealEvil,
    openImmaterialWhirlwind,
    useInnerBlink,
    useOuterBlink,
    rollPlagueSneakAttack,
    createSmartInfection,
    clearSmartInfections,
    drawAstralCard,
    useHeldAstralCard,
    discardHeldAstralCard,
    dealThem,
    rollRoguesAreLucky,
    storeSleevedCard,
    useSleevedCard,
    acesBeat,
    summonKeeperAlly,
    syncKeeperAllyPoints,
    rollKeeperAllyStrike,
    rollKeeperRestRecovery,
    rollKeeperMightDamage,
    summonInsectFamiliar,
    rollInsectTailSting,
    rollInsectBoneBlades,
    rollInsectBite,
    rollInsectBloodDrain,
    useCrawlingArmor,
    rollInsectSpew,
    summonInsectSwarm,
    detachCrawlingEye,
    returnCrawlingEye,
    applyBloodMagicCost,
    clearBloodMagicCosts,
    rollBloodMageSacrifice,
    syncOnmyojiResources,
    useOnmyojiKi,
    summonOnmyojiShikigami,
    summonRitualistSpirits,
    useRitualistRitualPoints,
    showRitualistSpiritDC,
    rollRitualistSpiritAgony,
    rollRitualistSpiritLife,
    rollRitualistSpiritProtection,
    rollRitualistSpiritSorrow,
    rollRitualistSpiritDestructionDie,
    showRitualistSpiritChannel,
    applyBlackMagicOil,
    drinkDarkWarriorElixir,
    chooseDevilWorshipperAbility,
    showDarkLuck,
    showEmpoweredCharms,
    summonDevilGlaive,
    summonImpFamiliar,
    rollDevilGlaiveDamage,
    rollDevilGlaiveGrappleDamage,
    gainDevilSoulAuraTempHp,
    showScholarArcanist,
    activateMiniMythal,
    activateDemonicVitality,
    teleportInMiniMythal,
    overloadMiniMythal,
    useAncientKnowledge,
    castNethereseGreatSpell,
    chooseSpiritVesselAbility,
    chooseSpiritVesselStrikeDamage,
    rollSpiritVesselConcentratedStrike,
    activateSpiritFlow,
    chooseSchoolSteelWeapons,
    syncSteelGiant,
    syncMysticalPower,
    syncNatureMagic,
    syncWitchBladeRage,
    syncGuardianResources,
    syncCrusaderResources,
    syncFeyWarriorResources,
    syncFallenPriestSpellcasting,
    syncGamblerResources,
    syncKeeperResources,
    syncRitualistResources,
    syncDarkWarriorResources,
    syncPlagueDoctorResources,
    syncInsectLordResources,
    syncInsectLordPassiveEffects,
    syncFeyWarriorPassiveEffects,
    syncGhostWalkerResources,
    syncGhostWalkerPassiveEffects,
    syncBlinkerResources,
    syncSpiritVesselResources,
    syncSpiritVesselPassiveEffects,
    syncOracleResources,
    syncOraclePassiveEffects,
    syncSanguinistResources,
    syncSchoolOfSteel,
    syncModulePassiveEffects,
    syncCrusherPassiveEffects,
    syncLeaderPassiveEffects,
    syncDeathKnightPassiveEffects,
    syncHereticPassiveEffects,
    syncAberrantPassiveEffects,
    syncForestPassiveEffects,
    syncMurderspawnPassiveEffects,
    syncHollowPassiveEffects,
    syncMurderspawnTransformation,
    syncHollowTransformation,
    gainHollowCharge,
    useHollowCharges,
    syncDarkGuard,
    syncSceneAuras,
    scheduleAuraSync,
    auraDefinitions,
    applySmithing,
    applyWeaponBuffAttackAutomation,
    applyWeaponBuffDamageAutomation
  };
}

export async function initializeOwnedActors() {
  exposeApi();
  if (!enabled()) return;
  for (const actor of automationActors()) {
    if (!actor.isOwner || !isAutomationAuthority(actor)) continue;
    try { await migrateOwnedItems(actor); }
    catch (error) { console.error(`${MODULE_ID} | Migration failed for ${actor.uuid}`, error); }
    await actorSynchronizer.synchronize(actor);
  }
  scheduleAuraSync();

  if (!game.modules.get("midi-qol")?.active) {
    notify("Для полной автоматизации престиж-классов включите Midi-QOL.", "warn");
  }
}
