import { MODULE_ID } from "./constants.mjs";
import { itemUses, notify } from "./helpers.mjs";
import { gmRequestResult, installGmRequests, registerGmRequest, requestGm } from "./gm-requests.mjs";

const SOCKET_TYPE = "create-summon";
const OWNERSHIP = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? {
  NONE: 0,
  LIMITED: 1,
  OBSERVER: 2,
  OWNER: 3
};

const ownerOperations = new Map();
const recipes = new Map();

export function registerSummonRecipe(source, recipe) { recipes.set(source, recipe); }
export function summonRequestResult(requestId) { return gmRequestResult(requestId); }

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function abilityData(values = {}) {
  return Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(ability => [
    ability,
    {
      value: Number(values[ability] ?? 10),
      proficient: 0,
      bonuses: {
        check: "",
        save: ""
      },
      max: null
    }
  ]));
}

function defaultSkills() {
  const skills = {
    acr: "dex",
    ani: "wis",
    arc: "int",
    ath: "str",
    dec: "cha",
    his: "int",
    ins: "wis",
    itm: "cha",
    inv: "int",
    med: "wis",
    nat: "int",
    prc: "wis",
    prf: "cha",
    per: "cha",
    rel: "int",
    slt: "dex",
    ste: "dex",
    sur: "wis"
  };
  return Object.fromEntries(Object.entries(skills).map(([key, ability]) => [
    key,
    {
      value: 0,
      ability,
      bonuses: {
        check: "",
        passive: ""
      },
      roll: {
        min: null,
        max: null,
        mode: 0
      }
    }
  ]));
}

function defaultDamageTrait(overrides = {}) {
  return {
    value: overrides.value ?? [],
    bypasses: overrides.bypasses ?? [],
    custom: overrides.custom ?? ""
  };
}

function defaultConditionTrait(overrides = {}) {
  return {
    value: overrides.value ?? [],
    custom: overrides.custom ?? ""
  };
}

function movementData(movement = {}) {
  return {
    burrow: Number(movement.burrow ?? 0),
    climb: Number(movement.climb ?? 0),
    fly: Number(movement.fly ?? 0),
    swim: Number(movement.swim ?? 0),
    walk: Number(movement.walk ?? 0),
    units: movement.units ?? "ft",
    hover: Boolean(movement.hover)
  };
}

function sensesData(senses = {}) {
  return {
    darkvision: Number(senses.darkvision ?? 0),
    blindsight: Number(senses.blindsight ?? 0),
    tremorsense: Number(senses.tremorsense ?? 0),
    truesight: Number(senses.truesight ?? 0),
    units: senses.units ?? "ft",
    special: senses.special ?? ""
  };
}

function spellsData() {
  return Object.fromEntries(["spell0", "spell1", "spell2", "spell3", "spell4", "spell5", "spell6", "spell7", "spell8", "spell9", "pact"].map(key => [
    key,
    {
      value: 0,
      override: null
    }
  ]));
}

function safeRollFormula(value) {
  return String(value ?? "")
    .replace(/[кК]/g, "d")
    .replaceAll("×", "*")
    .replaceAll("−", "-")
    .trim();
}

function tokenDimension(size) {
  if (size === "tiny") return 0.5;
  if (size === "lg") return 2;
  if (size === "huge") return 3;
  if (size === "grg") return 4;
  return 1;
}

function ownershipFor(owner, requestedBy) {
  const ownership = {
    default: OWNERSHIP.OBSERVER ?? 2
  };
  if (requestedBy) ownership[requestedBy] = OWNERSHIP.OWNER ?? 3;
  for (const user of game.users ?? []) {
    if (user.isGM) continue;
    if (owner?.testUserPermission?.(user, "OWNER")) ownership[user.id] = OWNERSHIP.OWNER ?? 3;
  }
  return ownership;
}

