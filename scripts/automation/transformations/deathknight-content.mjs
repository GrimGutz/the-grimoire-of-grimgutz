import { defineContent } from "../shared/content.mjs";
import {
  inspectDeathknight,
  syncDeathknight,
  validateDeathknightAdvancement,
  validateDeathknightItem
} from "./deathknight.mjs";
import { controlDeathknight } from "./deathknight-actions.mjs";
import { installDeathknightHooks } from "./deathknight-events.mjs";
import { applyDeathknightPacket } from "./deathknight-spells.mjs";
import { controlDeathknightMinion } from "./deathknight-minions.mjs";

export const DEATHKNIGHT_CONTENT = defineContent({
  id: "deathknight",
  kind: "transformation",
  actions: { "deathknight-control": controlDeathknight, "deathknight-minion": controlDeathknightMinion },
  itemValidators: [validateDeathknightItem],
  advancementValidators: [validateDeathknightAdvancement],
  install: installDeathknightHooks,
  sync: syncDeathknight,
  inspect: inspectDeathknight,
  midi: { applyDeathknightPacket }
});
