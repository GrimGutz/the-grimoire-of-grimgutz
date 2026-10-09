import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
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
    name: "subclasses",
    source: "../src/packs/subclasses.mjs"
  },
  {
    name: "features",
    source: "../src/packs/features.mjs"
  },
  {
    name: "transformations",
    source: "../src/packs/transformations.mjs"
  },
  {
    name: "spells",
    source: "../src/packs/spells.mjs"
  },
  {
    name: "equipment",
    source: "../src/packs/equipment.mjs"
  },
  {
    name: "bestiary",
    source: "../src/packs/bestiary.mjs",
    documentType: "Actor"
  }
];

function assertInsidePacks(target) {
  const relative = path.relative(packsRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify a path outside packs/: ${target}`);
  }
}

function embeddedRecords(document) {
  return document._embeddedItems ?? [];
}

function validateRecords({ name, documents, folders }) {
  const records = [
    ...documents,
    ...folders,
    ...documents.flatMap(embeddedRecords)
  ];
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

function documentCollection(pack) {
  return pack.documentType === "Actor" ? "actors" : "items";
}

function storedDocument(pack, document) {
  if (pack.documentType !== "Actor") return document;
  const { _embeddedItems, ...stored } = document;
  return {
    ...stored,
    items: (_embeddedItems ?? []).map(item => item._id)
  };
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

// Refuse the entire build before deleting anything if Foundry still holds a pack.
// Opening and closing may rotate LevelDB service logs, but does not change records.
for (const pack of loadedPacks) {
  const target = path.join(packsRoot, pack.name);
  assertInsidePacks(target);
  validateRecords(pack);
  if (!existsSync(target)) continue;
  const probe = new ClassicLevel(target, { valueEncoding: "json", createIfMissing: false });
  try { await probe.open(); }
  catch (error) { throw new Error(`Pack ${pack.name} is unavailable. Close the Foundry world before building. No packs were replaced.`, { cause: error }); }
  finally { await probe.close().catch(() => {}); }
}

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
      key: `!${documentCollection(pack)}!${document._id}`,
      value: storedDocument(pack, document)
    })),
    ...(pack.documentType === "Actor"
      ? documents.flatMap(document => (document._embeddedItems ?? []).map(item => ({
          type: "put",
          key: `!actors.items!${document._id}.${item._id}`,
          value: item
        })))
      : [])
  ];

  await db.batch(operations);
  await db.close();

  console.log(`Built ${pack.name}: ${documents.length} documents, ${folders.length} folders`);
}