function featureItems(summon) {
  return (summon.features ?? []).map(feature => ({
    name: feature.name,
    type: "feat",
    img: feature.img ?? summon.img,
    system: {
      description: {
        value: feature.description ?? "",
        chat: ""
      },
      source: {
        custom: "The Grimoire of GrimGutz: summoned creature",
        book: "TGoGG",
        page: "",
        license: "",
        revision: 1,
        rules: "2014"
      },
      uses: {
        max: "",
        spent: 0,
        recovery: []
      },
      type: {
        value: "monster",
        subtype: ""
      },
      prerequisites: {
        level: null
      },
      properties: [],
      requirements: "",
      activities: {},
      advancement: [],
      identifier: "",
      enchant: {}
    }
  }));
}

function actorSystem(summon) {
  const hp = Math.max(1, Number(summon.hp ?? 1));
  return {
    abilities: abilityData(summon.abilities),
    attributes: {
      ac: {
        flat: Number(summon.ac ?? 10),
        calc: "natural",
        formula: ""
      },
      hp: {
        value: hp,
        max: hp,
        temp: null,
        tempmax: null,
        formula: safeRollFormula(summon.hpFormula)
      },
      init: {
        ability: "",
        bonus: "",
        roll: {
          min: null,
          max: null,
          mode: 0
        }
      },
      movement: movementData(summon.movement),
      attunement: {
        max: 3
      },
      senses: sensesData(summon.senses),
      spellcasting: "",
      exhaustion: 0,
      concentration: {
        ability: "",
        roll: {
          min: null,
          max: null,
          mode: 0
        },
        bonuses: {
          save: ""
        },
        limit: 1
      },
      hd: {
        spent: 0
      },
      death: {
        ability: "",
        roll: {
          min: null,
          max: null,
          mode: 0
        },
        success: 0,
        failure: 0
      }
    },
    details: {
      biography: {
        value: summon.description ?? "",
        public: ""
      },
      alignment: summon.alignment ?? "",
      race: null,
      type: {
        value: summon.type ?? "custom",
        subtype: summon.subtype ?? "",
        swarm: summon.swarm ?? "",
        custom: summon.customType ?? ""
      },
      environment: "",
      cr: Number(summon.cr ?? 0),
      spellLevel: 0,
      ideal: "",
      bond: "",
      flaw: ""
    },
    traits: {
      size: summon.size ?? "med",
      di: defaultDamageTrait(summon.di),
      dr: defaultDamageTrait(summon.dr),
      dv: defaultDamageTrait(summon.dv),
      ci: defaultConditionTrait(summon.ci),
      languages: {
        value: summon.languages?.value ?? [],
        custom: summon.languages?.custom ?? ""
      },
      dm: {
        amount: {},
        bypasses: []
      }
    },
    currency: {
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    },
    skills: defaultSkills(),
    spells: spellsData(),
    bonuses: {
      mwak: {
        attack: "",
        damage: ""
      },
      rwak: {
        attack: "",
        damage: ""
      },
      msak: {
        attack: "",
        damage: ""
      },
      rsak: {
        attack: "",
        damage: ""
      },
      abilities: {
        check: "",
        save: "",
        skill: ""
      },
      spell: {
        dc: ""
      }
    },
    resources: {
      legact: {
        value: 0,
        max: 0
      },
      legres: {
        value: 0,
        max: 0
      },
      lair: {
        value: false,
        initiative: null
      }
    },
    tools: {},
    source: {
      custom: "The Grimoire of GrimGutz: summoned creature",
      book: "TGoGG",
      page: "",
      license: "",
      revision: 1,
      rules: "2014"
    }
  };
}

function prototypeToken(summon) {
  const dimension = tokenDimension(summon.size);
  return {
    name: summon.name,
    displayName: 20,
    actorLink: false,
    width: dimension,
    height: dimension,
    disposition: 1,
    displayBars: 20,
    bar1: {
      attribute: "attributes.hp"
    },
    bar2: {
      attribute: null
    },
    texture: {
      src: summon.img,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: "contain",
      alphaThreshold: 0.75
    },
    sight: {
      enabled: false,
      range: 0,
      angle: 360,
      visionMode: "basic"
    }
  };
}

