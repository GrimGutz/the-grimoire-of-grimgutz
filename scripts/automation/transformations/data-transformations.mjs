// Transformations defined as data and run by shared/transformation-kit.mjs.
// To add one: write <id>-definition.mjs, list it here, then add its descriptor
// to content-registry.mjs (see data-content.mjs).
import { MYCONID } from "./myconid-definition.mjs";
import { PSYKER } from "./psyker-definition.mjs";
import { SPHINX } from "./sphinx-definition.mjs";
import { VENDIGO } from "./vendigo-definition.mjs";
import { VOID } from "./void-definition.mjs";

export const DATA_TRANSFORMATIONS = Object.freeze([MYCONID, PSYKER, SPHINX, VENDIGO, VOID]);
