// Compendium documents for data-defined transformations (runtime:
// scripts/automation/shared/transformation-kit.mjs). One definition yields the
// root card with the module's tier advancement, one feature card per boon and
// flaw, and native dnd5e activities (save, healing, attack, utility) whose DC,
// dice and uses read the tier and DC the runtime publishes in roll data.
import { feature, folder, idFor, itemChoice, itemGrant, uuidFor, withAutomationConfig, MODULE_ID } from "./common.mjs";
import { dcRef, featureRows, tierRef, TIER_LEVELS } from "../scripts/automation/shared/transformation-formulas.mjs";

const escape = text =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Paragraphs from text: "\n" separates paragraphs, lines starting with "• " become a list. */
export function rulesHtml(text) {
  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length) blocks.push(`<ul>${list.map(item => `<li>${item}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of String(text)
    .split("\n")
    .map(entry => entry.trim())
    .filter(Boolean)) {
    if (line.startsWith("• ")) list.push(escape(line.slice(2)));
    else {
      flush();
      blocks.push(`<p>${escape(line)}</p>`);
    }
  }
  flush();
  return blocks.join("");
}

/** Replace {tier} and {dc} in formulas with the roll-data references of `id`. */
const formula = (id, text) =>
  String(text ?? "")
    .replaceAll("{tier}", tierRef(id))
    .replaceAll("{dc}", dcRef(id));

function damagePart(id, { formula: dice, type }, healing = false) {
  return {
    number: null,
    denomination: null,
    bonus: "",
    types: healing ? [type ?? "healing"] : [type ?? []].flat(),
    custom: { enabled: true, formula: formula(id, dice) },
    scaling: { mode: "", number: null, formula: "" }
  };
}

function conditionEffect(definition, featureKey, index, { name, statuses = [], seconds = null, marker = null }) {
  return {
    _id: idFor(`effect:${featureKey}:${index}`),
    name,
    img: definition.icon,
    type: "base",
    description: "",
    origin: null,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses,
    tint: "#ffffff",
    start: null,
    duration: { value: seconds, units: "seconds", expiry: null, expired: false },
    sort: 0,
    flags: withAutomationConfig(
      {
        [MODULE_ID]: {
          transformation: definition.id,
          transformationCondition: featureKey,
          ...(marker ? { transformationMarker: marker } : {})
        }
      },
      { key: `${featureKey}:effect:${index}`, type: "effect" }
    ),
    system: { changes: [] }
  };
}

const ACTIVATION_VALUE = { minute: 1, hour: 1 };

