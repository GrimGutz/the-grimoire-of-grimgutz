import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { MODULE_ID } from "../scripts/automation/shared/constants.mjs";
import {
  applyTemporaryHp,
  cleanupZoneTemplates,
  createCircleTemplate,
  postZoneSummary
} from "../scripts/automation/shared/zones.mjs";

let owner, scene, documents, sequence;
beforeEach(() => {
  sequence = 0;
  documents = new Map();
  owner = {
    uuid: "Actor.owner",
    system: { attributes: { concentration: { limit: 1 } } },
    concentration: { effects: [] }
  };
  scene = {
    id: "player-scene",
    grid: { distance: 1.5, size: 100, units: "m" },
    templates: [],
    async createEmbeddedDocuments(type, definitions) {
      return definitions.map(data => {
        const doc = {
          ...structuredClone(data),
          id: `t${++sequence}`,
          uuid: `Scene.player-scene.MeasuredTemplate.t${sequence}`,
          getFlag: (module, key) => doc.flags[module]?.[key],
          async setFlag(module, key, value) {
            doc.flags[module][key] = value;
          },
          async delete() {
            scene.templates = scene.templates.filter(template => template !== doc);
            documents.delete(doc.uuid);
          }
        };
        scene.templates.push(doc);
        documents.set(doc.uuid, doc);
        return doc;
      });
    }
  };
  const scenes = new Map([[scene.id, scene]]),
    gm = { id: "gm", isGM: true };
  scenes[Symbol.iterator] = function* () {
    yield* this.values();
  };
  globalThis.game = { user: gm, users: { activeGM: gm }, scenes, time: { worldTime: 0 } };
  globalThis.canvas = { ready: true, scene };
  globalThis.foundry = { utils: { randomID: () => `request${++sequence}`, deepClone: structuredClone } };
  globalThis.fromUuid = async uuid => documents.get(uuid);
  documents.set(owner.uuid, owner);
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.ui = { notifications: { warn() {} } };
});

test("zone temporary HP never replace a higher existing total", async () => {
  const high = {
    uuid: "Actor.high",
    system: { attributes: { hp: { temp: 15 } } },
    async update() {
      throw Error("do not reduce temporary HP");
    }
  };
  const low = {
    uuid: "Actor.low",
    system: { attributes: { hp: { temp: 2 } } },
    async update(patch) {
      this.system.attributes.hp.temp = patch["system.attributes.hp.temp"];
    }
  };
  const result = await applyTemporaryHp([{ actor: high }, { actor: low }], 10, { sourceActor: owner });
  assert.equal(result.applied.length, 2);
  assert.equal(high.system.attributes.hp.temp, 15);
  assert.equal(low.system.attributes.hp.temp, 10);
});

test("Region zones expire and disappear when their source is deleted", async () => {
  let deleted = 0;
  scene.regions = [
    {
      uuid: "Scene.player-scene.Region.zone",
      flags: { [MODULE_ID]: { zoneTemplate: true, sourceActor: owner.uuid, zoneExpiresAt: 60 } },
      async delete() {
        deleted++;
      }
    }
  ];
  game.time.worldTime = 59;
  await cleanupZoneTemplates();
  assert.equal(deleted, 0);
  documents.delete(owner.uuid);
  await cleanupZoneTemplates();
  assert.equal(deleted, 1);
});

test("zone creation converts feet and hidden indicators stay hidden on another GM scene", async () => {
  const result = await createCircleTemplate({
    actor: owner,
    originToken: { center: { x: 100, y: 100 }, document: { hidden: true } },
    radius: 30,
    label: "Zone",
    seconds: 60
  });
  assert.ok(Math.abs(result.distance - 9.144) < 0.00001);
  assert.equal(result.hidden, true);
  canvas.scene = { id: "other-gm-scene" };
  game.time.worldTime = 59;
  await cleanupZoneTemplates();
  assert.equal(scene.templates.length, 1);
  game.time.worldTime = 60;
  await cleanupZoneTemplates();
  assert.equal(scene.templates.length, 0);
});

test("failed concentration rolls back its zone and confirmed resource expense", async () => {
  const resource = {
    uuid: "Actor.owner.Item.rage",
    parent: owner,
    system: { uses: { max: 7, spent: 1 } },
    async update(patch) {
      this.system.uses.spent = patch["system.uses.spent"];
    }
  };
  documents.set(resource.uuid, resource);
  const activity = {
    uuid: "Actor.owner.Item.rage.Activity.a",
    actor: owner,
    item: { actor: owner },
    duration: {},
    clone(data) {
      return { ...this, ...data };
    }
  };
  documents.set(activity.uuid, activity);
  owner.beginConcentrating = async () => undefined;
  const result = await createCircleTemplate({
    actor: owner,
    originToken: { center: { x: 0, y: 0 } },
    radius: 30,
    label: "Zone",
    seconds: 60,
    concentration: { activityUuid: activity.uuid },
    resource: { itemUuid: resource.uuid, cost: 3 }
  });
  assert.equal(result, null);
  assert.equal(scene.templates.length, 0);
  assert.equal(resource.system.uses.spent, 1);
});

test("lost concentration removes its zone; public summaries never name hidden targets", async () => {
  const template = await createCircleTemplate({
    actor: owner,
    originToken: { center: { x: 0, y: 0 } },
    radius: 30,
    label: "Zone",
    seconds: 60
  });
  template.flags[MODULE_ID].zoneConcentrationEffect = "Actor.owner.ActiveEffect.gone";
  await cleanupZoneTemplates();
  assert.equal(scene.templates.length, 0);
  let content;
  ChatMessage.create = async data => {
    content = data.content;
  };
  await postZoneSummary({
    actor: owner,
    title: "Zone",
    radius: 30,
    rows: [
      {
        label: "Targets",
        tokens: [
          { name: "Visible", document: { hidden: false } },
          { name: "Secret monster", document: { hidden: true } }
        ]
      }
    ]
  });
  assert.match(content, /Visible/);
  assert.doesNotMatch(content, /Secret monster/);
});