function actorData(owner, summon, requestedBy) {
  return {
    name: summon.name,
    type: "npc",
    img: summon.img,
    items: featureItems(summon),
    effects: summon.effects ?? [],
    ownership: ownershipFor(owner, requestedBy),
    flags: {
      [MODULE_ID]: {
        summoned: true,
        summonedBy: owner.uuid,
        summonKind: summon.kind,
        summonSource: summon.source ?? "",
        summonFamily: summon.uniqueGroup ?? summon.source ?? summon.kind,
        summonTemplate: summon,
        summonManaged: managedValues(summon),
        summonLifecycle: summon.lifecycle ? {
          ...summon.lifecycle,
          createdAt: game.time?.worldTime ?? 0,
          expiresAt: (game.time?.worldTime ?? 0) + Number(summon.lifecycle.seconds ?? 0),
          controlled: true
        } : null
      }
    },
    system: actorSystem(summon),
    prototypeToken: prototypeToken(summon)
  };
}

function summonedActor(owner, summon) {
  return game.actors?.find(actor => (
    actor.getFlag(MODULE_ID, "summoned") === true
    && actor.getFlag(MODULE_ID, "summonedBy") === owner.uuid
    && (actor.getFlag(MODULE_ID, "summonFamily") === (summon.uniqueGroup ?? summon.source ?? summon.kind)
      || actor.getFlag(MODULE_ID, "summonKind") === summon.kind)
  ));
}

function firstTokenDocument(actor) {
  const tokens = actor?.getActiveTokens?.(true, true) ?? actor?.getActiveTokens?.() ?? [];
  const token = tokens[0];
  return token?.document ?? token ?? null;
}

function sceneTokens(scene) { return [...(scene?.tokens ?? [])]; }

function ownerTokenDocument(owner, scene, sourceTokenId) {
  return scene?.tokens?.get?.(sourceTokenId)
    ?? sceneTokens(scene).find(token => token.actor?.uuid === owner.uuid || token.actorId === owner.id)
    ?? (canvas?.scene === scene ? canvas?.tokens?.controlled?.find(token => token.actor?.uuid === owner.uuid)?.document : null);
}

function tokenPosition(owner, scene, sourceTokenId, index = 0) {
  const token = ownerTokenDocument(owner, scene, sourceTokenId);
  const grid = scene?.grid?.size ?? 100;
  if (!token) return { x: 0, y: 0 };
  const width = Math.max(1, Number(token.width ?? 1));
  return {
    x: Number(token.x ?? 0) + (width * grid),
    y: Number(token.y ?? 0) + index * grid
  };
}

async function createToken(actor, owner, summon, scene, sourceTokenId, index) {
  if (!scene) return null;
  const existingToken = summon.unique ? sceneTokens(scene).find(token => token.actorId === actor.id) : null;
  if (existingToken) return existingToken;

  const token = actor.prototypeToken?.toObject?.() ?? foundry.utils.deepClone(actor.prototypeToken ?? {});
  const ownerToken = ownerTokenDocument(owner, scene, sourceTokenId);
  const position = tokenPosition(owner, scene, sourceTokenId, index);
  const tokenData = foundry.utils.mergeObject(token, {
    actorId: actor.id,
    actorLink: summon.unique === true,
    x: position.x,
    y: position.y,
    disposition: Number(ownerToken?.disposition ?? 1)
  }, { inplace: false });
  const created = await scene.createEmbeddedDocuments("Token", [tokenData]);
  if (!created[0]) throw new Error("Не удалось создать токен призыва.");
  return created[0];
}

async function announceSummon(owner, actor, summon, token) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: `
      <p><strong>${escapeHtml(owner.name)}:</strong> призвано существо <strong>${escapeHtml(actor.name)}</strong>${token ? " и размещено на сцене" : ", но токен не создан: нет активной сцены"}.</p>
      ${summon.note ? `<p>${summon.note}</p>` : ""}
    `
  });
}

function managedValues(summon) {
  const system = actorSystem(summon);
  const values = { name: summon.name, img: summon.img, "system.attributes.ac.flat": system.attributes.ac.flat,
    "system.attributes.hp.max": system.attributes.hp.max, "system.attributes.hp.formula": system.attributes.hp.formula };
  for (const [key, value] of Object.entries(system.attributes.movement)) values[`system.attributes.movement.${key}`] = value;
  for (const [key, value] of Object.entries(system.abilities)) values[`system.abilities.${key}.value`] = value.value;
  return values;
}