/** One native dnd5e activity (and the condition effects it applies) from an activity spec. */
function activity(definition, featureKey, spec, index) {
  const id = definition.id;
  const activityId = idFor(`activity:${featureKey}:${index}`);
  const effects = (spec.effects ?? []).map((effect, effectIndex) =>
    conditionEffect(definition, featureKey, `${index}:${effectIndex}`, effect)
  );
  const range =
    spec.range === "self"
      ? { value: null, units: "self", special: "", override: false }
      : spec.range === "touch"
        ? { value: null, units: "touch", special: "", override: false }
        : spec.range != null
          ? { value: String(spec.range), units: "ft", special: "", override: false }
          : { value: null, units: "", special: "", override: false };
  const pooled = spec.cost || spec.consumeAll || spec.gain != null;
  const flags = pooled
    ? withAutomationConfig(
        {
          [MODULE_ID]: {
            ...(spec.gain != null ? { action: `${id}-pool` } : {}),
            transformationPool: {
              transformation: id,
              ...(spec.cost ? { cost: spec.cost } : {}),
              ...(spec.consumeAll ? { consumeAll: true } : {}),
              ...(spec.gain != null ? { gain: spec.gain } : {})
            }
          }
        },
        { key: `${featureKey}:${index}`, type: "activity" }
      )
    : {};
  const data = {
    _id: activityId,
    type: spec.type,
    name: spec.name ?? "",
    img: "",
    flags,
    activation: {
      type: spec.activation ?? "action",
      value: spec.activationValue ?? ACTIVATION_VALUE[spec.activation] ?? (spec.activation === "special" ? null : 1),
      condition: spec.condition ?? "",
      override: false
    },
    consumption: {
      targets: spec.uses
        ? [
            {
              type: "itemUses",
              target: "",
              value: String(spec.uses === true ? 1 : spec.uses),
              scaling: { mode: "", formula: "" }
            }
          ]
        : [],
      scaling: { allowed: false, max: "" },
      spellSlot: false
    },
    description: { chatFlavor: spec.flavor ?? "" },
    duration: {
      concentration: Boolean(spec.concentration),
      value: spec.duration?.value != null ? formula(id, spec.duration.value) : "",
      units: spec.duration?.units ?? (spec.type === "save" || spec.type === "heal" ? "inst" : ""),
      special: "",
      override: false
    },
    effects: effects.map(effect => ({ _id: effect._id, ...(spec.type === "save" ? { onSave: false } : {}) })),
    range,
    target: {
      template: {
        count: spec.template ? "1" : "",
        contiguous: false,
        type: spec.template?.type ?? "",
        size: spec.template ? String(spec.template.size) : "",
        width: "",
        height: "",
        units: spec.template ? "ft" : ""
      },
      affects: {
        count: spec.targets?.count != null ? formula(id, spec.targets.count) : "",
        type: spec.targets?.type ?? (spec.template ? "creature" : ""),
        choice: Boolean(spec.targets?.choice),
        special: ""
      },
      prompt: true,
      override: false
    },
    uses: { spent: 0, max: "", recovery: [] },
    sort: index
  };
  if (spec.type === "save") {
    data.save = {
      ability: [spec.save].flat(),
      dc: { calculation: "", formula: dcRef(id) }
    };
    data.damage = { onSave: spec.onSave ?? "none", parts: (spec.damage ?? []).map(part => damagePart(id, part)) };
  }
  if (spec.type === "heal") data.healing = damagePart(id, spec.heal, true);
  if (spec.type === "attack") {
    data.attack = {
      ability: spec.attack?.ability ?? "",
      bonus: "",
      critical: { threshold: null },
      flat: false,
      type: { value: spec.attack?.value ?? "ranged", classification: spec.attack?.classification ?? "spell" }
    };
    data.damage = {
      critical: { bonus: "" },
      includeBase: false,
      parts: (spec.damage ?? []).map(part => damagePart(id, part))
    };
  }
  if (spec.type === "utility")
    data.roll = {
      formula: formula(id, spec.roll?.formula),
      name: spec.roll?.name ?? "",
      prompt: Boolean(spec.roll?.formula),
      visible: false
    };
  return { activity: { [activityId]: data }, effects };
}

const RECOVERY = { lr: "lr", sr: "sr" };

/** Item uses from a spec: `{ max, recovery: "lr" | "sr" }`, formulas may use {tier}. */
function uses(id, spec) {
  if (!spec) return null;
  return {
    max: formula(id, spec.max),
    spent: 0,
    recovery: spec.recovery ? [{ period: RECOVERY[spec.recovery], type: "recoverAll" }] : []
  };
}

