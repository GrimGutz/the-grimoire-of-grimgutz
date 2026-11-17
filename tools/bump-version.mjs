// npm run bump -- 0.15.24
// Sets the version in module.json, package.json and package-lock.json and the
// matching release download link, so a tag v<version> can be released.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseManifest } from "./manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: npm run bump -- <major.minor.patch>");
  process.exit(1);
}

async function update(file, change) {
  const target = path.join(root, file);
  const data = JSON.parse(await readFile(target, "utf8"));
  await writeFile(target, `${JSON.stringify(change(data), null, 2)}\n`);
}

await update("module.json", manifest => releaseManifest({ ...manifest, version }));
await update("package.json", pkg => ({ ...pkg, version }));
await update("package-lock.json", lock => ({
  ...lock,
  version,
  packages: { ...lock.packages, "": { ...lock.packages?.[""], version } }
}));
console.log(`Version ${version}. Commit, then: git tag v${version} && git push origin v${version}`);
