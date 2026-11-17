// Foundry's LevelDB compendium layout.
//
// A document is stored under "!<collection>!<id>". Its embedded documents are
// not stored inline: the parent keeps their ids and each one is a record of its
// own in the sublevel named after the collection chain, keyed by the id chain:
//
//   !items!<item>                         effects: [<effect>, ...]
//   !items.effects!<item>.<effect>
//   !actors!<actor>                       items: [...], effects: [...]
//   !actors.items!<actor>.<item>          effects: [...]
//   !actors.items.effects!<actor>.<item>.<effect>
//   !actors.effects!<actor>.<effect>
//   !folders!<folder>
//
// Foundry ignores embedded objects written inline, so effects defined in
// src/packs never reached the compendiums before this layout was used.
import { ClassicLevel } from "classic-level";

// Embedded collections per document type, and where src/packs keeps them.
const EMBEDDED = {
  Actor: [
    ["items", document => document._embeddedItems ?? []],
    ["effects", document => document.effects ?? []]
  ],
  Item: [["effects", document => document.effects ?? []]]
};
const TYPE_OF = { items: "Item", effects: "ActiveEffect" };

function documentRecords(collection, documentName, document, parentIds = []) {
  const ids = [...parentIds, document._id];
  const { _embeddedItems, ...stored } = document;
  const records = [];
  for (const [field, children] of EMBEDDED[documentName] ?? []) {
    const embedded = children(document);
    stored[field] = embedded.map(child => child._id);
    for (const child of embedded)
      records.push(...documentRecords(`${collection}.${field}`, TYPE_OF[field], child, ids));
  }
  records.unshift({ key: `!${collection}!${ids.join(".")}`, value: stored });
  return records;
}

/** LevelDB put operations for a pack's folders and documents (documentType "Item" or "Actor"). */
export function packOperations({ documents, folders = [], documentType = "Item" }) {
  const collection = documentType === "Actor" ? "actors" : "items";
  return [
    ...folders.map(folder => ({ type: "put", key: `!folders!${folder._id}`, value: folder })),
    ...documents
      .flatMap(document => documentRecords(collection, documentType, document))
      .map(record => ({
        type: "put",
        ...record
      }))
  ];
}

/** Rebuild documents from stored records: embedded ids are replaced by their records, recursively. */
export function hydrateRecords(records, documentType = "Item") {
  const byKey = records instanceof Map ? records : new Map(records);
  const collection = documentType === "Actor" ? "actors" : "items";
  const hydrate = (collectionName, documentName, ids, value) => {
    const document = { ...value };
    for (const [field] of EMBEDDED[documentName] ?? []) {
      if (!Array.isArray(document[field])) continue;
      document[field] = document[field].map(child => {
        // Inline objects come from packs built before the sublevel layout.
        if (child && typeof child === "object") return child;
        const key = `!${collectionName}.${field}!${[...ids, child].join(".")}`;
        const stored = byKey.get(key);
        return stored ? hydrate(`${collectionName}.${field}`, TYPE_OF[field], [...ids, child], stored) : null;
      });
      document[field] = document[field].filter(Boolean);
    }
    return document;
  };
  const documents = [],
    folders = [];
  for (const [key, value] of byKey) {
    if (key.startsWith("!folders!")) folders.push(value);
    else if (key.startsWith(`!${collection}!`)) documents.push(hydrate(collection, documentType, [value._id], value));
  }
  return { documents, folders };
}

/** Every record of a LevelDB pack directory (open it on a copy: LevelDB may rewrite files on open). */
export async function readPackRecords(directory) {
  const db = new ClassicLevel(directory, { valueEncoding: "json", createIfMissing: false });
  try {
    await db.open();
    return new Map(await db.iterator().all());
  } finally {
    await db.close().catch(() => {});
  }
}