export async function updateManagedSummon(actor, summon) {
  const previous = actor.getFlag(MODULE_ID, "summonManaged");
  if (!previous) return false; // Old or ambiguous actors are reported, never silently overwritten.
  const desired = managedValues(summon), update = {};
  for (const [key, value] of Object.entries(desired)) {
    const current = foundry.utils.getProperty(actor, key);
    if (JSON.stringify(current) === JSON.stringify(previous[key]) && JSON.stringify(current) !== JSON.stringify(value)) update[key] = value;
  }
  if (update["system.attributes.hp.max"] !== undefined) {
    const hp = actor.system.attributes.hp;
    update["system.attributes.hp.value"] = hp.value <= 0 ? 0 : Math.max(0, update["system.attributes.hp.max"] - Math.max(0, hp.max - hp.value));
  }
  if (!Object.keys(update).length && actor.getFlag(MODULE_ID, "summonKind") === summon.kind) return false;
  update[`flags.${MODULE_ID}.summonManaged`] = desired;
  update[`flags.${MODULE_ID}.summonTemplate`] = summon;
  update[`flags.${MODULE_ID}.summonKind`] = summon.kind;
  await actor.update(update);
  return true;
}

export async function syncUniqueSummons(owner) {
  for (const actor of game.actors ?? []) {
    if (actor.getFlag?.(MODULE_ID, "summonedBy") !== owner.uuid) continue;
    const template = actor.getFlag(MODULE_ID, "summonTemplate");
    const recipe = recipes.get(actor.getFlag(MODULE_ID, "summonSource"));
    if (template?.unique && recipe) await updateManagedSummon(actor, recipe(owner, template));
  }
}

function serializeOwner(owner, task) {
  const previous = ownerOperations.get(owner.uuid) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(task);
  ownerOperations.set(owner.uuid, operation);
  void operation.finally(() => { if (ownerOperations.get(owner.uuid) === operation) ownerOperations.delete(owner.uuid); }).catch(() => {});
  return operation;
}

async function storeRequest(owner, requestId, result) {
  if (!owner.setFlag) return;
  const records = { ...(owner.getFlag(MODULE_ID, "summonRequests") ?? {}), [requestId]: { ...result, updatedAt: game.time?.worldTime ?? 0 } };
  for (const key of Object.keys(records).slice(0, Math.max(0, Object.keys(records).length - 100))) delete records[key];
  await owner.setFlag(MODULE_ID, "summonRequests", records);
}

