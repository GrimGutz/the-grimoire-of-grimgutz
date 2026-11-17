import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { assetPathsIn } from "../tools/assets.mjs";
import { downloadUrl, manifestProblems, manifestUrl, releaseManifest } from "../tools/manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fakeFoundry() {
  const subscriptions = [];
  globalThis.Hooks = {
    on: (name, callback) => subscriptions.push(["on", name, callback]),
    once: (name, callback) => subscriptions.push(["once", name, callback]),
    callAll() {}
  };
  globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: base => base } } };
  globalThis.game = {
    modules: { get: () => ({ version: "test" }) },
    settings: { register() {}, registerMenu() {}, get() {} },
    socket: { on() {} },
    i18n: { localize: key => key, format: key => key, has: () => false }
  };
  return subscriptions;
}

async function registrations(entryUrl) {
  const subscriptions = fakeFoundry();
  await import(entryUrl);
  const init = subscriptions.find(([kind, name]) => kind === "once" && name === "init");
  assert.ok(init, "main registers an init hook");
  init[2]();
  return subscriptions.map(([kind, name]) => `${kind}:${name}`).sort();
}

test("the release bundle registers exactly the hooks the source modules register", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "grimgutz-bundle-"));
  try {
    const result = await build({
      entryPoints: [path.join(root, "scripts/main.mjs")],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
      logLevel: "silent"
    });
    const bundle = path.join(directory, "main.mjs");
    await writeFile(bundle, result.outputFiles[0].contents);
    const bundled = await registrations(pathToFileURL(bundle).href);
    const source = await registrations(pathToFileURL(path.join(root, "scripts/main.mjs")).href);
    assert.ok(source.length > 50);
    assert.deepEqual(bundled, source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("asset references are found in plain, encoded and module-prefixed form", () => {
  assert.deepEqual(
    assetPathsIn(
      'img="modules/the-grimoire-of-grimgutz/assets/icons/WoW%20Icon%20Pack/Spells/Blink.png" and assets/character arts/Leader.png'
    ),
    ["assets/icons/WoW Icon Pack/Spells/Blink.png", "assets/character arts/Leader.png"]
  );
  assert.deepEqual(assetPathsIn("icons/svg/mystery-man.svg"), []);
});

test("release links point at the latest manifest and this version's archive", () => {
  const url = "https://github.com/owner/repo";
  const manifest = releaseManifest({ id: "x", version: "1.2.3", url });
  assert.equal(manifest.manifest, `${url}/releases/latest/download/module.json`);
  assert.equal(manifest.download, `${url}/releases/download/v1.2.3/module.zip`);
  assert.deepEqual(manifestProblems(manifest), []);
  assert.equal(manifestProblems({ ...manifest, version: "1.2.4" }).length, 1, "stale download link");
  assert.equal(manifestProblems({ version: "1.2.3" }).length, 1, "no repository url");
  assert.equal(manifestUrl(url), manifest.manifest);
  assert.equal(downloadUrl(url, "9.0.0"), `${url}/releases/download/v9.0.0/module.zip`);
});
