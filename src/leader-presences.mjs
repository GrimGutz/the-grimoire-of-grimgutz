import { utilityActivity } from "./common.mjs";
import { LEADER_PRESENCE_KEYS } from "../scripts/automation/shared/leader-presence-definitions.mjs";
export function configureLeaderPresenceCards(documents) {
  for (const card of documents) {
    const key = card.system.identifier;
    if (!LEADER_PRESENCE_KEYS.includes(key)) continue;
    Object.assign(card.system.activities, utilityActivity({ key: `choose-${key}-recipients`, name: "Выбрать получателей присутствия",
      action: "choose-leader-presence-targets", actionData: { leaderPresenceKey: key }, activation: "special", spellSlot: false }));
  }
  return documents;
}
