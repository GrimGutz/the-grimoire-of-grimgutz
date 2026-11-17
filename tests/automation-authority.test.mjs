import assert from "node:assert/strict";
import { test } from "node:test";
import { automationAuthorityUser, isAutomationAuthority } from "../scripts/automation/shared/helpers.mjs";

function world({ gm = null, me, users }) {
  globalThis.game = {
    user: users.find(user => user.id === me),
    users: Object.assign([...users], { activeGM: gm })
  };
}
const actor = (uuid, owners) => ({
  uuid,
  get isOwner() {
    return owners.includes(globalThis.game.user.id);
  },
  testUserPermission: (user, level) => level === "OWNER" && owners.includes(user.id)
});

test("with a GM connected only the GM is the authority", () => {
  const users = [
    { id: "gm", active: true, isGM: true },
    { id: "p1", active: true }
  ];
  const party = actor("Actor.party", ["p1", "gm"]);
  world({ gm: users[0], me: "gm", users });
  assert.equal(isAutomationAuthority(party), true);
  world({ gm: users[0], me: "p1", users });
  assert.equal(isAutomationAuthority(party), false);
});

test("without a GM exactly one connected owner of a shared actor is the authority", () => {
  const users = [
    { id: "b-player", active: true },
    { id: "a-player", active: true },
    { id: "c-offline", active: false }
  ];
  const party = actor("Actor.party", ["b-player", "a-player", "c-offline"]);
  const authorities = users
    .filter(user => user.active)
    .filter(user => {
      world({ me: user.id, users });
      return isAutomationAuthority(party);
    });
  assert.deepEqual(
    authorities.map(user => user.id),
    ["a-player"]
  );
});

test("without a GM the player whose character it is takes precedence", () => {
  const users = [
    { id: "a-player", active: true },
    { id: "z-player", active: true, character: { uuid: "Actor.hero" } }
  ];
  const hero = actor("Actor.hero", ["a-player", "z-player"]);
  world({ me: "a-player", users });
  assert.equal(automationAuthorityUser(hero).id, "z-player");
  assert.equal(isAutomationAuthority(hero), false);
  world({ me: "z-player", users });
  assert.equal(isAutomationAuthority(hero), true);
});

test("a non-owner is never the authority without a GM", () => {
  const users = [{ id: "p1", active: true }];
  world({ me: "p1", users });
  assert.equal(isAutomationAuthority(actor("Actor.npc", [])), false);
});
