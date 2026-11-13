import { FLAGS, MODULE_ID, SETTINGS, STYLES } from "./shared/constants.mjs";
import {
  activityActor,
  actorFromEffect,
  automationAction,
  automationData,
  enabled,
  isAutomationAuthority,
  itemIdentifier,
  notify,
  reportFailure
} from "./shared/helpers.mjs";
import { clamp } from "./shared/dnd5e.mjs";
import { serialMutation } from "./shared/transactions.mjs";
import { automationActors, installTemporaryEffectHooks } from "./effects/temporary-effects.mjs";
import { createActorSynchronizer } from "./shared/actor-sync.mjs";
import { syncMaster, extendMasterCasting, validateMasterItem, validateMasterAdvancement } from "./classes/master.mjs";
import { controlMaster, installMasterHooks } from "./classes/master-combat.mjs";
import { syncHunter, validateHunterItem } from "./classes/bounty-hunter.mjs";
import { controlHunter, installHunterActionHooks } from "./classes/bounty-hunter-actions.mjs";
import { installHunterCombatHooks } from "./classes/bounty-hunter-combat.mjs";
import { installHunterZoneHooks } from "./classes/bounty-hunter-zones.mjs";
import { installHunterEventHooks } from "./classes/bounty-hunter-events.mjs";
import { validateHunterDisposable } from "./classes/bounty-hunter-capture.mjs";
import { syncJester, validateJesterItem } from "./classes/jester.mjs";
import { controlJester } from "./classes/jester-actions.mjs";
import { installJesterHooks } from "./classes/jester-events.mjs";
import { syncFlagellant, validateFlagellantItem } from "./classes/flagellant.mjs";
import { controlFlagellant } from "./classes/flagellant-actions.mjs";
import { installFlagellantHooks } from "./classes/flagellant-events.mjs";
import { syncDoomed, validateDoomedItem } from "./classes/doomed.mjs";
import { controlDoomed } from "./classes/doomed-actions.mjs";
import { installDoomedHooks } from "./classes/doomed-events.mjs";
import { syncNightmare, validateNightmareItem } from "./classes/nightmare.mjs";
import { controlNightmare } from "./classes/nightmare-actions.mjs";
import { controlNightmareSummon } from "./classes/nightmare-summons.mjs";
import { installNightmareHooks } from "./classes/nightmare-events.mjs";
import { syncEmpath, validateEmpathItem } from "./classes/empath.mjs";
import { controlEmpath } from "./classes/empath-actions.mjs";
import { installEmpathHooks } from "./classes/empath-events.mjs";
import { validateArkaneItem, validateArkaneAdvancement } from "./transformations/arkane.mjs";
import { controlArkane } from "./transformations/arkane-actions.mjs";
import { installArkaneHooks } from "./transformations/arkane-events.mjs";
import { validateAutomatonItem, validateAutomatonAdvancement } from "./transformations/automaton.mjs";
import { controlAutomaton } from "./transformations/automaton-actions.mjs";
import { installAutomatonHooks } from "./transformations/automaton-events.mjs";
import { validateBroodmotherItem, validateBroodmotherAdvancement } from "./transformations/broodmother.mjs";
import { controlBroodmother } from "./transformations/broodmother-actions.mjs";
import { installBroodmotherHooks } from "./transformations/broodmother-events.mjs";
import { applyBroodmotherToxicDamage } from "./transformations/broodmother-combat.mjs";
import { validateChimeraItem, validateChimeraAdvancement } from "./transformations/chimera.mjs";
import { controlChimera } from "./transformations/chimera-actions.mjs";
import { installChimeraHooks } from "./transformations/chimera-events.mjs";
import { applyChimeraDamagePacket } from "./transformations/chimera-spells.mjs";
import { validateDeathknightItem, validateDeathknightAdvancement } from "./transformations/deathknight.mjs";
import { controlDeathknight } from "./transformations/deathknight-actions.mjs";
import { controlDeathknightMinion } from "./transformations/deathknight-minions.mjs";
import { installDeathknightHooks } from "./transformations/deathknight-events.mjs";
import { applyDeathknightPacket } from "./transformations/deathknight-spells.mjs";
import { validateDullahanItem, validateDullahanAdvancement } from "./transformations/dullahan.mjs";
import { controlDullahan } from "./transformations/dullahan-actions.mjs";
import { installDullahanHooks } from "./transformations/dullahan-events.mjs";
import { applyDullahanPacket } from "./transformations/dullahan-combat.mjs";
import { controlFactory } from "./transformations/factory-actions.mjs";
import { controlFactoryHomunculus } from "./transformations/factory-homunculi.mjs";
import { installFactoryHooks } from "./transformations/factory-events.mjs";
import { validateFactoryItem, validateFactoryAdvancement } from "./transformations/factory.mjs";
import { applyFactoryDamage } from "./transformations/factory-damage.mjs";
import { applyFactoryDefense } from "./transformations/factory-defense.mjs";
import { controlGod } from "./transformations/god-actions.mjs";
import { installGodHooks } from "./transformations/god-events.mjs";
import { validateGodItem, validateGodAdvancement } from "./transformations/god.mjs";
import { applyGodElement, applyGodDefenses } from "./transformations/god-midi.mjs";
import { controlIllithid } from "./transformations/illithid-actions.mjs";
import { installIllithidHooks } from "./transformations/illithid-events.mjs";
import { validateIllithidItem, validateIllithidAdvancement } from "./transformations/illithid.mjs";
import { applyIllithidPacket } from "./transformations/illithid-midi.mjs";
import { useIllithidRefuge } from "./transformations/illithid-refuge.mjs";
import { controlHalfdragon } from "./transformations/halfdragon-actions.mjs";
import { installHalfdragonHooks } from "./transformations/halfdragon-events.mjs";
import { validateHalfdragonItem, validateHalfdragonAdvancement } from "./transformations/halfdragon.mjs";
import { applyHalfdragonBite } from "./transformations/halfdragon-combat.mjs";
import { controlHag } from "./transformations/hag-actions.mjs";
import { installHagHooks } from "./transformations/hag-events.mjs";
import { validateHagItem, validateHagAdvancement } from "./transformations/hag.mjs";
import { applyHagDamage, applyHagDefense } from "./transformations/hag-combat.mjs";
import { prepareAutomatonDamage, finishAutomatonCoils } from "./transformations/automaton-combat.mjs";
import { ownedItemMigrationPlan } from "./shared/owned-item-migration.mjs";
import { inspectAutomation as inspectActorAutomation } from "./shared/diagnostics.mjs";
import { registerAutomationPanel, openAutomationPanel } from "./shared/control-panel.mjs";
import { installZoneHooks } from "./shared/zones.mjs";
import { installPeriodicZoneHooks } from "./shared/periodic-zones.mjs";
import { resolvePendingAutomation } from "./shared/event-ledger.mjs";
import { installOwnerPromptHooks } from "./shared/owner-prompts.mjs";
import {
  installCombatBenefitHooks,
  prepareCombatAttackBenefits,
  commitCombatAttackBenefits
} from "./shared/combat-benefits.mjs";
import { installDamageEventHooks, prepareConfirmedDamage, finishDamageReservations } from "./shared/damage-events.mjs";
import { installLeaderStratagemHooks, useLeaderStratagem } from "./classes/leader-stratagems.mjs";
import {
  installLeaderEventHooks,
  prepareLeaderTargetSave,
  finishLeaderSaves,
  finishLeaderRoll
} from "./classes/leader-events.mjs";
import { installLeaderComfortHooks, prepareComfortHealing, finishComfortHealing } from "./classes/leader-comfort.mjs";
import {
  installLeaderPresenceHooks,
  chooseLeaderPresenceTargets,
  handleLeaderCritical,
  handleDistractingPresence,
  prepareLeaderHealing
} from "./classes/leader-presences.mjs";
import {
  installSanguinistCombatHooks,
  prepareBloodSpell,
  finishBloodSpell,
  handleBloodFailedSaves
} from "./classes/sanguinist-combat.mjs";
import {
  installInsectCombatHooks,
  handleInsectBiteHit,
  useInsectBloodDrain,
  endInsectBloodDrain
} from "./classes/insect-combat.mjs";
import {
  installDefenseHooks,
  handleGuardianWeaponHit,
  prepareArmorSave,
  finishDefenseReactions
} from "./classes/defensive-reactions.mjs";
import {
  installHollowCombatHooks,
  handleHollowWeaponHit,
  prepareHollowCast
} from "./transformations/hollow-combat.mjs";
import { installAreaActivityHooks, useAreaActivity } from "./shared/area-activities.mjs";
import { installWitchBladeHooks } from "./classes/witch-blade.mjs";
import { installRitualistZoneHooks } from "./classes/ritualist-zones.mjs";
import {
  installJuggernautRegenerationHooks,
  configureJuggernautRegeneration
} from "./classes/juggernaut-regeneration.mjs";
import { installRitualistSpiritHooks, chooseRitualistSpiritRecipients } from "./classes/ritualist-spirits.mjs";
import { applyWeaponBuffReach } from "./shared/weapon-buffs.mjs";
import { syncUniqueSummons, summonRequestResult } from "./shared/summons.mjs";
import { installSummonLifecycleHooks, manageSummons } from "./shared/summon-lifecycle.mjs";
import { dismissRitualistSpirits, regainRitualistSpirits } from "./classes/ritualist.mjs";
import { applySpellSourceResistance } from "./midi/spell-resistance.mjs";
import {
  applySummonProtection,
  handleSummonSelfCost,
  installSummonCombatHooks,
  useSummonProtection
} from "./shared/summon-combat.mjs";
import { installRepeatedSaveHooks } from "./effects/repeated-saves.mjs";
import { isForwardTurn, previousCombatActor } from "./shared/combat-flow.mjs";
import { TRANSFORMATION_ACTIONS } from "./transformations/index.mjs";
import { SCHOOL_OF_STEEL_ACTIONS } from "./subclasses/school-of-steel.mjs";
import { SPIRIT_VESSEL_ACTIONS } from "./classes/spirit-vessel.mjs";
import { ORACLE_ACTIONS } from "./classes/oracle.mjs";
import { DEMONOLOGIST_ACTIONS } from "./classes/demonologist.mjs";
import { SANGUINIST_ACTIONS } from "./classes/sanguinist.mjs";
import { deathKnightClass, deathKnightLevel, paladinLevel } from "./shared/selectors.mjs";
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
import { isLikelyModuleItem, moduleItemSources, syncModulePassiveEffects } from "./effects/module-passives.mjs";
import { installMidiQolHooks } from "./midi/hooks.mjs";
import { installSummonSocket } from "./shared/summons.mjs";
import { auraDefinitions, installAuraHooks, scheduleAuraSync, syncSceneAuras } from "./shared/auras.mjs";
import { chooseCarnageAuraType, handleAuraMeleeAttack } from "./shared/aura-events.mjs";
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

