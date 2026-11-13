import { MODULE_ID } from "../shared/constants.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { findFeature } from "../shared/helpers.mjs";
import { ilRules, ilPatch, syncIllithid, inspectIllithid } from "./illithid.mjs";
import { ilGm } from "./illithid-use.mjs";
export async function configureIllithid(actor) {
  const gm = ilGm(actor),
    r = ilRules(actor),
    period = await askOwner(gm, {
      title: "GM: восстановление Псионического Превосходства",
      choices: [
        ["lr", "Продолжительный отдых (согласованное правило)"],
        ["manual", "Вручную (переопределение GM)"],
        ["sr", "Короткий или продолжительный отдых (переопределение GM)"]
      ],
      defaultValue: r.superiorityRecovery
    });
  if (!["manual", "lr", "sr"].includes(period)) return false;
  const choices = [
      ["none", "Без таймера и концентрации (согласованное правило)"],
      ["minute", "Минута, без концентрации"],
      ["concentration", "Минута с концентрацией"]
    ],
    pick = prefix => (r[`${prefix}Concentration`] ? "concentration" : r[`${prefix}Seconds`] ? "minute" : "none"),
    refuge = await askOwner(gm, { title: "GM: срок Ментального Убежища", choices, defaultValue: pick("refuge") });
  if (!choices.some(([v]) => v === refuge)) return false;
  const melody = await askOwner(gm, {
    title: "GM: срок Телекинетической Мелодии",
    choices,
    defaultValue: pick("melody")
  });
  if (!choices.some(([v]) => v === melody)) return false;
  await ilPatch(actor, {
    superiorityRecovery: period,
    refugeSeconds: refuge === "none" ? 0 : 60,
    refugeConcentration: refuge === "concentration",
    melodySeconds: melody === "none" ? 0 : 60,
    melodyConcentration: melody === "concentration"
  });
  const item = findFeature(actor, "illithid-superiority");
  if (item) await item.update({ "system.uses.recovery": period === "manual" ? [] : [{ period, type: "recoverAll" }] });
  return true;
}
export async function feedIllithid(actor) {
  if (
    !(await confirmOwner(
      ilGm(actor),
      "Питание подтверждено",
      "Только что действительно съеден мозг существа с INT не ниже 7? Начать новый недельный отсчёт; чужие эффекты и смерть не снимаются."
    ))
  )
    return false;
  await ilPatch(actor, { lastFedAt: Number(game.time.worldTime) });
  await syncIllithid(actor);
  return true;
}
export async function illithidHungerDeath(actor) {
  if (
    !inspectIllithid(actor).hungerDeathDue ||
    !(await confirmOwner(
      ilGm(actor),
      "Смерть от Голода Интеллекта",
      "Проверена характеристика 0 из-за этого голода? Отметить смерть, не удаляя персонажа и не сбрасывая HP/ресурсы."
    ))
  )
    return false;
  if (actor.toggleStatusEffect) await actor.toggleStatusEffect("dead", { active: true });
  else
    await actor.createEmbeddedDocuments("ActiveEffect", [
      {
        name: "Голод Интеллекта: смерть",
        type: "base",
        statuses: ["dead"],
        transfer: false,
        disabled: false,
        flags: { [MODULE_ID]: { illithidHungerDeath: true } },
        system: { changes: [] }
      }
    ]);
  return true;
}
export async function watchIllithidSupreme(actor) {
  const spells = [...(actor.items ?? [])].filter(i => i.type === "spell"),
    uuid = await askOwner(ilGm(actor), {
      title: "GM: конкретное заклинание очарования/испуга",
      choices: spells.map(i => [i.uuid, i.name])
    }),
    spell = spells.find(i => i.uuid === uuid);
  if (!spell) return false;
  const activities = [...spell.system.activities.values()],
    id =
      activities.length === 1
        ? activities[0].id
        : await askOwner(ilGm(actor), {
            title: "Конкретная активность очарования/испуга",
            choices: activities.map(a => [a.id, a.name])
          }),
    activity = activities.find(a => a.id === id);
  if (!activity) return false;
  const conditions = await askOwner(ilGm(actor), {
    kind: "checkbox",
    title: "Какие состояния действительно вызывает выбранная активность?",
    min: 1,
    max: 2,
    choices: [
      ["charmed", "Очарование"],
      ["frightened", "Испуг"]
    ]
  });
  if (!conditions?.length || conditions.some(s => !["charmed", "frightened"].includes(s))) return false;
  await ilPatch(actor, { supremeWatch: { spellUuid: uuid, activityUuid: activity.uuid, conditions } });
  return true;
}
