import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { linkDocumentDescriptions } from "./link-descriptions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packsRoot = path.join(root, "packs");

const packs = [
  {
    name: "classes",
    source: "../src/packs/classes.mjs"
  },
  {
    name: "features",
    source: "../src/packs/features.mjs"
  },
  {
    name: "spells",
    source: "../src/packs/spells.mjs"
  },
  {
    name: "equipment",
    source: "../src/packs/equipment.mjs"
  }
];

function assertInsidePacks(target) {
  const relative = path.relative(packsRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify a path outside packs/: ${target}`);
  }
}

function validateRecords({ name, documents, folders }) {
  const records = [...documents, ...folders];
  const ids = new Set();

  for (const record of records) {
    if (!/^[a-f0-9]{16}$/.test(record._id)) {
      throw new Error(`${name}: invalid Foundry ID ${record._id}`);
    }
    if (ids.has(record._id)) {
      throw new Error(`${name}: duplicate ID ${record._id}`);
    }
    ids.add(record._id);
  }
}

const loadedPacks = [];
for (const pack of packs) {
  const source = await import(new URL(pack.source, import.meta.url));
  loadedPacks.push({
    ...pack,
    documents: source.documents ?? [],
    folders: source.folders ?? []
  });
}

const linksAdded = linkDocumentDescriptions(loadedPacks);
console.log(`Linked descriptions: ${linksAdded} references`);

for (const pack of loadedPacks) {
  const target = path.join(packsRoot, pack.name);
  assertInsidePacks(target);

  const { documents, folders } = pack;
  validateRecords({
    name: pack.name,
    documents,
    folders
  });

  await rm(target, {
    recursive: true,
    force: true
  });
  await mkdir(target, {
    recursive: true
  });

  const db = new ClassicLevel(target, {
    valueEncoding: "json"
  });
  await db.open();

  const operations = [
    ...folders.map(folder => ({
      type: "put",
      key: `!folders!${folder._id}`,
      value: folder
    })),
    ...documents.map(document => ({
      type: "put",
      key: `!items!${document._id}`,
      value: document
    }))
  ];

  await db.batch(operations);
  await db.close();

  console.log(`Built ${pack.name}: ${documents.length} documents, ${folders.length} folders`);
}
