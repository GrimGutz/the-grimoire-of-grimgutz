const MODULE_ID = "the-grimoire-of-grimgutz";

Hooks.once("init", () => {
  const module = game.modules.get(MODULE_ID);
  console.log(`${MODULE_ID} | Initializing v${module?.version ?? "unknown"}`);
});

