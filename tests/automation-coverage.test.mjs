import assert from "node:assert/strict";
import { test } from "node:test";
import { access, readFile } from "node:fs/promises";
import { buildCoverageInventory } from "../tools/automation-coverage.mjs";

test("coverage inventories all authored cards and actual NPC embedded items, not stored ID strings", async () => {
  const inventory = await buildCoverageInventory();
  let expected = 0;
  for (const pack of ["classes", "subclasses", "transformations", "features", "equipment", "spells", "bestiary"]) {
    const { documents } = await import(`../src/packs/${pack}.mjs`);
    expected +=
      documents.length +
      documents.reduce((n, document) => n + (document._embeddedItems ?? document.items ?? []).length, 0);
  }
  assert.equal(inventory.records.length, expected);
  const ids = new Set();
  for (const record of inventory.records) {
    assert.ok(record.name && record.id && record.key, JSON.stringify(record));
    const id = `${record.pack}:${record.id}`;
    assert.equal(ids.has(id), false, id);
    ids.add(id);
    assert.ok(["automatic", "partial", "manual", "review"].includes(record.status));
    assert.ok(
      record.entries.every(entry => !entry.startsWith("MISSING:")),
      record.name
    );
    for (const check of record.checks) await access(new URL(`../${check}`, import.meta.url));
  }
  assert.deepEqual(
    JSON.parse(await readFile(new URL("../docs/AUTOMATION_COVERAGE.json", import.meta.url), "utf8")),
    inventory,
    "run npm run coverage after changing source cards or registrations"
  );
});

test("empty passive templates are retained only for the spell-source resistance service", async () => {
  const { documents } = await import("../src/packs/features.mjs");
  for (const item of documents)
    for (const effect of item.effects ?? []) {
      if ((effect.system?.changes ?? effect.changes ?? []).length || effect.statuses?.length) continue;
      assert.equal(
        item.system.identifier,
        "fortified-soul",
        `${item.name}: empty passive effect without a service role`
      );
    }
});
