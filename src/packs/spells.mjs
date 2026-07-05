import { forestLordSpellDocuments } from "./forest-lord-spells.mjs";
import { witchBladeSpellDocuments } from "./witch-blade-spells.mjs";
import { bloodMageSpellDocuments } from "./blood-mage-spells.mjs";
import { nethereseArcanistSpellDocuments } from "./netherese-arcanist-spells.mjs";

export const folders = [];
export const documents = [
  ...forestLordSpellDocuments,
  ...witchBladeSpellDocuments,
  ...bloodMageSpellDocuments,
  ...nethereseArcanistSpellDocuments
];
