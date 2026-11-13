import { MODULE_ID } from "./constants.mjs";
export function leaderReceipt(actor, scene) {
  const record = actor.getFlag?.(MODULE_ID, "leaderStratagemReceived");
  if (!record) return null;
  if (record.combatId)
    return [...(game.combats ?? [])].some(
      combat => combat.started && combat.id === record.combatId && combat.scene?.id === scene?.id
    )
      ? record
      : null;
  return record.time != null && Number(game.time?.worldTime ?? 0) - record.time < 6 ? record : null;
}
export function leaderReceiptData(scene, commandId) {
  const combat = [...(game.combats ?? [])].find(combat => combat.started && combat.scene?.id === scene?.id);
  return {
    commandId,
    combatId: combat?.id ?? null,
    turn: combat ? `${combat.id}:${combat.round}:${combat.turn}` : null,
    time: Number(game.time?.worldTime ?? 0)
  };
}
