import { MODULE_ID } from "../shared/constants.mjs";

export const MIDI_QOL_HOOKS = [
  ["midi-qol.preAttackRollConfig", "applyMidiAttackDisadvantage"],
  ["midi-qol.preAttackRollConfig", "applyMidiWeaponBuffAttackAutomation"],
  ["midi-qol.DamageRollComplete", "applyPowerfulCleaving"],
  ["midi-qol.preTargetDamageApplication", "applyGiantKillerHook"],
  ["midi-qol.preTargetDamageApplication", "applyDeathKnightHealingRestriction"],
  ["midi-qol.preTargetDamageApplication", "markForestRootFireDamageHook"],
  ["midi-qol.preTargetDamageApplication", "applyHellfireFuryHook"],
  ["midi-qol.preTargetDamageApplication", "applySpellSourceResistance"],
  ["midi-qol.preTargetDamageApplication", "applySummonProtection"],
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
