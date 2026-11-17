// Localization: user-facing strings live in lang/<language>.json under the
// GRIMGUTZ namespace. t("Panel.Refresh") returns the current language's text,
// Foundry's English fallback, or — before i18n loads and in tests — the
// Russian source text, so the module never shows a raw key.
import ru from "../../../lang/ru.json" with { type: "json" };

const NAMESPACE = "GRIMGUTZ";

function flatten(object, prefix, into = {}) {
  for (const [key, value] of Object.entries(object))
    if (value && typeof value === "object") flatten(value, `${prefix}.${key}`, into);
    else into[`${prefix}.${key}`] = value;
  return into;
}
const SOURCE = flatten(ru[NAMESPACE], NAMESPACE);

const interpolate = (text, data) =>
  data ? String(text).replace(/\{(\w+)\}/g, (match, name) => (name in data ? String(data[name]) : match)) : text;

/** The localized string for `key` (relative to GRIMGUTZ), with {placeholders} filled from `data`. */
export function t(key, data) {
  const full = `${NAMESPACE}.${key}`;
  const i18n = globalThis.game?.i18n;
  if (i18n?.has?.(full)) return data ? i18n.format(full, data) : i18n.localize(full);
  return interpolate(SOURCE[full] ?? full, data);
}

/** The full key, for Foundry APIs that localize by themselves (setting names and hints). */
export const i18nKey = key => `${NAMESPACE}.${key}`;

/** Every key of the source language file, flattened (for tests). */
export const sourceKeys = () => Object.keys(SOURCE);