const COMMON_ACTIVITY_ACTIONS = new Map([
  ["choose-ritualist-spirit-targets", async actor => chooseRitualistSpiritRecipients(actor)],
  ["configure-juggernaut-regeneration", async actor => configureJuggernautRegeneration(actor)],
  [
    "choose-leader-presence-targets",
    async (actor, activity) =>
      chooseLeaderPresenceTargets(actor, automationData(activity).leaderPresenceKey ?? itemIdentifier(activity.item))
  ],
  ["choose-carnage-aura-type", async actor => chooseCarnageAuraType(actor)],
  ["toggle-gwm", async (actor, activity, context) => toggleGreatWeaponMaster(actor)],
  ["set-style-cleaving", async (actor, activity, context) => setStyle(actor, STYLES.CLEAVING)],
  ["set-style-crushing", async (actor, activity, context) => setStyle(actor, STYLES.CRUSHING)],
  ["toggle-style", async (actor, activity, context) => toggleStyle(actor)],
  ["arm-steel-will", async (actor, activity, context) => armSteelWill(actor)],
  ["sync-steel-giant", async (actor, activity, context) => syncSteelGiant(actor, { notifyResult: true })],
  ["smithing", async (actor, activity, context) => applySmithing(actor)],
  ["arm-glimpse-of-genius", async (actor, activity, context) => armGlimpseOfGenius(actor)],
  ["choose-occult-ability", async (actor, activity, context) => chooseOccultAbility(actor)],
  ["use-occult-points", async (actor, activity, context) => useOccultPoints(actor, activity)],
  ["choose-forest-base-class", async (actor, activity, context) => chooseForestBaseClass(actor)],
  ["forest-unarmed-damage", async (actor, activity, context) => rollForestUnarmedDamage(actor)],
  ["take-root", async (actor, activity, context) => takeRoot(actor)],
  ["withdraw-roots", async (actor, activity, context) => withdrawRoots(actor)],
  ["arm-deadly-precision", async (actor, activity, context) => armDeadlyPrecision(actor)],
  ["vigorous-nature", async (actor, activity, context) => useVigorousNature(actor)],
  ["activate-soul-shard", async (actor, activity, context) => activateSoulShard(actor)],
  ["use-witch-blade-rage", async (actor, activity, context) => useWitchBladeRage(actor, activity)],
  ["activate-witch-hunter-empower", async (actor, activity, context) => activateWitchHunterEmpower(actor, activity)],
  ["activate-witch-crystallization", async (actor, activity, context) => activateWitchCrystallization(actor)],
  ["activate-ethereal-storm", async (actor, activity, context) => activateEtherealStorm(actor, activity)],
  ["open-immaterial-whirlwind", async (actor, activity, context) => openImmaterialWhirlwind(actor, activity)],
  ["use-witch-blade-seal-evil", async (actor, activity, context) => useWitchBladeSealEvil(actor, activity)],
  ["activate-crusader-rage", async (actor, activity, context) => activateCrusaderRage(actor)],
  ["use-crusader-consecration", async (actor, activity, context) => useCrusaderConsecration(actor)],
  ["condemn-crusader-target", async (actor, activity, context) => condemnCrusaderTarget(actor)],
  ["activate-spirit-form", async (actor, activity, context) => activateSpiritForm(actor)],
  [
    "summon-ghost-walker-spirit",
    async (actor, activity, context) =>
      summonUnfinishedBusinessSpirit(actor, activity, { consumed: context.nativeSummonConsumption === true })
  ],
  ["end-spirit-form", async (actor, activity, context) => endSpiritForm(actor)],
  ["use-inner-blink", async (actor, activity, context) => useInnerBlink(actor)],
  ["use-outer-blink", async (actor, activity, context) => useOuterBlink(actor)],
  ["activate-sideways-shift", async (actor, activity, context) => activateSidewaysShift(actor)],
  [
    "sync-fallen-priest-spellcasting",
    async (actor, activity, context) => syncFallenPriestSpellcasting(actor, { notifyResult: true })
  ],
  ["roll-plague-sneak-attack", async (actor, activity, context) => rollPlagueSneakAttack(actor)],
  ["create-smart-infection", async (actor, activity, context) => createSmartInfection(actor, activity)],
  ["clear-smart-infections", async (actor, activity, context) => clearSmartInfections(actor)],
  ["activate-disease-form", async (actor, activity, context) => activateDiseaseForm(actor)],
  ["end-disease-form", async (actor, activity, context) => endDiseaseForm(actor)],
  ["draw-astral-card", async (actor, activity, context) => drawAstralCard(actor)],
  ["use-held-astral-card", async (actor, activity, context) => useHeldAstralCard(actor)],
  ["discard-held-astral-card", async (actor, activity, context) => discardHeldAstralCard(actor)],
  ["deal-them", async (actor, activity, context) => dealThem(actor)],
  ["rogues-are-lucky", async (actor, activity, context) => rollRoguesAreLucky(actor)],
  ["store-sleeved-card", async (actor, activity, context) => storeSleevedCard(actor)],
  ["use-sleeved-card", async (actor, activity, context) => useSleevedCard(actor)],
  ["aces-beat", async (actor, activity, context) => acesBeat(actor)],
  ["summon-keeper-ally", async (actor, activity, context) => summonKeeperAlly(actor, activity)],
  ["sync-keeper-ally-points", async (actor, activity, context) => syncKeeperAllyPoints(actor)],
  ["roll-keeper-ally-strike", async (actor, activity, context) => rollKeeperAllyStrike(actor)],
  ["roll-keeper-rest-recovery", async (actor, activity, context) => rollKeeperRestRecovery(actor)],
  ["roll-keeper-might-damage", async (actor, activity, context) => rollKeeperMightDamage(actor)],
  ["apply-blood-magic-cost", async (actor, activity, context) => applyBloodMagicCost(actor, activity)],
  ["roll-blood-mage-sacrifice", async (actor, activity, context) => rollBloodMageSacrifice(actor)],
  ["sync-onmyoji-resources", async (actor, activity, context) => syncOnmyojiResources(actor, { notifyResult: true })],
  ["summon-onmyoji-shikigami", async (actor, activity, context) => summonOnmyojiShikigami(actor)],
  ["use-onmyoji-ki", async (actor, activity, context) => useOnmyojiKi(actor, activity)],
  [
    "sync-ritualist-resources",
    async (actor, activity, context) => syncRitualistResources(actor, { notifyResult: true })
  ],
  ["summon-ritualist-spirits", async (actor, activity, context) => summonRitualistSpirits(actor, activity)],
  ["summon-spirit-protection", async (actor, activity, context) => useSummonProtection(actor)],
  ["dismiss-ritualist-spirits", async (actor, activity, context) => dismissRitualistSpirits(actor)],
  ["regain-ritualist-spirits", async (actor, activity, context) => regainRitualistSpirits(actor)],
  ["use-ritualist-ritual-points", async (actor, activity, context) => useRitualistRitualPoints(actor, activity)],
  ["show-ritualist-spirit-dc", async (actor, activity, context) => showRitualistSpiritDC(actor)],
  ["roll-ritualist-spirit-agony", async (actor, activity, context) => rollRitualistSpiritAgony(actor)],
  ["roll-ritualist-spirit-life", async (actor, activity, context) => rollRitualistSpiritLife(actor)],
  ["roll-ritualist-spirit-protection", async (actor, activity, context) => rollRitualistSpiritProtection(actor)],
  ["roll-ritualist-spirit-sorrow", async (actor, activity, context) => rollRitualistSpiritSorrow(actor)],
  [
    "roll-ritualist-spirit-destruction-die",
    async (actor, activity, context) => rollRitualistSpiritDestructionDie(actor)
  ],
  ["show-ritualist-spirit-channel", async (actor, activity, context) => showRitualistSpiritChannel(actor)],
  ["apply-black-magic-oil", async (actor, activity, context) => applyBlackMagicOil(actor)],
  ["drink-dark-warrior-elixir", async (actor, activity, context) => drinkDarkWarriorElixir(actor, activity)],
  [
    "sync-dark-warrior-resources",
    async (actor, activity, context) => syncDarkWarriorResources(actor, { notifyResult: true })
  ],
  ["choose-devil-worshipper-ability", async (actor, activity, context) => chooseDevilWorshipperAbility(actor)],
  ["show-dark-luck", async (actor, activity, context) => showDarkLuck(actor)],
  ["show-empowered-charms", async (actor, activity, context) => showEmpoweredCharms(actor)],
  ["summon-devil-glaive", async (actor, activity, context) => summonDevilGlaive(actor)],
  ["summon-devil-imp-familiar", async (actor, activity, context) => summonImpFamiliar(actor)],
  ["roll-devil-glaive-damage", async (actor, activity, context) => rollDevilGlaiveDamage(actor)],
  ["roll-devil-glaive-grapple-damage", async (actor, activity, context) => rollDevilGlaiveGrappleDamage(actor)],
  ["gain-devil-soul-aura-temp-hp", async (actor, activity, context) => gainDevilSoulAuraTempHp(actor, activity)],
  ["show-scholar-arcanist", async (actor, activity, context) => showScholarArcanist(actor)],
  ["activate-mini-mythal", async (actor, activity, context) => activateMiniMythal(actor)],
  ["teleport-in-mini-mythal", async (actor, activity, context) => teleportInMiniMythal(actor)],
  ["overload-mini-mythal", async (actor, activity, context) => overloadMiniMythal(actor)],
  ["use-ancient-knowledge", async (actor, activity, context) => useAncientKnowledge(actor)],
  ["cast-netherese-great-spell", async (actor, activity, context) => castNethereseGreatSpell(actor, activity)],
  ["roll-insect-tail-sting", async (actor, activity, context) => rollInsectTailSting(actor)],
  ["summon-insect-familiar", async (actor, activity, context) => summonInsectFamiliar(actor, activity)],
  ["roll-insect-bone-blades", async (actor, activity, context) => rollInsectBoneBlades(actor)],
  ["roll-insect-bite", async (actor, activity, context) => rollInsectBite(actor)],
  ["roll-insect-blood-drain", async (actor, activity, context) => rollInsectBloodDrain(actor)],
  ["use-crawling-armor", async (actor, activity, context) => useCrawlingArmor(actor)],
  ["roll-insect-spew", async (actor, activity, context) => rollInsectSpew(actor)],
  ["summon-insect-swarm", async (actor, activity, context) => summonInsectSwarm(actor)],
  ["detach-crawling-eye", async (actor, activity, context) => detachCrawlingEye(actor)],
  ["return-crawling-eye", async (actor, activity, context) => returnCrawlingEye(actor)]
]);

