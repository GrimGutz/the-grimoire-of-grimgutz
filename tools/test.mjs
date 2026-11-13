import { run } from "node:test";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Concise, explicit completion counts. Progress dots alone are not a result.
// An async per-test timeout cannot interrupt a CPU-bound isolated worker;
// retain the last reported event and abort stalled runs from the parent.
const directory = new URL("../tests/", import.meta.url),
  files = (await readdir(directory))
    .filter(name => name.endsWith(".test.mjs"))
    .sort()
    .map(name => fileURLToPath(new URL(name, directory)));
let summary,
  failures = 0,
  lastProgress = Date.now(),
  lastTest = "worker initialization";
const controller = new AbortController(),
  watchdog = setInterval(() => {
    if (Date.now() - lastProgress > 60000) {
      console.error(`Test worker stalled: ${lastTest}`);
      controller.abort();
    }
  }, 1000);
try {
  for await (const event of run({ files, concurrency: 1, timeout: 15000, signal: controller.signal })) {
    lastProgress = Date.now();
    if (event.data?.name) lastTest = event.data.name;
    if (event.type === "test:fail") {
      failures++;
      console.error(`FAIL: ${event.data.name}`);
      const error = event.data.details?.error;
      console.error(error?.cause ?? error ?? event.data);
    }
    if (event.type === "test:summary") summary = event.data;
  }
} finally {
  clearInterval(watchdog);
}
if (!summary || summary.counts.tests === 0) {
  console.error("Test runner ended without a nonempty final summary.");
  process.exitCode = 1;
} else {
  console.log("Tests:", JSON.stringify(summary));
  process.exitCode = summary.success && !failures ? 0 : 1;
}