/** Everything a definition contributes to the compendiums. */
export function transformationPack(definition, { sort }) {
  const { id, name } = definition;
  const rows = featureRows(definition);
  const folderKey = `folder:${id}`;
  const folders = [
    folder({ key: id, name, sort }),
    ...["boons", "flaws"].map((key, index) =>
      folder({
        key: `${id}-${key}`,
        name: index ? "Недостатки трансформации" : "Бонусы трансформации",
        parent: idFor(folderKey),
        sort: index + 1
      })
    )
  ];
  const note = `<p><strong>Автоматизация Foundry:</strong> ${escape(definition.automationNote)}</p>`;
  const features = rows.map(row => {
    const built = (row.spec.activities ?? []).map((spec, index) => activity(definition, row.key, spec, index));
    const requires = row.requires ? rows.find(entry => entry.id === row.requires) : null;
    return feature({
      key: row.key,
      name: row.name,
      img: row.spec.img ?? definition.icon,
      folder: idFor(`folder:${id}-${row.flaw ? "flaws" : "boons"}`),
      requirements: `${name} ${row.level}${requires ? `; ${requires.name}` : ""}`,
      sourcePage: String(row.page),
      sourceCustom: definition.source,
      automation: {
        feature: row.key,
        transformation: id,
        transformationFeature: true,
        transformationLevel: row.level,
        transformationBoon: !row.flaw,
        transformationFlaw: row.flaw,
        transformationExtra: row.extra,
        transformationRequires: row.requires
      },
      uses: uses(id, row.spec.uses),
      activities: Object.assign({}, ...built.map(entry => entry.activity)),
      effects: built.flatMap(entry => entry.effects),
      description: `<h2>${escape(row.name)}</h2><p><em>${row.flaw ? "Недостаток" : row.extra ? "Дополнительный бонус" : "Бонус"} трансформации, ступень ${row.level}${requires ? `; требование: @UUID[${uuidFor("features", requires.key)}]{${escape(requires.name)}}` : ""}.</em></p>${rulesHtml(row.spec.text)}${row.spec.automation ? `<p><strong>Автоматизация Foundry:</strong> ${escape(row.spec.automation)}</p>` : ""}`
    });
  });
  const tiers = [1, 2, 3, 4];
  const rootDocument = feature({
    key: `${id}-transformation`,
    name: `Трансформация: ${name}`,
    img: definition.icon,
    requirements: definition.requirements.text,
    sourcePage: definition.pages,
    sourceCustom: definition.source,
    automation: { feature: `${id}-transformation`, transformation: id },
    advancement: [
      ...tiers.map(tier =>
        itemGrant({
          key: `${id}-grant-${tier}`,
          level: TIER_LEVELS[tier - 1],
          title: `${name} ${tier}: ${tier === 1 ? "базовые бонусы и недостаток" : "обязательный недостаток"}`,
          items: rows.filter(row => row.level === tier && (tier === 1 || row.flaw)).map(row => row.key)
        })
      ),
      ...tiers.slice(1).map(tier =>
        itemChoice({
          key: `${id}-choice-${tier}`,
          level: TIER_LEVELS[tier - 1],
          count: 1,
          allowDrops: false,
          title: `${name} ${tier}: один бонус`,
          hint: "Один ещё не полученный бонус текущей или предыдущих ступеней; дополнительные бонусы входят в тот же выбор.",
          items: rows.filter(row => !row.flaw && row.level >= 2 && row.level <= tier).map(row => row.key)
        })
      )
    ],
    description: `<h1>${escape(name)}</h1>${rulesHtml(definition.intro)}<h2>Становление</h2>${rulesHtml(definition.becoming)}<h2>Требования</h2>${rulesHtml(`${definition.requirements.text}.\n${definition.dcText}`)}<h2>Вехи уровня</h2>${rulesHtml(definition.milestones.map(entry => `• ${entry}`).join("\n"))}<p>Общая модель модуля: ступени на 1/6/11/16 уровне персонажа. На I выдаются оба базовых бонуса и недостаток; на II–IV — обязательный недостаток и один ещё не полученный бонус текущей или предыдущей ступени. Требования проверяются, только если GM включил строгую проверку.</p><ul>${rows.map(row => `<li>@UUID[${uuidFor("features", row.key)}]{${escape(row.name)}} — ступень ${row.level}${row.flaw ? ", недостаток" : row.extra ? ", дополнительный бонус" : ""}</li>`).join("")}</ul>${note}`
  });
  return { folders, features, root: rootDocument };
}
