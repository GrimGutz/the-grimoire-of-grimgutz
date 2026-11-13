// Shared by authored cards and runtime. No Foundry globals or Node dependencies.
export const AREA_DEFINITIONS = [
  {
    id: "immaterial-whirlwind",
    feature: "immaterial-whirlwind",
    action: "open-immaterial-whirlwind",
    shape: "sphere",
    size: 30,
    origin: "point",
    save: "dex",
    dc: "8 + @prof + @abilities.int.mod",
    damage: [{ formula: "8d8", type: "alignment" }],
    onSave: "none",
    rage: 3,
    concentration: 60,
    periodic: "targetEnd"
  },
  {
    id: "witch-blade-seal-evil",
    feature: "witch-blade-seal",
    action: "use-witch-blade-seal-evil",
    shape: "cone",
    size: 30,
    origin: "self",
    excludeSelf: true,
    save: "cha",
    dc: "8 + @prof + @abilities.int.mod",
    damage: [],
    onSave: "none",
    rage: 1,
    statuses: ["stunned"],
    duration: { value: 1, units: "rounds", expiry: "turnStart" }
  },
  {
    id: "spew-insects",
    feature: "spew-insects",
    action: "roll-insect-spew",
    shape: "cone",
    size: 30,
    origin: "self",
    excludeSelf: true,
    save: "dex",
    dc: "8 + @prof + @abilities.con.mod",
    damage: [
      { formula: "4d12", type: "piercing" },
      { formula: "3d12", type: "poison" }
    ],
    onSave: "half",
    statuses: ["poisoned"],
    duration: { value: 60, units: "seconds", expiry: "updateWorldTime" }
  },
  {
    id: "otherworldly-presence",
    feature: "otherworldly-presence",
    activityName: "Вызвать присутствие",
    shape: "sphere",
    size: 20,
    origin: "self",
    excludeSelf: true,
    save: "wis",
    dc: "8 + @prof + @abilities.cha.mod",
    damage: [],
    onSave: "none",
    statuses: ["frightened", "stunned"],
    duration: { value: 1, units: "rounds", expiry: "sourceEnd" }
  },
  {
    id: "consecration",
    feature: "consecration",
    action: "use-crusader-consecration",
    shape: "sphere",
    size: 30,
    origin: "self",
    excludeSelf: true,
    targets: "enemy",
    save: "cha",
    dc: "8 + @prof + @abilities.cha.mod",
    damage: [{ formula: "@abilities.cha.mod + @classes.crusader.levels", type: "radiant" }],
    onSave: "none",
    allyTempHp: "@abilities.cha.mod + @classes.crusader.levels"
  },
  {
    id: "ritualist-spirit-destruction",
    feature: "binding-ritual",
    action: "roll-ritualist-spirit-destruction-die",
    shape: "sphere",
    size: 15,
    origin: "point",
    targets: "enemy",
    save: "wis",
    dc: "8 + @prof + @abilities.wis.mod",
    damage: [{ formula: "1d6", type: "force" }],
    onSave: "half",
    chooseDice: true
  },
  {
    id: "chaos-bolt-witch",
    feature: "chaos-bolt-witch",
    activityName: "Линия хаотической силы",
    shape: "line",
    size: 90,
    width: 5,
    origin: "self",
    excludeSelf: true,
    save: "dex",
    dc: "spellcasting",
    damage: [{ formula: "6d6", type: "force", scaling: { mode: "whole", number: 2, formula: "" } }],
    onSave: "half"
  },
  {
    id: "cacophonic-scream",
    feature: "cacophonic-scream",
    activityName: "Вопль",
    shape: "cone",
    size: 30,
    origin: "self",
    excludeSelf: true,
    save: "wis",
    dc: "spellcasting",
    damage: [{ formula: "4d8", type: "psychic" }],
    onSave: "half",
    concentration: 60,
    statuses: ["charmed"],
    duration: { value: 60, units: "seconds", expiry: "updateWorldTime" }
  }
];

export function areaDamagePart(spec) {
  const match = String(spec.formula).match(/^(\d+)d(\d+)(?:\s*([+-].+))?$/);
  return {
    number: match ? Number(match[1]) : 0,
    denomination: match ? Number(match[2]) : 0,
    bonus: match?.[3] ?? "",
    types: [spec.type],
    custom: { enabled: !match, formula: match ? "" : String(spec.formula) },
    scaling: spec.scaling ?? { mode: "", number: 1, formula: "" }
  };
}

export function areaActivityData(original, spec) {
  const data = structuredClone(original);
  data.type = "save";
  delete data.roll;
  delete data.attack;
  delete data.healing;
  data.target = {
    ...data.target,
    override: true,
    prompt: false,
    template: {
      type: spec.shape,
      size: String(spec.size),
      width: spec.width ? String(spec.width) : "",
      height: "",
      count: "1",
      units: "ft",
      contiguous: false
    },
    affects: { type: "creature", count: "", choice: false, special: "" }
  };
  data.damage = { onSave: spec.onSave ?? "none", parts: (spec.damage ?? []).map(areaDamagePart) };
  data.save = {
    ability: [spec.save],
    dc: {
      calculation: spec.dc === "spellcasting" ? "spellcasting" : "",
      formula: spec.dc === "spellcasting" ? "" : spec.dc
    }
  };
  data.midiProperties = {
    ...data.midiProperties,
    autoTargetAction: "always",
    autoTargetType: spec.targets ?? "any",
    confirmTargets: "never",
    forceDamageDialog: "always",
    autoCEEffects: "itempri"
  };
  if (spec.concentration)
    data.duration = {
      ...data.duration,
      value: String(spec.concentration),
      units: "second",
      concentration: true,
      override: true
    };
  return data;
}
