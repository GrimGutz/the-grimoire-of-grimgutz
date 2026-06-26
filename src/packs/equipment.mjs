import { weapon } from "../common.mjs";
import { murderspawnWeaponDocuments, murderspawnWeaponFolders } from "./murderspawn-transformation.mjs";

export const folders = [
  ...murderspawnWeaponFolders
];

export const documents = [
  weapon({
    key: "zweihander",
    name: "Цвайхандер",
    img: "icons/weapons/swords/greatsword-guard-gold-worn.webp",
    price: 75,
    weight: 12,
    dice: {
      number: 2,
      denomination: 8
    },
    damageTypes: ["slashing"],
    properties: ["hvy", "two", "spc"]
  }),
  weapon({
    key: "huge-hammer",
    name: "Огромный молот",
    img: "icons/weapons/hammers/hammer-double-steel.webp",
    price: 90,
    weight: 40,
    dice: {
      number: 2,
      denomination: 12
    },
    damageTypes: ["bludgeoning"],
    properties: ["hvy", "two", "spc"]
  }),
  weapon({
    key: "nodachi",
    name: "Нодати",
    img: "icons/weapons/swords/greatsword-guard.webp",
    price: 75,
    weight: 11,
    dice: {
      number: 2,
      denomination: 8
    },
    damageTypes: ["slashing"],
    properties: ["hvy", "two", "rch", "spc"]
  }),
  weapon({
    key: "odachi",
    name: "Одати",
    img: "icons/weapons/swords/greatsword-crossguard-curved.webp",
    price: 100,
    weight: 14,
    dice: {
      number: 2,
      denomination: 10
    },
    damageTypes: ["slashing"],
    properties: ["hvy", "two", "rch", "spc"],
    special: "Вы совершаете с помехой атаки по существам, находящимся в пределах 5 футов от вас."
  }),
  weapon({
    key: "nagamaki",
    name: "Нагамаки",
    img: "icons/weapons/polearms/glaive-simple.webp",
    price: 75,
    weight: 12,
    dice: {
      number: 2,
      denomination: 8
    },
    damageTypes: ["slashing", "piercing"],
    properties: ["hvy", "two", "rch", "spc"]
  }),
  ...murderspawnWeaponDocuments
];