let actionHandlerRegistry;

/** Action id → handler. Static, so it is built once instead of on every activity use. */
export function getAutomationActionHandlers() {
  return (actionHandlerRegistry ??= buildAutomationActionHandlers());
}

function buildAutomationActionHandlers() {
  const registry = new Map(COMMON_ACTIVITY_ACTIONS);
  registry.set("master-control", controlMaster);
  registry.set("bounty-hunter-control", controlHunter);
  registry.set("jester-control", controlJester);
  registry.set("flagellant-control", controlFlagellant);
  registry.set("doomed-control", controlDoomed);
  registry.set("nightmare-control", controlNightmare);
  registry.set("empath-control", controlEmpath);
  registry.set("arkane-control", controlArkane);
  registry.set("automaton-control", controlAutomaton);
  registry.set("broodmother-control", controlBroodmother);
  registry.set("chimera-control", controlChimera);
  registry.set("deathknight-control", controlDeathknight);
  registry.set("dullahan-control", controlDullahan);
  registry.set("factory-control", controlFactory);
  registry.set("god-control", controlGod);
  registry.set("hag-control", controlHag);
  registry.set("halfdragon-control", controlHalfdragon);
  registry.set("illithid-control", controlIllithid);
  registry.set("factory-homunculus", controlFactoryHomunculus);
  registry.set("deathknight-minion", controlDeathknightMinion);
  registry.set("nightmare-summon-control", controlNightmareSummon);
  for (const [actions, handler] of [
    [TRANSFORMATION_ACTIONS, handleTransformationAction],
    [SCHOOL_OF_STEEL_ACTIONS, handleSchoolOfSteelAction],
    [SPIRIT_VESSEL_ACTIONS, handleSpiritVesselAction],
    [ORACLE_ACTIONS, handleOracleAction],
    [DEMONOLOGIST_ACTIONS, handleDemonologistAction],
    [SANGUINIST_ACTIONS, handleSanguinistAction]
  ])
    for (const action of actions) registry.set(action, (actor, activity) => handler(actor, activity, action));
  return registry;
}

