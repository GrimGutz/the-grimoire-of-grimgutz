export function isForwardTurn(combat, changes) {
  if (!combat?.started || (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round"))) return false;
  const previous = combat.previous ?? {};
  const beforeRound = Number(previous.round ?? combat.round), beforeTurn = Number(previous.turn ?? -1);
  return combat.round > beforeRound || (combat.round === beforeRound && combat.turn > beforeTurn);
}
export function previousCombatActor(combat) {
  return combat?.combatants?.get?.(combat.previous?.combatantId)?.actor ?? combat?.turns?.[combat.previous?.turn]?.actor;
}
