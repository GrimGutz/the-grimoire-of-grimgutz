import { MODULE_ID } from "./constants.mjs";

function canonical(value) {
  if (value?.toObject) return canonical(value.toObject());
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Set) return [...value].sort();
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
    .filter(key => key !== "_stats" && typeof value[key] !== "function")
    .map(key => [key, canonical(value[key])]));
  return value;
}

// Change detection only, not a security signature. Avoid copying long rules into flags.
export function migrationFingerprint(value) {
  const text = JSON.stringify(canonical(value)) ?? "undefined";
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}

export function ownedItemMigrationPlan(item, source) {
  const current = item.toObject?.() ?? item, next = source.toObject?.() ?? source;
  const previous = current.flags?.[MODULE_ID]?.managedItemFields ?? {};
  const snapshots = { ...previous }, update = { _id: item.id }, conflicts = [];
  let effects = null;
  const advancements = data => (data.system?.advancement ?? []).map(({ value, ...definition }) => definition);
  const fields = {
    "system.description": [current.system?.description, next.system?.description],
    "system.activities": [current.system?.activities, next.system?.activities],
    effects: [current.effects ?? [], next.effects ?? []],
    "system.advancement": [advancements(current), advancements(next)]
  };
  for (const [field, [before, after]] of Object.entries(fields)) {
    const fingerprint = migrationFingerprint(before), desired = migrationFingerprint(after);
    if (fingerprint === desired) snapshots[field] = fingerprint;
    else if (field === "system.advancement") conflicts.push({ field, reason: "advancement-requires-review" });
    else if (previous[field] === fingerprint) {
      if (field === "effects") effects = after;
      else update[field] = after;
      snapshots[field] = desired;
    } else conflicts.push({ field, reason: previous[field] ? "manual-edit" : "legacy-without-snapshot" });
  }
  if (migrationFingerprint(previous) !== migrationFingerprint(snapshots)) update[`flags.${MODULE_ID}.managedItemFields`] = snapshots;
  // Add absent identification metadata, never replace the user's existing flag values.
  for (const [key, value] of Object.entries(next.flags?.[MODULE_ID] ?? {})) {
    if (key === "managedItemFields" || key === "automation" || key === "schemaVersion") continue;
    if (current.flags?.[MODULE_ID]?.[key] === undefined) update[`flags.${MODULE_ID}.${key}`] = value;
  }
  return { update: Object.keys(update).length > 1 ? update : null, effects, conflicts };
}
