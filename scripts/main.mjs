import { MODULE_ID, initializeOwnedActors, registerAutomation } from "./automation.mjs";

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  console.log(`${MODULE_ID} | Initializing v${module?.version ?? "unknown"}`);
  registerAutomation();
});

Hooks.once("ready", () => {
  void initializeOwnedActors().catch(error => {
    console.error(`${MODULE_ID} | Ready automation failed`, error);
  });
});
