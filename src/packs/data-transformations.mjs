// Myconid, Psyker, Sphinx, Vendigo and Void: transformations defined as data
// (scripts/automation/transformations/*-definition.mjs) and built by the kit.
import { transformationPack } from "../transformation-kit-pack.mjs";
import { DATA_TRANSFORMATIONS } from "../../scripts/automation/transformations/data-transformations.mjs";

const packs = DATA_TRANSFORMATIONS.map((definition, index) =>
  transformationPack(definition, { sort: 3700000 + index * 100000 })
);

export const dataTransformationDocuments = packs.map(pack => pack.root);
export const dataTransformationFeatureDocuments = packs.flatMap(pack => pack.features);
export const dataTransformationFolders = packs.flatMap(pack => pack.folders);
