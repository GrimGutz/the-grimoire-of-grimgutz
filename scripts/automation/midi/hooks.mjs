import { MODULE_ID } from "../shared/constants.mjs";

export const MIDI_QOL_HOOKS = [
  ["midi-qol.preDamageRoll", "prepareComfortHealing"],
  ["midi-qol.DamageRollComplete", "finishComfortHealing"],
  ["midi-qol.preCleanup", "finishComfortHealing"],
  ["midi-qol.preCleanup", "finishDamageReservations"],
  ["midi-qol.preCleanup", "finishBloodSpell"],
  ["midi-qol.preCleanup", "finishDefenseReactions"],
  ["midi-qol.preCleanup", "finishLeaderRoll"],
  ["midi-qol.prePreambleComplete", "prepareBloodSpell"],
  ["midi-qol.RollComplete", "finishDamageReservations"],
  ["midi-qol.prePreambleComplete", "prepareHollowCast"],
  ["midi-qol.RollComplete", "handleHollowWeaponHit"],
  ["midi-qol.RollComplete", "handleGuardianWeaponHit"],
  ["midi-qol.preTargetSave", "prepareArmorSave"],
  ["midi-qol.postCheckSaves", "finishDefenseReactions"],
  ["midi-qol.RollComplete", "finishDefenseReactions"],
  ["midi-qol.RollComplete", "handleInsectBiteHit"],
  ["midi-qol.postCheckSaves", "handleBloodFailedSaves"],
  ["midi-qol.RollComplete", "finishBloodSpell"],
  ["midi-qol.preTargetDamageApplication", "prepareLeaderHealing"],
  ["midi-qol.RollComplete", "handleLeaderCritical"],
  ["midi-qol.RollComplete", "handleDistractingPresence"],
  ["midi-qol.preTargetSave", "prepareLeaderTargetSave"],
  ["midi-qol.postCheckSaves", "finishLeaderSaves"],
  ["midi-qol.RollComplete", "finishLeaderRoll"],
  ["midi-qol.preAttackRollConfig", "prepareCombatAttackBenefits"],
  ["midi-qol.AttackRollComplete", "commitCombatAttackBenefits"],
  // Restore Toxicologist's formerly immune poison before correlating a damage
  // receipt. Recheck after generic bonuses may have rebuilt the raw packet.
  ["midi-qol.preTargetDamageApplication", "applyBroodmotherToxicDamage"],
  ["midi-qol.preTargetDamageApplication", "applyChimeraDamagePacket"],
  ["midi-qol.preTargetDamageApplication", "applyDeathknightPacket"],
  ["midi-qol.preTargetDamageApplication", "applyDullahanPacket"],
  ["midi-qol.preTargetDamageApplication", "applyFactoryDamage"],
  ["midi-qol.preTargetDamageApplication", "applyHalfdragonBite"],
  ["midi-qol.preTargetDamageApplication", "applyGodElement"],
  ["midi-qol.preTargetDamageApplication", "applyIllithidPacket"],
  ["midi-qol.preTargetDamageApplication", "prepareConfirmedDamage"],
  ["midi-qol.AttackRollComplete", "handleAuraMeleeAttack"],
  ["midi-qol.preAttackRollConfig", "applyMidiAttackDisadvantage"],
  ["midi-qol.preAttackRollConfig", "applyMidiWeaponBuffAttackAutomation"],
  ["midi-qol.DamageRollComplete", "applyPowerfulCleaving"],
  ["midi-qol.preTargetDamageApplication", "applyGiantKillerHook"],
  ["midi-qol.preTargetDamageApplication", "applyDeathKnightHealingRestriction"],
  ["midi-qol.preTargetDamageApplication", "markForestRootFireDamageHook"],
  ["midi-qol.preTargetDamageApplication", "applyHellfireFuryHook"],
  ["midi-qol.preTargetDamageApplication", "applyBroodmotherToxicDamage"],
  ["midi-qol.preTargetDamageApplication", "applyChimeraDamagePacket"],
  ["midi-qol.preTargetDamageApplication", "applyDeathknightPacket"],
  ["midi-qol.preTargetDamageApplication", "applyDullahanPacket"],
  ["midi-qol.preTargetDamageApplication", "applyGodElement"],
  ["midi-qol.preTargetDamageApplication", "applyHagDamage"],
  ["midi-qol.preTargetDamageApplication", "applyIllithidPacket"],
  ["midi-qol.preTargetDamageApplication", "applyHalfdragonBite"],
  ["midi-qol.preTargetDamageApplication", "applySpellSourceResistance"],
  ["midi-qol.preTargetDamageApplication", "applyHagDefense"],
  ["midi-qol.preTargetDamageApplication", "applySummonProtection"],
  ["midi-qol.preTargetDamageApplication", "prepareAutomatonDamage"],
  ["midi-qol.preTargetDamageApplication", "applyFactoryDefense"],
  ["midi-qol.preTargetDamageApplication", "applyGodDefenses"],
  ["midi-qol.preCleanup", "finishAutomatonCoils"],
  ["midi-qol.RollComplete", "handleSummonSelfCost"],
  ["midi-qol.preCheckSaves", "prepareMidiSteelWill"],
  ["midi-qol.postCheckSaves", "finishMidiSteelWill"]
];

export function installMidiQolHooks(handlers) {
  for (const [hook, handlerName] of MIDI_QOL_HOOKS) {
    const handler = handlers?.[handlerName];
    if (typeof handler !== "function") {
      console.warn(`${MODULE_ID} | Midi-QOL hook handler is missing: ${handlerName}`);
      continue;
    }
    Hooks.on(hook, handler);
  }
}
