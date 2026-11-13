export const FLAGELLANT_ICON = "icons/skills/wounds/blood-spurt-spray-red.webp";
export const FLAGELLANT_FEATURES = [
  ["price", "Цена силы", 1],
  ["frenzy", "Исступление", 1],
  ["mortification", "Самобичевание", 1],
  ["onslaught", "Натиск", 1, 4],
  ["endurance", "Стойкость", 1, 4],
  ["surge", "Порыв", 1, 4],
  ["lesson", "Жестокий урок", 2],
  ["retribution", "Воздаяние", 2],
  ["flesh", "Закалённая плоть", 3],
  ["blood-gift", "Дар крови", 3],
  ["sacrifice", "Жертвенное увеличение", 4],
  ["force", "Через силу", 5],
  ["feast", "Пир страданий", 5]
].map(([id, name, level, depth = 3]) => ({ id, key: `flagellant-${id}`, name, level, depth }));
export const flagellantDie = level => [4, 6, 8, 10, 12][Math.max(0, Math.min(4, Number(level) - 1))];
export const flagellantMaximum = actor =>
  Math.max(
    1,
    Number(
      actor.system.attributes.hp.effectiveMax ??
        Number(actor.system.attributes.hp.max) + Number(actor.system.attributes.hp.tempmax ?? 0)
    )
  );
export function flagellantPain(actor) {
  const hp = Number(actor.system.attributes.hp.value),
    max = flagellantMaximum(actor);
  return { alive: hp > 0, taste: hp > 0 && hp < max / 2, thirst: hp > 0 && hp < max / 4, rapture: hp === 1 };
}
export function flagellantPricePlan(actor, amount) {
  if (!Number.isInteger(amount) || amount < 1) throw Error("Некорректная цена силы.");
  const hp = Number(actor.system.attributes.hp.value),
    pain = flagellantPain(actor);
  if (hp <= 0) return { ok: false, mode: "hp", lost: 0, amount };
  if (pain.rapture) return { ok: flagellantMaximum(actor) - amount >= 1, mode: "maximum", lost: 0, amount };
  const after = Math.max(0, hp - amount);
  return { ok: after > 0, mode: "hp", lost: hp - after, after, amount };
}
export const flagellantEnduranceBonus = (actor, values) =>
  flagellantPain(actor).thirst ? Math.max(...values) : Math.floor(values.reduce((a, b) => a + b, 0) / 2);