async function handleActivityAction(activity, context = {}) {
  if (!enabled()) return;
  if (automationData(activity).areaResolved) return;
  const actor = activityActor(activity),
    action = actionFromActivity(activity);
  if (!actor || !action) return;
  const handler = getAutomationActionHandlers().get(action);
  if (!handler) throw new Error(`Unhandled module activity: ${action}`);
  return handler(actor, activity, context);
}

// Action families that share one use validator.
const WITCH_BLADE_RAGE_ACTIONS = new Set([
  "use-witch-blade-rage",
  "activate-witch-hunter-empower",
  "activate-ethereal-storm",
  "open-immaterial-whirlwind",
  "use-witch-blade-seal-evil"
]);
const DARK_WARRIOR_ACTIONS = new Set(["apply-black-magic-oil", "drink-dark-warrior-elixir"]);
const DEVIL_WORSHIPPER_ACTIONS = new Set([
  "choose-devil-worshipper-ability",
  "show-dark-luck",
  "show-empowered-charms",
  "summon-devil-imp-familiar",
  "summon-devil-glaive",
  "roll-devil-glaive-damage",
  "roll-devil-glaive-grapple-damage",
  "gain-devil-soul-aura-temp-hp"
]);
const NETHERESE_ARCANIST_ACTIONS = new Set([
  "show-scholar-arcanist",
  "activate-mini-mythal",
  "teleport-in-mini-mythal",
  "overload-mini-mythal",
  "use-ancient-knowledge",
  "cast-netherese-great-spell"
]);

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
  if (WITCH_BLADE_RAGE_ACTIONS.has(action)) return validateWitchBladeRageUse(actor, activity);
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
  if (action === "use-ritualist-ritual-points" || action === "summon-ritualist-spirits")
    return validateRitualistRitualPointUse(actor, activity);
  if (DARK_WARRIOR_ACTIONS.has(action)) return validateDarkWarriorActivityUse(actor, activity, action);
  if (DEVIL_WORSHIPPER_ACTIONS.has(action)) return validateDevilWorshipperActivityUse(actor, activity, action);
  if (NETHERESE_ARCANIST_ACTIONS.has(action)) return validateNethereseArcanistActivityUse(actor, activity, action);

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
  const options = damageItem.damageDetails?.calcDamageOptions?.[selector] ??
    damageItem.calcDamageOptions ?? { invertHealing: true, multiplier: 1 };
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
  const hpDamage = clamp(rounded - absorbed, -Number(hp.damage ?? 0), oldHP);

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
  const rawDamage = foundry.utils.deepClone(damageItem.damageDetails?.[rawKey] ?? damageItem.rawDamageDetail ?? []);
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
  const masterBonus = extendMasterCasting(actor, cls, _spellcasting);
  const identifier = itemIdentifier(cls);
  const rounding = count === 1 ? Math.ceil : Math.floor;

  if (identifier === "paladin" && deathKnightClass(actor)) {
    const effectivePaladinLevel = paladinLevel(actor) + deathKnightLevel(actor) + masterBonus;
    progression.spell += rounding(effectivePaladinLevel / 2);
    return false;
  }

  const fallenPriestProgression = applyFallenPriestSpellProgression(progression, actor, cls, masterBonus);
  if (fallenPriestProgression === false) return false;

  return applyForestLordSpellProgression(progression, actor, cls, count, masterBonus);
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

