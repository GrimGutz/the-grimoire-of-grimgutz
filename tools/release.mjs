// Build an installable release in dist/:
//   dist/module.json  — the manifest Foundry reads from the "latest" release URL
//   dist/module.zip   — module.json, one bundled script, styles, language files,
//                       compendiums built from src/ and only the assets they use
//
// The checkout itself is the development install: unbundled scripts, packs
// built locally by `npm run build`, every asset. The GitHub release workflow
// runs this after the full check; it can also run locally.
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, stat, writeFile, readdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import yazl from "yazl";
import { buildPacks, loadPacks } from "./build-packs.mjs";
import { allAssets, referencedAssets } from "./assets.mjs";
import { releaseManifest } from "./manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const stage = path.join(dist, "module");

const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (manifest.version !== pkg.version)
  throw new Error(`module.json ${manifest.version} and package.json ${pkg.version} versions differ`);
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : null;
if (tag && tag !== `v${manifest.version}`)
  throw new Error(`Tag ${tag} does not match module.json version v${manifest.version}`);

await rm(dist, { recursive: true, force: true });
await mkdir(stage, { recursive: true });

// One script file instead of ~275: every client downloads it on load.
const [entry] = manifest.esmodules;
await build({
  entryPoints: [path.join(root, entry)],
  outfile: path.join(stage, entry),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
  logLevel: "warning"
});

for (const directory of ["styles", "lang"])
  if (existsSync(path.join(root, directory)))
    await cp(path.join(root, directory), path.join(stage, directory), { recursive: true });
for (const file of ["README.md", "LICENSE", "CHANGELOG.md"])
  if (existsSync(path.join(root, file))) await cp(path.join(root, file), path.join(stage, file));

const loadedPacks = await loadPacks();
await buildPacks({ packsRoot: path.join(stage, "packs"), loadedPacks });

const { used, missing } = await referencedAssets(root, loadedPacks);
if (missing.length) throw new Error(`Referenced assets are missing:\n${missing.join("\n")}`);
for (const asset of used) {
  await mkdir(path.dirname(path.join(stage, asset)), { recursive: true });
  await cp(path.join(root, asset), path.join(stage, asset));
}
const everyAsset = await allAssets(root);

const released = releaseManifest(manifest);
await writeFile(path.join(stage, "module.json"), `${JSON.stringify(released, null, 2)}\n`);
await writeFile(path.join(dist, "module.json"), `${JSON.stringify(released, null, 2)}\n`);

async function stagedFiles(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...(await stagedFiles(full)));
    // LevelDB's LOCK is per-process state; Foundry recreates it.
    else if (item.name !== "LOCK") files.push(full);
  }
  return files;
}
const files = await stagedFiles(stage);
const zip = new yazl.ZipFile();
for (const file of files) zip.addFile(file, path.relative(stage, file).replaceAll("\\", "/"));
zip.end();
await new Promise((resolve, reject) => {
  zip.outputStream
    .pipe(createWriteStream(path.join(dist, "module.zip")))
    .on("close", resolve)
    .on("error", reject);
  zip.outputStream.on("error", reject);
});

const megabytes = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
console.log(`Release ${manifest.version}`);
console.log(`- script bundle: ${megabytes((await stat(path.join(stage, entry))).size)}`);
console.log(`- assets: ${used.length} of ${everyAsset.length} files shipped`);
console.log(`- archive: ${files.length} files, ${megabytes((await stat(path.join(dist, "module.zip"))).size)}`);
console.log(`- download: ${released.download}`);
