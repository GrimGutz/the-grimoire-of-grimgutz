import { hollowTransformationDocuments } from "./hollow-transformation.mjs";
import { murderspawnTransformationDocuments } from "./murderspawn-transformation.mjs";
import {arkaneTransformationDocuments} from "./arkane-transformation.mjs";
import {automatonTransformationDocuments} from "./automaton-transformation.mjs";

export const folders = [];

export const documents = [
  ...murderspawnTransformationDocuments,
  ...hollowTransformationDocuments,
  ...arkaneTransformationDocuments,
  ...automatonTransformationDocuments
];
