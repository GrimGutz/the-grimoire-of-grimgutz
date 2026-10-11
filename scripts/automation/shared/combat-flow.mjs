export function isForwardTurn(combat, changes) {
  if (!combat?.started || (!Object.hasOwn(changes, "turn") && !Object.hasOwn(changes, "round"))) return false;
  const previous = combat.previous ?? {};
  const beforeRound = Number(previous.round ?? combat.round), beforeTurn = Number(previous.turn ?? -1);
  return combat.round > beforeRound || (combat.round === beforeRound && combat.turn > beforeTurn);
}
export function previousCombatActor(combat) {
  return combat?.combatants?.get?.(combat.previous?.combatantId)?.actor ?? combat?.turns?.[combat.previous?.turn]?.actor;
}

export function combatantToken(combat, combatant) {
  const scene = (combatant?.sceneId ? game.scenes?.get?.(combatant.sceneId) : null) ?? combat?.scene;
  return combatant?.token ?? scene?.tokens?.get?.(combatant?.tokenId)
    ?? [...(scene?.tokens ?? [])].find(token => token.id === combatant?.tokenId) ?? null;
}

export function combatTurnSnapshot(combat) {
  const previous = {...combat.previous};
  const prior = combat.combatants?.get?.(previous.combatantId) ?? combat.turns?.[previous.turn];
  const entry = (state, combatant) => {
    const token = combatantToken(combat, combatant);
    return {...state, combatantId: combatant?.id ?? state.combatantId, actor: token?.actor ?? combatant?.actor,
      token, tokenUuid: token?.uuid ?? null, tokenId: token?.id ?? combatant?.tokenId ?? state.tokenId,
      scene: token?.parent ?? (combatant?.sceneId ? game.scenes?.get?.(combatant.sceneId) : null) ?? combat.scene};
  };
  return {id: combat.id, current: entry({round: combat.round, turn: combat.turn}, combat.combatant), previous: entry(previous, prior)};
}

export function encounterForActor(actor) {
  if (!actor?.uuid) return null;
  const encounters = [...new Set([game.combat, ...(game.combats ?? [])].filter(Boolean))].filter(combat => combat.started
    && [...(combat.combatants ?? combat.turns ?? [])].some(c => (c.actor ?? combatantToken(combat, c)?.actor)?.uuid === actor?.uuid));
  // Do not guess between several simultaneous encounters involving this actor.
  return encounters.length === 1 ? encounters[0] : null;
}

export function encounterForScene(scene, token = null) {
  const encounters = [...new Set([game.combat, ...(game.combats ?? [])].filter(Boolean))];
  return encounters.find(combat => combat.started && (token
    ? [...(combat.combatants ?? combat.turns ?? [])].some(c => combatantToken(combat, c)?.uuid === token.uuid)
    : combat.scene?.id === scene?.id || [...(combat.combatants ?? combat.turns ?? [])].some(c => combatantToken(combat, c)?.parent?.id === scene?.id))) ?? null;
}