async function performSummonGroup(owner, data, { requesterId, requestId }) {
  const previous = owner.getFlag?.(MODULE_ID, "summonRequests")?.[requestId];
  if (previous && previous.status !== "pending") return previous;
  const summons = data.summons ?? (data.summon ? [data.summon] : []);
  if (!summons.length || summons.length > 3 || summons.some(summon => !summon.kind)) throw Error("Неверная группа призывов.");
  const scene = data.sceneId ? game.scenes?.get?.(data.sceneId) ?? (canvas?.scene?.id === data.sceneId ? canvas.scene : null) : null;
  if (data.sceneId && !scene) throw Error("Сцена призыва не найдена.");
  if (data.requireScene && !scene) throw Error("Для призыва нужна сцена.");
  const actors = [], tokens = [], newActors = [], newTokens = [];
  let resourceItem, charged = 0;
  await storeRequest(owner, requestId, { status: "pending" });
  try {
    if (data.resource?.itemUuid) {
      resourceItem = await fromUuid(data.resource.itemUuid);
      if (!resourceItem || resourceItem.parent?.uuid !== owner.uuid) throw Error("Ресурс призыва не принадлежит владельцу.");
      const cost = Number(data.resource.cost ?? summons.length);
      if (!Number.isInteger(cost) || cost < 1) throw Error("Неверный расход призыва.");
      const uses = itemUses(resourceItem);
      if (data.resource.consumed === true) {
        if (uses.spent < cost) throw Error("Предыдущий расход не подтверждён.");
      } else {
        if (uses.remaining < cost) throw Error("Недостаточно использований/очков призыва.");
        await resourceItem.update({ "system.uses.spent": uses.spent + cost });
      }
      charged = cost;
    }
    for (const [index, summon] of summons.entries()) {
      let actor = summon.unique ? summonedActor(owner, summon) : null;
      if (!actor) {
        const definition = actorData(owner, summon, requesterId);
        definition.flags[MODULE_ID].summonRequestId = requestId;
        actor = await Actor.create(definition, { renderSheet: false });
        if (!actor) throw Error(`Actor.create returned no document for summon kind "${summon.kind}".`);
        newActors.push(actor);
      } else await updateManagedSummon(actor, summon);
      const existed = sceneTokens(scene).some(token => token.actorId === actor.id);
      const token = await createToken(actor, owner, summon, scene, data.sourceTokenId, index);
      if (token && !existed) newTokens.push({ scene, id: token.id ?? token._id });
      actors.push(actor); if (token) tokens.push(token);
    }
    const result = { status: "success", actorUuids: actors.map(actor => actor.uuid ?? `Actor.${actor.id}`), tokenUuids: tokens.map(token => token.uuid ?? token.id), requestId };
    await storeRequest(owner, requestId, result);
    for (const [index, actor] of actors.entries()) {
      try { await announceSummon(owner, actor, summons[index], tokens[index]); }
      catch (error) { console.warn(`${MODULE_ID} | Summon announcement failed`, error); }
    }
    return result;
  } catch (error) {
    const rollbackErrors = [];
    for (const { scene, id } of newTokens) {
      try { await scene.deleteEmbeddedDocuments("Token", [id]); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    for (const actor of newActors) {
      try { await actor.delete(); } catch (failure) { rollbackErrors.push(failure.message); }
    }
    // Refund only after a confirmed rollback. Never infer this from a client timeout.
    if (!rollbackErrors.length && charged) {
      try { await resourceItem.update({ "system.uses.spent": Math.max(0, itemUses(resourceItem).spent - charged) }); }
      catch (failure) { rollbackErrors.push(`Расход не возвращён: ${failure.message}`); }
    }
    const result = { status: rollbackErrors.length ? "needs-review" : "failed", error: error.message, rollbackErrors, requestId };
    await storeRequest(owner, requestId, result);
    return result;
  }
}

registerGmRequest(SOCKET_TYPE, (owner, data, context) => serializeOwner(owner, () => performSummonGroup(owner, data, context)));
registerGmRequest("inspect-summon-request", async (owner, data) => owner.getFlag?.(MODULE_ID, "summonRequests")?.[data.requestId] ?? { status: "pending", requestId: data.requestId });

export async function createSummonedGroup(owner, summons, options = {}) {
  if (!owner || !summons?.length) return { status: "failed", error: "Нет владельца или существ." };
  const scene = options.scene ?? canvas?.scene;
  const result = await requestGm(SOCKET_TYPE, owner, {
    summons, sceneId: options.sceneId ?? scene?.id ?? null, sourceTokenId: options.sourceTokenId ?? ownerTokenDocument(owner, scene)?.id ?? null,
    resource: options.resource ?? null, requireScene: options.requireScene === true
  }, options);
  if (result.status === "failed" || result.status === "needs-review") notify(result.error ?? "Призыв не выполнен.", "warn");
  return result;
}

export async function createSummonedCreature(owner, summon, options = {}) {
  const result = await createSummonedGroup(owner, [summon], options);
  if (result.status === "pending") {
    const error = new Error(`Результат призыва ${result.requestId} ещё неизвестен.`);
    error.name = "SummonPendingError"; error.requestId = result.requestId;
    throw error;
  }
  if (result.status !== "success") return false;
  const uuid = result.actorUuids[0];
  return game.actors?.get?.(uuid.split(".").at(-1)) ?? game.actors?.find(actor => (actor.uuid ?? `Actor.${actor.id}`) === uuid) ?? await fromUuid(uuid);
}

export function installSummonSocket() { installGmRequests(); }
