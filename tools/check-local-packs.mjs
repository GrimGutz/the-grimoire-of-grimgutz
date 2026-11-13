import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "grimgutz-pack-audit-"));
const temporaryRoot = path.resolve(os.tmpdir());
const relative = path.relative(temporaryRoot, path.resolve(temp));
if (relative.startsWith("..") || path.isAbsolute(relative) || !path.basename(temp).startsWith("grimgutz-pack-audit-"))
  throw Error("Unexpected audit directory; refusing cleanup.");
const packs = ["classes", "subclasses", "transformations", "features", "equipment", "spells", "bestiary"];
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(key => !["_stats", "_migration"].includes(key))
        .map(key => [key, normalize(value[key])])
    );
  return value;
}
async function records(directory) {
  const db = new ClassicLevel(directory, { valueEncoding: "json", createIfMissing: false, readOnly: true });
  try {
    await db.open();
    return new Map(await db.iterator().all());
  } finally {
    await db.close();
  }
}
try {
  const archive = path.join(temp, "head.tar");
  execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, "HEAD", "packs"], { cwd: root });
  execFileSync("tar", ["-xf", archive, "-C", temp]);
  // LevelDB can rotate/compact files on open despite a nominal readOnly option.
  // Audit a disposable copy, never the user's actual compendium directories.
  await cp(path.join(root, "packs"), path.join(temp, "live-packs"), { recursive: true });
  const differences = [];
  for (const pack of packs) {
    const head = await records(path.join(temp, "packs", pack)),
      live = await records(path.join(temp, "live-packs", pack));
    for (const key of new Set([...head.keys(), ...live.keys()])) {
      if (JSON.stringify(normalize(head.get(key))) !== JSON.stringify(normalize(live.get(key))))
        differences.push({ pack, key, name: live.get(key)?.name ?? head.get(key)?.name });
    }
  }
  if (differences.length) {
    console.error(
      "Local compendium content differs from Git HEAD. Review/preserve these records before rebuilding:",
      differences
    );
    process.exitCode = 1;
  } else
    console.log(
      "Pack audit passed: logical content matches Git HEAD; only database compaction/service metadata changed."
    );
} finally {
  // temp is mkdtemp-created and its resolved location was checked above.
  await rm(temp, { recursive: true, force: true });
}
