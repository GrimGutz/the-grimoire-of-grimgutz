export function abilityMod(actor, ability) {
  return Number(actor?.system?.abilities?.[ability]?.mod ?? 0);
}

export function baseAbilityValue(actor, ability) {
  return Number(actor?._source?.system?.abilities?.[ability]?.value ?? actor?.system?.abilities?.[ability]?.value ?? 0);
}

export function strengthValue(actor) {
  return Number(actor?.system?.abilities?.str?.value ?? 0);
}

export function sizeNumber(actor) {
  const size = actor?.system?.traits?.size;
  const configured = CONFIG.DND5E.actorSizes?.[size]?.numerical;
  if (Number.isFinite(configured)) return configured;
  return { tiny: 0, sm: 1, med: 2, lg: 3, huge: 4, grg: 5 }[size] ?? 2;
}

export function clamp(number, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, number));
}