// Content modules that own their item/advancement validation (newer classes and
// transformations). Registered as separate hooks in this order.
const CONTENT_ITEM_VALIDATORS = [
  validateHunterItem,
  validateJesterItem,
  validateFlagellantItem,
  validateNightmareItem,
  validateBroodmotherItem,
  validateChimeraItem,
  validateDeathknightItem,
  validateIllithidItem,
  validateHalfdragonItem,
  validateHagItem,
  validateGodItem,
  validateFactoryItem,
  validateDullahanItem,
  validateAutomatonItem,
  validateArkaneItem,
  validateEmpathItem,
  validateDoomedItem,
  validateMasterItem
];
const CONTENT_ADVANCEMENT_VALIDATORS = [
  validateBroodmotherAdvancement,
  validateChimeraAdvancement,
  validateDeathknightAdvancement,
  validateIllithidAdvancement,
  validateHalfdragonAdvancement,
  validateHagAdvancement,
  validateGodAdvancement,
  validateFactoryAdvancement,
  validateDullahanAdvancement,
  validateAutomatonAdvancement,
  validateArkaneAdvancement,
  validateMasterAdvancement
];

/**
 * Optional (strict-mode) prerequisite gates evaluated by one preCreateItem hook,
 * all as `(item, options, userId)`. The first explicit `false` cancels creation.
 * Classes first, then subclasses, techniques and features — the historical order.
 */
