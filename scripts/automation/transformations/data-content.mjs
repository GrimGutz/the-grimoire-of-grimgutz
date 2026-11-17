// Content descriptors of the data-defined transformations.
import { createTransformationKit } from "../shared/transformation-kit.mjs";
import { DATA_TRANSFORMATIONS } from "./data-transformations.mjs";

export const DATA_TRANSFORMATION_KITS = DATA_TRANSFORMATIONS.map(definition => createTransformationKit(definition));
export const DATA_TRANSFORMATION_CONTENT = DATA_TRANSFORMATION_KITS.map(kit => kit.content);
