import { defineContent } from "../shared/content.mjs";
import { inspectFactory, validateFactoryAdvancement, validateFactoryItem } from "./factory.mjs";
import { syncFactory } from "./factory-passives.mjs";
import { controlFactory } from "./factory-actions.mjs";
import { installFactoryHooks } from "./factory-events.mjs";
import { applyFactoryDamage } from "./factory-damage.mjs";
import { applyFactoryDefense } from "./factory-defense.mjs";
import { controlFactoryHomunculus } from "./factory-homunculi.mjs";

export const FACTORY_CONTENT = defineContent({
  id: "factory",
  kind: "transformation",
  actions: { "factory-control": controlFactory, "factory-homunculus": controlFactoryHomunculus },
  itemValidators: [validateFactoryItem],
  advancementValidators: [validateFactoryAdvancement],
  install: installFactoryHooks,
  sync: syncFactory,
  inspect: inspectFactory,
  midi: { applyFactoryDamage, applyFactoryDefense }
});