function prerequisiteValidatorChain() {
  const byUser = validate => (item, _options, userId) => validate(item, userId);
  return [
    ...[
      validateCrusherPrerequisites,
      validateLeaderPrerequisites,
      validateDeathKnightPrerequisites,
      validateHereticPrerequisites,
      validateForestLordPrerequisites,
      validateAberrantPrerequisites,
      validateWitchBladePrerequisites,
      validateJuggernautPrerequisites,
      validateSoulEaterPrerequisites,
      validateGuardianPrerequisites,
      validateCrusaderPrerequisites,
      validateFeyWarriorPrerequisites,
      validateGhostWalkerPrerequisites,
      validateBlinkerPrerequisites,
      validateFallenPriestPrerequisites,
      validatePlagueDoctorPrerequisites,
      validateInsectLordPrerequisites,
      validateGamblerPrerequisites,
      validateKeeperPrerequisites,
      validateBloodMagePrerequisites,
      validateOnmyojiPrerequisites,
      validateRitualistPrerequisites,
      validateDarkWarriorPrerequisites,
      validateDevilWorshipperPrerequisites,
      validateNethereseArcanistPrerequisites,
      validateSpiritVesselPrerequisites,
      validateOraclePrerequisites,
      validateDemonologistPrerequisites,
      validateSanguinistPrerequisites
    ].map(byUser),
    validateKeeperSubclassPrerequisites,
    validateSpiritVesselSubclassPrerequisites,
    byUser(validateSchoolOfSteelPrerequisites),
    validateTechniquePrerequisites,
    validateLeaderFeaturePrerequisites,
    validateDeathKnightFeaturePrerequisites,
    validateHereticFeaturePrerequisites,
    validateForestLordFeaturePrerequisites,
    validateAberrantFeaturePrerequisites,
    validateWitchBladeFeaturePrerequisites,
    validateJuggernautFeaturePrerequisites,
    validateSoulEaterFeaturePrerequisites,
    validateGuardianFeaturePrerequisites,
    validateCrusaderFeaturePrerequisites,
    validateFeyWarriorFeaturePrerequisites,
    validateGhostWalkerFeaturePrerequisites,
    validateBlinkerFeaturePrerequisites,
    validateFallenPriestFeaturePrerequisites,
    validatePlagueDoctorFeaturePrerequisites,
    validateInsectLordFeaturePrerequisites,
    validateGamblerFeaturePrerequisites,
    validateKeeperFeaturePrerequisites,
    validateBloodMageFeaturePrerequisites,
    validateOnmyojiFeaturePrerequisites,
    validateRitualistFeaturePrerequisites,
    validateDarkWarriorFeaturePrerequisites,
    validateDevilWorshipperFeaturePrerequisites,
    validateNethereseArcanistFeaturePrerequisites,
    validateSpiritVesselFeaturePrerequisites,
    validateOracleFeaturePrerequisites,
    validateDemonologistFeaturePrerequisites,
    validateSanguinistFeaturePrerequisites,
    validateSchoolOfSteelFeaturePrerequisites
  ];
}

/**
 * Defer `task(actor)` until the triggering document operation settles, on the
 * automation authority only. Unlike the passive synchronizer these run even
 * with automation disabled, so they can restore original class data.
 */
function deferredAuthorityTask(task, label) {
  const report = reportFailure(`${label} sync failed`);
  return actor => {
    if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
    setTimeout(() => report(task(actor)), 50);
  };
}

const scheduleSteelGiantSync = deferredAuthorityTask(syncSteelGiant, "Steel Giant");
const scheduleMysticalPowerSync = deferredAuthorityTask(syncMysticalPower, "Mystical Power");
const scheduleNatureMagicSync = deferredAuthorityTask(syncNatureMagic, "Nature Magic");

const actorSynchronizer = createActorSynchronizer([
  syncCrusherPassiveEffects,
  syncLeaderPassiveEffects,
  syncDeathKnightPassiveEffects,
  syncHereticPassiveEffects,
  syncForestPassiveEffects,
  syncAberrantPassiveEffects,
  syncTransformationPassiveEffects,
  syncModulePassiveEffects,
  syncWitchBladeRage,
  updateOwnedMassiveWeaponProficiency,
  syncSteelGiant,
  syncMysticalPower,
  syncNatureMagic,
  syncGuardianResources,
  syncCrusaderResources,
  syncFeyWarriorResources,
  syncFallenPriestSpellcasting,
  syncGamblerResources,
  syncKeeperResources,
  syncOnmyojiResources,
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
  syncTransformations,
  syncDarkGuard,
  syncUniqueSummons,
  syncMaster,
  syncHunter,
  syncJester,
  syncFlagellant,
  syncDoomed,
  syncNightmare,
  syncEmpath
]);
const schedulePassiveSync = actorSynchronizer.schedule;

