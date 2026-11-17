import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sourceKeys, t } from "../scripts/automation/shared/i18n.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Hard-coded Russian string literals left in scripts/. Move strings into
// lang/*.json with t() and lower this number; the test fails if it grows.
// Transformation definitions (*-definition.mjs) are compendium rules text
// built into the packs, not interface text, and are not counted.
const HARD_CODED_BASELINE = 3707;

const CYRILLIC_LITERAL = /(["'`])(?:\\.|(?!\1)[^\\\n])*[Ѐ-ӿ](?:\\.|(?!\1)[^\\\n])*\1/g;

async function scriptSources(directory = path.join(root, "scripts")) {
  const sources = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) sources.push(...(await scriptSources(full)));
    else if (entry.name.endsWith(".mjs")) sources.push([full, await readFile(full, "utf8")]);
  }
  return sources;
}

function flatKeys(object, prefix = "") {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === "object" ? flatKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}

test("every language file has exactly the keys of the Russian source", async () => {
  const ru = flatKeys(JSON.parse(await readFile(path.join(root, "lang/ru.json"), "utf8"))).sort();
  const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
  assert.ok(manifest.languages?.length >= 2);
  for (const language of manifest.languages) {
    const keys = flatKeys(JSON.parse(await readFile(path.join(root, language.path), "utf8"))).sort();
    assert.deepEqual(keys, ru, language.lang);
  }
});

test("every t() key used in scripts exists", async () => {
  const known = new Set(sourceKeys().map(key => key.replace(/^GRIMGUTZ\./, "")));
  const missing = [];
  for (const [file, source] of await scriptSources())
    for (const [, key] of source.matchAll(/\b(?:t|i18nKey)\("([^"]+)"/g))
      if (!known.has(key)) missing.push(`${path.relative(root, file)}: ${key}`);
  assert.deepEqual(missing, []);
});

test("t() fills placeholders and falls back to the source text without Foundry i18n", () => {
  delete globalThis.game;
  assert.equal(t("Panel.Seconds", { seconds: 6 }), "6 сек.");
  assert.equal(t("Unknown.Key"), "GRIMGUTZ.Unknown.Key");
  globalThis.game = {
    i18n: { has: key => key === "GRIMGUTZ.Panel.Refresh", localize: () => "Refresh", format: () => "" }
  };
  assert.equal(t("Panel.Refresh"), "Refresh");
  delete globalThis.game;
});

test("hard-coded Russian strings in scripts do not increase", async () => {
  let count = 0;
  for (const [file, source] of await scriptSources())
    if (!file.endsWith("-definition.mjs")) count += (source.match(CYRILLIC_LITERAL) ?? []).length;
  assert.ok(
    count <= HARD_CODED_BASELINE,
    `${count} hard-coded Russian strings (baseline ${HARD_CODED_BASELINE}): put new text in lang/*.json and use t()`
  );
});
