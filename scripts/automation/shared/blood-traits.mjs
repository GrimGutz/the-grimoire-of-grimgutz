import { MODULE_ID } from "./constants.mjs";
import { choiceDialog } from "./dialogs.mjs";
import { isGmAuthority } from "./gm-requests.mjs";
export async function creatureHasBlood(actor) {
  const known = actor.getFlag(MODULE_ID, "hasBlood");
  if (typeof known === "boolean") return known;
  if (!isGmAuthority()) throw Error("Наличие крови подтверждает GM.");
  const answer = await choiceDialog({ title: "Наличие крови (GM)", label: `У существа «${actor.name}» есть кровь?`,
    choices: [["yes", "Да"], ["no", "Нет"]], defaultValue: "no" });
  if (answer == null) return null;
  await actor.setFlag(MODULE_ID, "hasBlood", answer === "yes"); return answer === "yes";
}