/** Everything an owned-item change can affect on its actor. */
function scheduleItemSyncs(actor) {
  scheduleSteelGiantSync(actor);
  scheduleMysticalPowerSync(actor);
  scheduleNatureMagicSync(actor);
  schedulePassiveSync(actor);
}

/**
 * Bring module items owned by `actor` up to date with the compendium.
 * Serialized per actor: one advancement fires createItem once per granted item,
 * and parallel runs would plan the same effect creations/deletions from the same
 * stale snapshot (duplicate-id creates, deletes of already deleted effects).
 */
export function migrateOwnedItems(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return Promise.resolve();
  return serialMutation(`owned-item-migration:${actor.uuid}`, () => migrateOwnedItemsNow(actor));
}

async function migrateOwnedItemsNow(actor) {
  const sources = await moduleItemSources();
  const updates = [],
    effectSyncs = [];
  for (const item of actor.items) {
    const source = sources.get(itemIdentifier(item));
    if (!source || !isLikelyModuleItem(item, source)) continue;
    const plan = ownedItemMigrationPlan(item, source);
    if (plan.update) updates.push(plan.update);
    if (plan.effects) effectSyncs.push({ item, effects: plan.effects });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  for (const { item, effects } of effectSyncs) {
    const desiredIds = new Set(effects.map(effect => effect._id));
    const deletes = [...(item.effects ?? [])].filter(effect => !desiredIds.has(effect.id)).map(effect => effect.id);
    const updates = effects.filter(effect => item.effects.get(effect._id));
    const creates = effects.filter(effect => !item.effects.get(effect._id));
    if (deletes.length) await item.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
    if (creates.length) await item.createEmbeddedDocuments("ActiveEffect", creates, { keepId: true });
  }
}
function installHooks() {
  installSummonSocket();
  installSummonLifecycleHooks();
  installSummonCombatHooks();
  installRepeatedSaveHooks();
  installPeriodicZoneHooks();
  installOwnerPromptHooks();
  installCombatBenefitHooks();
  installDamageEventHooks();
  installLeaderStratagemHooks();
  installLeaderEventHooks();
  installLeaderComfortHooks();
  installLeaderPresenceHooks();
  installSanguinistCombatHooks();
  installInsectCombatHooks();
  installDefenseHooks();
  installHollowCombatHooks();
  installAuraHooks();
  installZoneHooks();
  installAreaActivityHooks({ validate: validateActivityUse });
  installWitchBladeHooks();
  installMasterHooks();
  installHunterActionHooks();
  installHunterCombatHooks();
  installHunterZoneHooks();
  installHunterEventHooks();
  Hooks.on("dnd5e.preUseActivity", validateHunterDisposable);
  installJesterHooks();
  installFlagellantHooks();
  installDoomedHooks();
  installNightmareHooks();
  installEmpathHooks();
  installArkaneHooks();
  installAutomatonHooks();
  installBroodmotherHooks();
  installChimeraHooks();
  installDeathknightHooks();
  installDullahanHooks();
  installFactoryHooks();
  installGodHooks();
  installHagHooks();
  installHalfdragonHooks();
  installIllithidHooks();
  // Self-contained content validators. Order only decides which warning wins
  // when several reject the same document; it matches the historical order.
  for (const validate of CONTENT_ITEM_VALIDATORS) Hooks.on("preCreateItem", validate);
  for (const validate of CONTENT_ADVANCEMENT_VALIDATORS) Hooks.on("dnd5e.preAdvancementManagerComplete", validate);
  installRitualistZoneHooks();
  installJuggernautRegenerationHooks();
  installRitualistSpiritHooks();
  Hooks.on("midi-qol.preTargetingV2", ({ workflow }) => applyWeaponBuffReach(workflow?.activity));
  Hooks.on("dnd5e.preUseActivity", applyWeaponBuffReach);
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
    if (automationData(activity).areaResolved || automationData(activity).leaderResolved) return;
    const deltas = results?.message?.system?.deltas?.item?.[activity.item?.id] ?? [];
    const nativeSummonConsumption =
      !usageConfig?.[MODULE_ID]?.managedSummonResource &&
      deltas.some(delta => delta.keyPath === "system.uses.spent" && delta.delta > 0);
    void handleActivityAction(activity, { nativeSummonConsumption }).catch(error =>
      console.error(`${MODULE_ID} | Activity automation failed`, error)
    );
    void handleStratagemUse(activity).catch(error =>
      console.error(`${MODULE_ID} | Stratagem automation failed`, error)
    );
  });
  Hooks.on("dnd5e.preRollAttack", applyNativeAttackAutomation);
  Hooks.on("dnd5e.preRollDamage", applyDamageAutomation);
  Hooks.on("dnd5e.preRollSavingThrow", replaceDexteritySave);
  Hooks.on("dnd5e.computeLeveledProgression", applyMysticalPowerProgression);
  Hooks.on("dnd5e.computeSpellProgression", applyMysticalPowerProgression);
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    void restoreDefiledHeart(actor, result, { automationEnabled: enabled() }).catch(error =>
      console.error(`${MODULE_ID} | Defiled Heart recovery failed`, error)
    );
    void clearBloodMagicCosts(actor, result, { automationEnabled: enabled() }).catch(error =>
      console.error(`${MODULE_ID} | Blood Magic recovery failed`, error)
    );
    void clearSanguinistRestState(actor, result, { automationEnabled: enabled() }).catch(error =>
      console.error(`${MODULE_ID} | Sanguinist recovery failed`, error)
    );
  });
  Hooks.on("dnd5e.rollSavingThrow", (_rolls, { subject }) => {
    void clearPendingSteelWill(subject);
  });

  installMidiQolHooks(getMidiHookHandlers());

  const prerequisiteValidators = prerequisiteValidatorChain();
  Hooks.on("preCreateItem", (item, _data, options, userId) => {
    if (!enabled()) return true;
    if (prerequisiteValidators.some(validate => validate(item, options, userId) === false)) return false;
    prepareMassiveWeaponProficiency(item);
    return true;
  });
  const reportMigration = reportFailure("Imported item migration failed");
  const reportProficiency = reportFailure("Massive weapon proficiency update failed");
  Hooks.on("createItem", item => {
    const actor = item.parent;
    if (!actor) return;
    if (enabled()) reportMigration(migrateOwnedItems(actor));
    if (item.type === "class" && itemIdentifier(item) === "crusher") {
      if (isAutomationAuthority(actor)) reportProficiency(updateOwnedMassiveWeaponProficiency(actor));
    }
    scheduleItemSyncs(actor);
  });
  Hooks.on("updateItem", item => scheduleItemSyncs(item.parent));
  Hooks.on("deleteItem", item => scheduleItemSyncs(item.parent));
  Hooks.on("updateActor", actor => schedulePassiveSync(actor));
  Hooks.on("createToken", token => schedulePassiveSync(token.actor));
  Hooks.on("canvasReady", () => {
    for (const token of canvas?.scene?.tokens ?? []) schedulePassiveSync(token.actor);
  });
  Hooks.on("createActiveEffect", effect => scheduleSteelGiantSync(actorFromEffect(effect)));
  Hooks.on("updateActiveEffect", effect => scheduleSteelGiantSync(actorFromEffect(effect)));
  const reportCombat = reportFailure("Combat automation failed");
  Hooks.on("deleteActiveEffect", effect => {
    scheduleSteelGiantSync(actorFromEffect(effect));
    reportCombat(clearForestRootStateFromEffect(effect));
  });
  Hooks.on("updateCombat", (combat, changes) => {
    if (!enabled() || !isForwardTurn(combat, changes)) return;
    const previousActor = previousCombatActor(combat);
    const currentActor = combat.combatant?.actor;
    if (previousActor) {
      reportCombat(endLeaderTurn(previousActor));
      reportCombat(endForestTurn(previousActor, combat));
    }
    if (currentActor) {
      reportCombat(beginLeaderTurn(currentActor));
      reportCombat(beginForestTurn(currentActor, combat));
      reportCombat(beginSpiritVesselTurn(currentActor));
      reportCombat(beginDemonologistTurn(currentActor));
    }
  });
  Hooks.on("deleteCombat", combat => {
    if (!enabled()) return;
    for (const combatant of combat.combatants ?? []) {
      if (combatant.actor) {
        reportCombat(clearLeaderCombatState(combatant.actor));
        reportCombat(clearForestCombatState(combatant.actor));
        reportCombat(clearSoulShard(combatant.actor));
      }
    }
  });
}

