import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { linkDocumentDescriptions } from "./link-descriptions.mjs";
import { packOperations } from "./pack-records.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPacksRoot = path.join(root, "packs");

export const PACKS = [
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

function assertInside(packsRoot, target) {
  const relative = path.relative(packsRoot, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify a path outside ${packsRoot}: ${target}`);
  }
}

function embeddedRecords(document) {
  return document._embeddedItems ?? [];
}

function validateRecords({ name, documents, folders }) {
  const records = [...documents, ...folders, ...documents.flatMap(embeddedRecords)];
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

/** Every pack's documents and folders from `src/packs`, with description links resolved. */
export async function loadPacks({ log = console.log } = {}) {
  const loadedPacks = [];
  for (const pack of PACKS) {
    const source = await import(new URL(pack.source, import.meta.url));
    loadedPacks.push({
      ...pack,
      documents: source.documents ?? [],
      folders: source.folders ?? []
    });
  }
  const linksAdded = linkDocumentDescriptions(loadedPacks);
  log(`Linked descriptions: ${linksAdded} references`);
  for (const pack of loadedPacks) validateRecords(pack);
  return loadedPacks;
}

/**
 * Write `loadedPacks` as LevelDB compendiums under `packsRoot` (default: this
 * checkout's packs/, which the local Foundry install reads).
 */
export async function buildPacks({ packsRoot = defaultPacksRoot, loadedPacks, log = console.log } = {}) {
  loadedPacks ??= await loadPacks({ log });

  // Refuse the entire build before deleting anything if Foundry still holds a pack.
  // Opening and closing may rotate LevelDB service logs, but does not change records.
  for (const pack of loadedPacks) {
    const target = path.join(packsRoot, pack.name);
    assertInside(packsRoot, target);
    if (!existsSync(target)) continue;
    const probe = new ClassicLevel(target, { valueEncoding: "json", createIfMissing: false });
    try {
      await probe.open();
    } catch (error) {
      throw new Error(
        `Pack ${pack.name} is unavailable. Close the Foundry world before building. No packs were replaced.`,
        { cause: error }
      );
    } finally {
      await probe.close().catch(() => {});
    }
  }

  for (const pack of loadedPacks) {
    const target = path.join(packsRoot, pack.name);
    assertInside(packsRoot, target);

    const { documents, folders } = pack;
    const operations = packOperations(pack);
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

    await db.batch(operations);
    await db.close();

    log(`Built ${pack.name}: ${documents.length} documents, ${folders.length} folders`);
  }
  return loadedPacks;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPacks();
