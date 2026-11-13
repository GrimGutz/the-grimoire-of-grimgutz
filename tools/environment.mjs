// Installed Foundry / system / module versions versus module.json compatibility.
// Core asset paths and dnd5e data paths change between builds, so a newer
// install than the verified one must be re-checked before raising `verified`.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** -1, 0 or 1 comparing dotted numeric versions ("14.369.0" vs "14.364"). */
export function compareVersions(a, b) {
  const left = String(a).split(".").map(Number),
    right = String(b).split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const x = left[index] || 0,
      y = right[index] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

const readJson = file => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);

/** Where Foundry and its user data live; override with FOUNDRY_APP_PATH / FOUNDRY_DATA_PATH. */
export function foundryPaths(moduleRoot, env = process.env) {
  const app = env.FOUNDRY_APP_PATH ?? "C:\\Program Files\\Foundry Virtual Tabletop\\resources\\app";
  const data = env.FOUNDRY_DATA_PATH ?? path.resolve(moduleRoot, "..", "..");
  return { app, public: path.join(app, "public"), data };
}

/** Installed versions: Foundry core, each related system, each related module. */
export function installedVersions(manifest, paths) {
  const core = readJson(path.join(paths.app, "package.json"))?.version ?? null;
  const systems = Object.fromEntries(
    (manifest.relationships?.systems ?? []).map(({ id }) => [
      id,
      readJson(path.join(paths.data, "systems", id, "system.json"))?.version ?? null
    ])
  );
  const related = [...(manifest.relationships?.requires ?? []), ...(manifest.relationships?.recommends ?? [])].filter(
    ({ type }) => (type ?? "module") === "module"
  );
  const manifests = Object.fromEntries(
    related.map(({ id }) => [id, readJson(path.join(paths.data, "modules", id, "module.json"))])
  );
  const modules = Object.fromEntries(related.map(({ id }) => [id, manifests[id]?.version ?? null]));
  // Each related module's own declared system support, e.g. Midi-QOL's dnd5e maximum.
  const moduleSystems = Object.fromEntries(related.map(({ id }) => [id, manifests[id]?.relationships?.systems ?? []]));
  return { core, systems, modules, moduleSystems };
}

function checkRange(label, installed, { minimum, verified, maximum } = {}, report, { requireVerified = false } = {}) {
  if (!installed) return;
  if (maximum && compareVersions(installed, maximum) > 0 && !String(installed).startsWith(`${maximum}.`))
    report.errors.push(`${label} ${installed} is above the declared maximum ${maximum}`);
  if (minimum && compareVersions(installed, minimum) < 0)
    report.warnings.push(`${label} ${installed} is below the declared minimum ${minimum}`);
  if (verified && compareVersions(installed, verified) > 0)
    report.warnings.push(
      `${label} ${installed} is newer than verified ${verified}: test in a world, then raise "verified" in module.json`
    );
  if (!verified && requireVerified)
    report.warnings.push(`${label} ${installed} is installed but module.json declares no verified ${label} version`);
}

/** Errors (out of declared range) and warnings (drift, unknown install) for this environment. */
export function compatibilityReport(manifest, installed) {
  const report = { errors: [], warnings: [] };
  if (!installed.core)
    report.warnings.push(
      "Foundry installation not found: core icon paths and version drift were not checked (set FOUNDRY_APP_PATH)"
    );
  checkRange("Foundry", installed.core, manifest.compatibility, report);
  for (const system of manifest.relationships?.systems ?? []) {
    const version = installed.systems[system.id];
    if (!version) report.warnings.push(`System ${system.id} not found: its data-path compatibility was not checked`);
    checkRange(system.id, version, system.compatibility, report, { requireVerified: true });
  }
  for (const module of [...(manifest.relationships?.requires ?? []), ...(manifest.relationships?.recommends ?? [])]) {
    const version = installed.modules[module.id];
    if (version && module.compatibility?.minimum && compareVersions(version, module.compatibility.minimum) < 0)
      report.warnings.push(`${module.id} ${version} is below the recommended minimum ${module.compatibility.minimum}`);
    // Foundry will not enable a module whose own system maximum is below the installed system.
    for (const system of installed.moduleSystems?.[module.id] ?? []) {
      const systemVersion = installed.systems[system.id],
        maximum = system.compatibility?.maximum;
      if (version && systemVersion && maximum && compareVersions(systemVersion, maximum) > 0)
        report.warnings.push(
          `${module.id} ${version} supports ${system.id} up to ${maximum}, but ${system.id} ${systemVersion} is installed: Foundry will not enable it, so automation that needs ${module.id} is off`
        );
    }
  }
  return report;
}
