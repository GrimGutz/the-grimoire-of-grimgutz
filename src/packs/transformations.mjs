import { hollowTransformationDocuments } from "./hollow-transformation.mjs";
import { murderspawnTransformationDocuments } from "./murderspawn-transformation.mjs";

export const folders = [];

export const documents = [
  ...murderspawnTransformationDocuments,
  ...hollowTransformationDocuments
];
