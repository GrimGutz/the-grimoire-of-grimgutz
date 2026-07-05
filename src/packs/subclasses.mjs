import { keeperSubclassDocuments } from "./keeper-subclasses.mjs";
import { schoolOfSteelSubclassDocuments } from "./school-of-steel-subclass.mjs";
import { spiritVesselSubclassDocuments } from "./spirit-vessel-subclasses.mjs";

export const folders = [];

export const documents = [
  ...keeperSubclassDocuments,
  ...schoolOfSteelSubclassDocuments,
  ...spiritVesselSubclassDocuments
];
