import { MODULE_ID } from "./constants.mjs";
import { notify } from "./helpers.mjs";

const SOCKET_TYPE = "create-summon";
const OWNERSHIP = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? {
  NONE: 0,
  LIMITED: 1,
  OBSERVER: 2,
  OWNER: 3
};

let socketInstalled = false;
const pendingUniqueSummons = new Map();
const handledSummonRequests = new Set();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function canCreateActors() {
  if (game.user?.isGM) return true;
  try {
    if (typeof game.user?.can === "function" && game.user.can("ACTOR_CREATE")) return true;
    if (typeof game.user?.hasPermission === "function" && game.user.hasPermission("ACTOR_CREATE")) return true;
  } catch {
    return false;
  }
  return false;
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
        summonSource: summon.source ?? ""
      }
    },
    system: actorSystem(summon),
    prototypeToken: prototypeToken(summon)
  };
}

function summonedActor(owner, kind) {
  return game.actors?.find(actor => (
    actor.getFlag(MODULE_ID, "summoned") === true
    && actor.getFlag(MODULE_ID, "summonedBy") === owner.uuid
    && actor.getFlag(MODULE_ID, "summonKind") === kind
  ));
}

function firstTokenDocument(actor) {
  const tokens = actor?.getActiveTokens?.(true, true) ?? actor?.getActiveTokens?.() ?? [];
  const token = tokens[0];
  return token?.document ?? token ?? null;
}

function ownerTokenDocument(owner) {
  const direct = firstTokenDocument(owner);
  if (direct) return direct;
  return canvas?.tokens?.controlled?.find(token => token.actor?.uuid === owner.uuid)?.document ?? null;
}

function tokenPosition(owner) {
  const token = ownerTokenDocument(owner);
  const grid = canvas?.grid?.size ?? canvas?.scene?.grid?.size ?? 100;
  if (!token) return { x: 0, y: 0 };
  const width = Math.max(1, Number(token.width ?? 1));
  return {
    x: Number(token.x ?? 0) + (width * grid),
    y: Number(token.y ?? 0)
  };
}

async function createToken(actor, owner, summon) {
  const scene = canvas?.scene;
  if (!scene) return null;
  const existingToken = summon.unique ? firstTokenDocument(actor) : null;
  if (existingToken) return existingToken;

  const token = actor.prototypeToken?.toObject?.() ?? foundry.utils.deepClone(actor.prototypeToken ?? {});
  const ownerToken = ownerTokenDocument(owner);
  const position = tokenPosition(owner);
  const tokenData = foundry.utils.mergeObject(token, {
    actorId: actor.id,
    actorLink: false,
    x: position.x,
    y: position.y,
    disposition: Number(ownerToken?.disposition ?? 1)
  }, { inplace: false });
  const created = await scene.createEmbeddedDocuments("Token", [tokenData]);
  return created[0] ?? null;
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

async function performSummonCreation(owner, summon, requestedBy) {
  const existing = summon.unique ? summonedActor(owner, summon.kind) : null;
  const actor = existing ?? await Actor.create(actorData(owner, summon, requestedBy), { renderSheet: false });
  if (!actor) throw new Error(`Actor.create returned no document for summon kind "${summon.kind}".`);
  let token = null;
  try {
    token = await createToken(actor, owner, summon);
  } catch (error) {
    console.warn(`${MODULE_ID} | Summon actor created but token placement failed`, error);
    notify(`Актёр «${actor.name}» создан, но токен не удалось разместить на сцене. Проверьте права на сцену или разместите токен вручную.`, "warn");
  }
  await announceSummon(owner, actor, summon, token);
  return actor;
}

function createSummonLocally(owner, summon, requestedBy) {
  if (!summon.unique) return performSummonCreation(owner, summon, requestedBy);
  const key = `${owner.uuid}:${summon.kind}`;
  const pending = pendingUniqueSummons.get(key);
  if (pending) return pending;
  const creation = performSummonCreation(owner, summon, requestedBy)
    .finally(() => { pendingUniqueSummons.delete(key); });
  pendingUniqueSummons.set(key, creation);
  return creation;
}

async function emitSummonRequest(owner, summon) {
  const gm = game.users?.activeGM ?? [...(game.users ?? [])].find(user => user.active && user.isGM);
  if (!gm) {
    notify("Нужен активный GM или право игрока создавать актёров, чтобы создать призванное существо.", "warn");
    return false;
  }
  game.socket.emit(`module.${MODULE_ID}`, {
    type: SOCKET_TYPE,
    requestId: foundry.utils.randomID(),
    ownerUuid: owner.uuid,
    summon,
    userId: game.user.id
  });
  notify("Запрос на создание призванного существа отправлен активному GM.");
  return true;
}

export async function createSummonedCreature(owner, summon, { localOnly = false, requestedBy = game.user?.id } = {}) {
  if (!owner || !summon?.kind) {
    notify("Не удалось создать призванное существо: нет владельца или типа призыва.", "warn");
    return false;
  }

  if (!localOnly && !canCreateActors()) {
    return emitSummonRequest(owner, summon);
  }

  try {
    return await createSummonLocally(owner, summon, requestedBy);
  } catch (error) {
    if (!localOnly && !game.user?.isGM) return emitSummonRequest(owner, summon);
    console.error(`${MODULE_ID} | Summon creation failed`, error);
    notify("Не удалось создать призванное существо. Подробности в консоли Foundry.", "error");
    return false;
  }
}

export function installSummonSocket() {
  if (socketInstalled || !game.socket) return;
  socketInstalled = true;
  game.socket.on(`module.${MODULE_ID}`, payload => {
    if (payload?.type !== SOCKET_TYPE || !game.user?.isGM) return;
    if (game.users?.activeGM && game.users.activeGM.id !== game.user.id) return;
    if (payload.requestId) {
      if (handledSummonRequests.has(payload.requestId)) return;
      handledSummonRequests.add(payload.requestId);
      if (handledSummonRequests.size > 100) handledSummonRequests.delete(handledSummonRequests.values().next().value);
    }
    void (async () => {
      const owner = await fromUuid(payload.ownerUuid);
      if (!owner) {
        notify("Не удалось выполнить призыв: владелец не найден.", "warn");
        return;
      }
      const requester = game.users?.get?.(payload.userId);
      if (!requester || (!requester.isGM && !owner.testUserPermission?.(requester, "OWNER"))) {
        console.warn(`${MODULE_ID} | Summon request ignored: requester does not own ${payload.ownerUuid}`);
        return;
      }
      await createSummonedCreature(owner, payload.summon, {
        localOnly: true,
        requestedBy: payload.userId
      });
    })().catch(error => {
      console.error(`${MODULE_ID} | Socket summon failed`, error);
      notify("Не удалось выполнить призыв через GM-клиент. Подробности в консоли Foundry.", "error");
    });
  });
}
