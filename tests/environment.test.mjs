import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersions, compatibilityReport, foundryPaths } from "../tools/environment.mjs";

const manifest = {
  compatibility: { minimum: "14", verified: "14.364", maximum: "14.999" },
  relationships: {
    systems: [{ id: "dnd5e", compatibility: { minimum: "5.3.3" } }],
    recommends: [{ id: "midi-qol", type: "module", compatibility: { minimum: "14.0.9" } }]
  }
};

test("versions compare numerically", () => {
  assert.equal(compareVersions("14.369.0", "14.364"), 1);
  assert.equal(compareVersions("14.364", "14.364.0"), 0);
  assert.equal(compareVersions("5.3.3", "6.0"), -1);
});

test("drift beyond verified versions is a warning, not an error", () => {
  const report = compatibilityReport(manifest, {
    core: "14.369.0",
    systems: { dnd5e: "6.0.6" },
    modules: { "midi-qol": "14.0.12" }
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.warnings.length, 2);
  assert.match(report.warnings[0], /Foundry 14\.369\.0 is newer than verified 14\.364/);
  assert.match(report.warnings[1], /no verified dnd5e version/);
});

test("installs outside the declared range and missing installs are reported", () => {
  const report = compatibilityReport(manifest, {
    core: "15.300",
    systems: { dnd5e: null },
    modules: { "midi-qol": "13.0.1" }
  });
  assert.match(report.errors[0], /above the declared maximum/);
  assert.ok(report.warnings.some(warning => /System dnd5e not found/.test(warning)));
  assert.ok(report.warnings.some(warning => /midi-qol 13\.0\.1 is below/.test(warning)));
  assert.match(compatibilityReport(manifest, { core: null, systems: {}, modules: {} }).warnings[0], /not found/);
});

test("a maximum given as a major version admits every build of it", () => {
  const report = compatibilityReport(
    { compatibility: { maximum: "14" } },
    { core: "14.369", systems: {}, modules: {} }
  );
  assert.deepEqual(report.errors, []);
});

test("paths can be overridden for other machines", () => {
  const paths = foundryPaths("/data/modules/x", { FOUNDRY_APP_PATH: "/opt/foundry", FOUNDRY_DATA_PATH: "/data" });
  assert.equal(paths.data, "/data");
  assert.match(paths.public, /opt.foundry.public$/);
});
