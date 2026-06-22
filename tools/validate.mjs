import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const errors = [];

if (manifest.id !== "the-grimoire-of-grimgutz") {
  errors.push(`Unexpected module ID: ${manifest.id}`);
}

for (const relativePath of [...(manifest.esmodules ?? []), ...(manifest.styles ?? [])]) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    errors.push(`Missing declared asset: ${relativePath}`);
  }
}

const documentCounts = {};
const allDocuments = new Map();
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "grimgutz-validation-"));

try {
  for (const pack of manifest.packs) {
    const sourcePackPath = path.join(root, pack.path);
    const packPath = path.join(temporaryRoot, pack.name);
    await cp(sourcePackPath, packPath, {
      recursive: true
    });

    const db = new ClassicLevel(packPath, {
      valueEncoding: "json"
    });

    try {
      await db.open();
      let count = 0;
      for await (const [key, value] of db.iterator()) {
        if (!key.startsWith("!items!")) continue;
        count += 1;
        allDocuments.set(value._id, {
          pack: pack.name,
          document: value
        });
      }
      documentCounts[pack.name] = count;
    } catch (error) {
      errors.push(`Cannot read pack ${pack.name}: ${error.message}`);
    } finally {
      await db.close().catch(() => {});
    }
  }
} finally {
  await rm(temporaryRoot, {
    recursive: true,
    force: true
  });
}

if (documentCounts.classes !== 1) errors.push(`Expected 1 class, got ${documentCounts.classes ?? 0}`);
if (documentCounts.features !== 15) errors.push(`Expected 15 features, got ${documentCounts.features ?? 0}`);
if (documentCounts.equipment !== 5) errors.push(`Expected 5 weapons, got ${documentCounts.equipment ?? 0}`);

const classEntry = [...allDocuments.values()].find(entry => entry.document.type === "class");
if (!classEntry) {
  errors.push("Crusher class document is missing");
} else {
  const classDocument = classEntry.document;
  if (classDocument.system.hitDice !== "d12") errors.push("Crusher class must use d12 hit dice");

  const featureIds = new Set(
    [...allDocuments.values()]
      .filter(entry => entry.pack === "features")
      .map(entry => entry.document._id)
  );

  for (const advancement of classDocument.system.advancement) {
    const uuids = [
      ...(advancement.configuration?.items ?? []).map(item => item.uuid),
      ...(advancement.configuration?.pool ?? []).map(item => item.uuid)
    ];
    for (const uuid of uuids) {
      const id = uuid.split(".").at(-1);
      if (!featureIds.has(id)) errors.push(`Broken feature UUID: ${uuid}`);
    }
  }
}

if (errors.length) {
  console.error("Validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Validation passed", documentCounts);
}
