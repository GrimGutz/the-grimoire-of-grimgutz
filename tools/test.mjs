import {run} from "node:test";
import {readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";

// Consume the structured stream instead of the Windows Node 26 CLI reporter:
// a row of progress dots is not proof that the runner actually completed.
const directory=new URL("../tests/",import.meta.url),files=(await readdir(directory)).filter(name=>name.endsWith(".test.mjs")).sort().map(name=>fileURLToPath(new URL(name,directory)));
let summary,failures=0;
for await(const event of run({files,concurrency:1,timeout:15000})){
  if(event.type==="test:fail"){
    failures++;console.error(`FAIL: ${event.data.name}`);
    const error=event.data.details?.error;console.error(error?.cause??error??event.data);
  }
  if(event.type==="test:summary")summary=event.data;
}
if(!summary||summary.counts.tests===0){console.error("Test runner ended without a nonempty final summary.");process.exitCode=1;}
else {console.log("Tests:",JSON.stringify(summary));process.exitCode=summary.success&&!failures?0:1;}