export function getMidiHookHandlers() {
  return {
    prepareComfortHealing,
    finishComfortHealing,
    handleHollowWeaponHit,
    prepareHollowCast,
    handleGuardianWeaponHit,
    prepareArmorSave,
    finishDefenseReactions,
    handleInsectBiteHit,
    prepareBloodSpell,
    finishBloodSpell,
    handleBloodFailedSaves,
    prepareLeaderHealing,
    handleLeaderCritical,
    handleDistractingPresence,
    prepareLeaderTargetSave,
    finishLeaderSaves,
    finishLeaderRoll,
    prepareCombatAttackBenefits,
    commitCombatAttackBenefits,
    prepareConfirmedDamage,
    finishDamageReservations,
    applyFactoryDamage,
    applyFactoryDefense,
    applyGodElement,
    applyGodDefenses,
    applyHagDamage,
    applyHagDefense,
    applyHalfdragonBite,
    applyIllithidPacket,
    applyMidiAttackDisadvantage,
    applyPowerfulCleaving,
    applyGiantKillerHook,
    applyDeathKnightHealingRestriction,
    markForestRootFireDamageHook,
    applyHellfireFuryHook,
    applySpellSourceResistance,
    applyBroodmotherToxicDamage,
    applyChimeraDamagePacket,
    applyDeathknightPacket,
    applyDullahanPacket,
    prepareAutomatonDamage,
    finishAutomatonCoils,
    applySummonProtection,
    handleSummonSelfCost,
    handleAuraMeleeAttack,
    applyMidiWeaponBuffAttackAutomation,
    prepareMidiSteelWill,
    finishMidiSteelWill
  };
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
  registerAutomationPanel(getAutomationActionHandlers());
}

export function exposeApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    useAreaActivity,
    useIllithidRefuge,
    useLeaderStratagem,
    chooseLeaderPresenceTargets,
    useInsectBloodDrain,
    endInsectBloodDrain,
    inspectAutomation: actorOrUuid =>
      inspectActorAutomation(actorOrUuid, { actionHandlers: getAutomationActionHandlers() }),
    resolvePendingAutomation,
    openAutomationPanel,
    summonRequestResult,
    manageSummons,
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
    chooseCarnageAuraType,
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
    try {
      await migrateOwnedItems(actor);
    } catch (error) {
      console.error(`${MODULE_ID} | Migration failed for ${actor.uuid}`, error);
    }
    await actorSynchronizer.synchronize(actor);
  }
  scheduleAuraSync();

  if (!game.modules.get("midi-qol")?.active) {
    notify("Для полной автоматизации престиж-классов включите Midi-QOL.", "warn");
  }
}
