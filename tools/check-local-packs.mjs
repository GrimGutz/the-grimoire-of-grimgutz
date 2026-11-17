// Before `npm run build` replaces packs/: report compendium records that differ
// from what src/packs would build — edits made inside Foundry to an unlocked
// compendium, which a rebuild would discard. packs/ is not tracked in git, so
// the comparison is against the sources, not a committed copy.
import { cp, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPacks } from "./build-packs.mjs";
import { hydrateRecords, packOperations, readPackRecords } from "./pack-records.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "grimgutz-pack-audit-"));

const IGNORED = new Set(["_stats", "_migration", "sort"]);
/**
 * Path of the first field the sources define that the live record changed, or
 * null. Foundry migrates compendium records when a world opens them (adds
 * defaults, turns "60" into 60), so fields only the live record has and
 * type-only changes are not edits; a changed value is.
 */
function firstDifference(built, live, at = "") {
  // A field the sources leave unset gets Foundry's default (e.g. the bag icon).
  if (built === undefined || built === null) return null;
  if (Array.isArray(built)) {
    if (!Array.isArray(live) || live.length !== built.length) return at || "(array)";
    for (const [index, entry] of built.entries()) {
      const difference = firstDifference(entry, live[index], `${at}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (built && typeof built === "object") {
    for (const [key, value] of Object.entries(built)) {
      if (IGNORED.has(key)) continue;
      const difference = firstDifference(value, live?.[key], at ? `${at}.${key}` : key);
      if (difference) return difference;
    }
    return null;
  }
  return String(built ?? "") === String(live ?? "") ? null : at;
}
const byId = ({ documents, folders }) => new Map([...documents, ...folders].map(record => [record._id, record]));

try {
  const differences = [];
  for (const pack of await loadPacks({ log: () => {} })) {
    const directory = path.join(root, "packs", pack.name);
    if (!existsSync(directory)) continue;
    // LevelDB may rewrite files on open: audit a disposable copy without the LOCK Foundry holds.
    const copy = path.join(temp, pack.name);
    await cp(directory, copy, { recursive: true, filter: source => path.basename(source) !== "LOCK" });
    const live = byId(hydrateRecords(await readPackRecords(copy), pack.documentType ?? "Item"));
    const built = byId(
      hydrateRecords(
        packOperations(pack).map(operation => [operation.key, operation.value]),
        pack.documentType ?? "Item"
      )
    );
    for (const id of new Set([...live.keys(), ...built.keys()])) {
      const field = !live.has(id)
        ? "(missing locally)"
        : !built.has(id)
          ? "(only local)"
          : firstDifference(built.get(id), live.get(id));
      if (field) differences.push({ pack: pack.name, id, name: live.get(id)?.name ?? built.get(id)?.name, field });
    }
  }
  if (differences.length) {
    console.error("Local compendium records differ from src/packs. Preserve these edits before rebuilding:");
    console.table(differences);
    process.exitCode = 1;
  } else console.log("Pack audit passed: local compendiums match what src/packs builds.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
