// Which files under assets/ the module actually uses.
//
// assets/ holds far more art than the compendiums reference (the WoW icon pack
// alone is ~4,300 files). The release ships only referenced files; the
// checkout keeps everything so existing worlds that point at other files keep
// working for the author.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const MODULE_ID = "the-grimoire-of-grimgutz";
const EXTENSIONS = "webp|png|jpe?g|svg|gif|webm|mp4|ogg|mp3|wav|m4a|woff2?|ttf|otf";
const ASSET_PATTERN = new RegExp(`(?:modules/${MODULE_ID}/)?(assets/[^"'\`<>()\\n]+?\\.(?:${EXTENSIONS}))`, "gi");

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Module-relative asset paths ("assets/...", decoded) mentioned anywhere in `text`. */
export function assetPathsIn(text) {
  return [...String(text).matchAll(ASSET_PATTERN)].map(match => decode(match[1]).replaceAll("\\", "/"));
}

function collectStrings(value, found, seen = new Set()) {
  if (typeof value === "string") {
    if (value.includes("assets/")) for (const asset of assetPathsIn(value)) found.add(asset);
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) collectStrings(child, found, seen);
}

async function textFiles(directory, extensions) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await textFiles(full, extensions)));
    else if (extensions.some(extension => entry.name.endsWith(extension))) files.push(full);
  }
  return files;
}

/**
 * Assets referenced by the compendium sources (`loadedPacks` from
 * build-packs.mjs), styles, scripts, language files and module.json.
 * Returns `{ used: string[], missing: string[] }`, sorted module-relative paths.
 */
export async function referencedAssets(root, loadedPacks) {
  const found = new Set();
  for (const pack of loadedPacks) collectStrings([pack.documents, pack.folders], found);
  const files = [
    path.join(root, "module.json"),
    ...(await textFiles(path.join(root, "styles"), [".css"])),
    ...(await textFiles(path.join(root, "scripts"), [".mjs", ".js"])),
    ...(await textFiles(path.join(root, "lang"), [".json"]))
  ];
  for (const file of files) for (const asset of assetPathsIn(await readFile(file, "utf8"))) found.add(asset);
  const all = [...found].sort();
  return {
    used: all.filter(asset => existsSync(path.join(root, asset))),
    missing: all.filter(asset => !existsSync(path.join(root, asset)))
  };
}

/** Every file under assets/, module-relative with forward slashes. */
export async function allAssets(root) {
  const directory = path.join(root, "assets");
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  }
  if (existsSync(directory)) await walk(directory);
  return files.sort();
}
