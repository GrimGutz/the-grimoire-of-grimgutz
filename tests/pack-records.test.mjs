import assert from "node:assert/strict";
import { test } from "node:test";
import { hydrateRecords, packOperations } from "../tools/pack-records.mjs";

const effect = id => ({
  _id: id,
  name: `Effect ${id}`,
  changes: [{ key: "system.traits.ci.value", value: "charmed" }]
});

test("item effects are stored as their own records and the item keeps only their ids", () => {
  const operations = packOperations({
    documents: [{ _id: "item1", name: "Feature", effects: [effect("fx1"), effect("fx2")] }]
  });
  const records = new Map(operations.map(operation => [operation.key, operation.value]));
  assert.deepEqual(records.get("!items!item1").effects, ["fx1", "fx2"]);
  assert.equal(records.get("!items.effects!item1.fx1").name, "Effect fx1");
  assert.equal(records.get("!items.effects!item1.fx2").name, "Effect fx2");
});

test("actor items and their effects use the actors.items and actors.items.effects sublevels", () => {
  const operations = packOperations({
    documentType: "Actor",
    documents: [
      {
        _id: "actor1",
        name: "Monster",
        effects: [effect("afx")],
        _embeddedItems: [{ _id: "item1", name: "Bite", effects: [effect("ifx")] }]
      }
    ]
  });
  const keys = operations.map(operation => operation.key).sort();
  assert.deepEqual(keys, [
    "!actors!actor1",
    "!actors.effects!actor1.afx",
    "!actors.items!actor1.item1",
    "!actors.items.effects!actor1.item1.ifx"
  ]);
  const actor = operations.find(operation => operation.key === "!actors!actor1").value;
  assert.deepEqual(actor.items, ["item1"]);
  assert.equal(actor._embeddedItems, undefined);
});

test("hydrating stored records gives back the source documents", () => {
  const source = {
    _id: "actor1",
    name: "Monster",
    effects: [effect("afx")],
    _embeddedItems: [{ _id: "item1", name: "Bite", effects: [effect("ifx")] }]
  };
  const operations = packOperations({ documentType: "Actor", documents: [source], folders: [{ _id: "f1" }] });
  const { documents, folders } = hydrateRecords(
    operations.map(operation => [operation.key, operation.value]),
    "Actor"
  );
  assert.equal(folders.length, 1);
  assert.equal(documents[0].effects[0].name, "Effect afx");
  assert.equal(documents[0].items[0].name, "Bite");
  assert.equal(documents[0].items[0].effects[0].name, "Effect ifx");
});
