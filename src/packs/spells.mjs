import { forestLordSpellDocuments } from "./forest-lord-spells.mjs";
import { witchBladeSpellDocuments } from "./witch-blade-spells.mjs";

export const folders = [];
export const documents = [
  ...forestLordSpellDocuments,
  ...witchBladeSpellDocuments
];
