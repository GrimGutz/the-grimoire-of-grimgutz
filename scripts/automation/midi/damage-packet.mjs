export function calculatedDamage(item) {
  const selector = item.damageSelector ?? "combinedDamage";
  return item.damageDetails?.[selector] ?? item.damageDetail ?? [];
}

/** Update the already-calculated packet; never run resistance calculation a second time. */
export function commitCalculatedDamage(token, item, parts) {
  const selector = item.damageSelector ?? "combinedDamage";
  item.damageDetails ??= {};
  item.damageDetails[selector] = parts;
  item.damageDetail = parts;
  let damage = 0,
    healing = 0,
    temporary = 0;
  for (const part of parts) {
    if (part.type === "temphp") temporary += Number(part.value ?? 0);
    else if (part.type === "healing") healing += Number(part.value ?? 0);
    else if (!["midi-none", "vitality", "maximum"].includes(part.type)) damage += Number(part.value ?? 0);
  }
  damage = Math.max(0, damage);
  const total = damage + healing;
  const rounded = total < 0 ? Math.ceil(total) : Math.floor(total);
  const hp = token.actor.system.attributes.hp;
  const oldHP = Number(hp.value ?? 0),
    oldTempHP = Number(hp.temp ?? 0);
  const absorbed = rounded > 0 ? Math.min(oldTempHP, rounded) : 0;
  const hpDamage = Math.min(oldHP, Math.max(-Number(hp.damage ?? Number(hp.max ?? oldHP) - oldHP), rounded - absorbed));
  Object.assign(item, {
    oldHP,
    oldTempHP,
    hpDamage,
    newHP: oldHP - hpDamage,
    newTempHP: Math.floor(Math.max(0, oldTempHP - absorbed, temporary)),
    totalDamage: damage,
    healingAdjustedTotalDamage: rounded
  });
  item.tempDamage = oldTempHP - item.newTempHP;
}
