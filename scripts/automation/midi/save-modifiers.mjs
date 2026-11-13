/** Midi 14 uses modifierTracker and hasAdvantage in multi-choice snapshots. */
export function addSaveAdvantage(details, key, label, abilities = null) {
  const eligible = id => !abilities || abilities.includes(id);
  const ids = details.rollAbilities ?? [];
  if (!abilities || (ids.length === 1 && eligible(ids[0]))) {
    details.advantage = true;
    details.modifierTracker?.advantage?.add?.(key, label);
    details.tracker?.advantage?.add?.(key, label);
  }
  for (const [id, choice] of Object.entries(details.advantageByChoice ?? {}))
    if (eligible(id)) {
      choice.hasAdvantage = true;
      choice.advantage = true;
      choice.tracker?.advantage?.add?.(key, label);
    }
}
