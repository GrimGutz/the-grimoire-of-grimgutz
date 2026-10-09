import assert from "node:assert/strict";
import {test} from "node:test";
import {canInspectActor, panelEventRows, renderAutomationPanel, automationPanelClass, registerAutomationPanel} from "../scripts/automation/shared/control-panel.mjs";
test("players cannot see queue snapshots or another actor's state", () => {
  globalThis.game = {user: {id: "player"}};
  assert.equal(canInspectActor({testUserPermission: () => false}), false);
  assert.deepEqual(panelEventRows([{state: "queued", name: "Hidden NPC"}]), []);
});
test("unknown outcomes never acquire Apply or Skip buttons, and another scene cannot Apply", () => {
  game.user = {id: "gm", isGM: true}; game.users = {activeGM: {id: "gm"}};
  globalThis.canvas = {scene: {id: "open"}};
  const rows = panelEventRows([{state: "queued", sceneId: "other"}, {state: "needs-review", sceneId: "open"}]);
  assert.equal(rows[0].canApply, false); assert.equal(rows[0].canSkip, true);
  assert.equal(rows[1].canApply, false); assert.equal(rows[1].canSkip, false);
});
test("panel escapes document names, ids and messages without injecting markup", () => {
  const html = renderAutomationPanel({actor: "<script>", pending: [], records: [{category: "<img>", name: '<img onerror="bad">', endUuid: '" onclick="bad'}]});
  assert.ok(!html.includes("<script>")); assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img")); assert.ok(!html.includes('data-uuid="" onclick'));
});
test("real panel menu and header handlers are registered and the menu constructor accepts options", () => {
  const hooks = new Map(), menus = [];
  globalThis.Hooks = {on: (name, handler) => hooks.set(name, handler)};
  globalThis.foundry = {applications: {api: {ApplicationV2: class {}}}};
  game.settings = {registerMenu: (...args) => menus.push(args)};
  registerAutomationPanel(new Map());
  assert.equal(menus[0][2].restricted, false);
  assert.equal(new (automationPanelClass())({}).actorOrUuid, null);
  assert.equal(typeof hooks.get("getHeaderControlsActorSheetV2"), "function");
});
