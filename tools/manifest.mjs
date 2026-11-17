// Install/update links in module.json.
//
// Foundry installs from `manifest` and, on update checks, re-reads it: it must
// point at the newest release's module.json. `download` is the archive of the
// version in that manifest. Both are GitHub release assets under `url`.

export const manifestUrl = repository => `${repository}/releases/latest/download/module.json`;
export const downloadUrl = (repository, version) => `${repository}/releases/download/v${version}/module.zip`;

/** module.json as published for its version: links derived from `url`. */
export function releaseManifest(manifest) {
  if (!manifest.url) throw new Error('module.json needs "url" (the GitHub repository) to build release links');
  return {
    ...manifest,
    manifest: manifestUrl(manifest.url),
    download: downloadUrl(manifest.url, manifest.version)
  };
}

/** Errors in module.json that would stop Foundry installing or updating the module. */
export function manifestProblems(manifest) {
  const problems = [];
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(manifest.url ?? ""))
    return ['module.json "url" must be the GitHub repository (https://github.com/<owner>/<repo>)'];
  if (manifest.manifest !== manifestUrl(manifest.url))
    problems.push(`module.json "manifest" must be ${manifestUrl(manifest.url)}`);
  if (manifest.download !== downloadUrl(manifest.url, manifest.version))
    problems.push(
      `module.json "download" must be ${downloadUrl(manifest.url, manifest.version)} (run npm run bump -- <version> to change versions)`
    );
  return problems;
}
