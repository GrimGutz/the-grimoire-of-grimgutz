import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseRequest } from "../tools/foundry-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the foundryvtt.com release request points at this version's own manifest", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
  const request = releaseRequest(manifest);
  assert.equal(request.id, "the-grimoire-of-grimgutz");
  assert.equal(request["dry-run"], undefined);
  assert.equal(request.release.version, manifest.version);
  assert.equal(request.release.manifest, `${manifest.url}/releases/download/v${manifest.version}/module.json`);
  assert.doesNotMatch(request.release.manifest, /latest/);
  assert.equal(request.release.notes, `${manifest.url}/releases/tag/v${manifest.version}`);
  assert.equal(request.release.compatibility.minimum, manifest.compatibility.minimum);
  assert.equal(request.release.compatibility.verified, manifest.compatibility.verified);
});

test("a dry run is marked and missing compatibility fields are sent empty", () => {
  const request = releaseRequest(
    { id: "x", version: "1.2.3", url: "https://github.com/a/b", compatibility: { minimum: "14" } },
    { dryRun: true }
  );
  assert.equal(request["dry-run"], true);
  assert.deepEqual(request.release.compatibility, { minimum: "14", verified: "", maximum: "" });
});
