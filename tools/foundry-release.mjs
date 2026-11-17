// List the release on foundryvtt.com through the Package Release API, so the
// version appears on the module's package page and in Foundry's module browser.
// https://foundryvtt.com/article/package-release-api/
//
// Needs the package registered on foundryvtt.com and its "Package Release Token"
// in FOUNDRY_RELEASE_TOKEN (GitHub: the repository secret of the same name).
// Without the token it does nothing, so the GitHub release still works alone.
//   node tools/foundry-release.mjs [--dry-run]
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_API = "https://foundryvtt.com/_api/packages/release_version/";

/** Request body for one version. The API wants that version's own manifest, never the "latest" link. */
export function releaseRequest(manifest, { dryRun = false } = {}) {
  const tag = `v${manifest.version}`;
  const { minimum, verified, maximum } = manifest.compatibility ?? {};
  return {
    id: manifest.id,
    ...(dryRun ? { "dry-run": true } : {}),
    release: {
      version: manifest.version,
      manifest: `${manifest.url}/releases/download/${tag}/module.json`,
      notes: `${manifest.url}/releases/tag/${tag}`,
      compatibility: { minimum: minimum ?? "", verified: verified ?? "", maximum: maximum ?? "" }
    }
  };
}

const errorText = body =>
  Object.entries(body?.errors ?? {})
    .flatMap(([field, list]) => [list].flat().map(error => `${field}: ${error?.message ?? JSON.stringify(error)}`))
    .join("\n") || JSON.stringify(body);

async function publish() {
  const token = process.env.FOUNDRY_RELEASE_TOKEN?.trim();
  if (!token) {
    console.log("FOUNDRY_RELEASE_TOKEN is not set: skipping the foundryvtt.com listing.");
    return;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
  const dryRun = process.argv.includes("--dry-run") || process.env.FOUNDRY_RELEASE_DRY_RUN === "true";
  const body = JSON.stringify(releaseRequest(manifest, { dryRun }));
  const send = () =>
    fetch(RELEASE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body
    });
  let response = await send();
  // One release per package per minute; wait once if a previous run was just accepted.
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after")) || 60;
    console.log(`Rate limited by foundryvtt.com, retrying in ${seconds} s.`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    response = await send();
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== "success")
    throw new Error(`foundryvtt.com rejected ${manifest.version} (HTTP ${response.status}):\n${errorText(result)}`);
  console.log(
    `${dryRun ? "Dry run passed" : "Listed"} ${manifest.id} ${manifest.version} on foundryvtt.com: ${result.page}`
  );
  if (result.message) console.log(result.message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await publish();
