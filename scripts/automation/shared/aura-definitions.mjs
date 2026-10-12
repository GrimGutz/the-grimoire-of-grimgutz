import { FLAGS, MODULE_ID } from "./constants.mjs";
import { findFeature } from "./helpers.mjs";
import { isEffectActive } from "../effects/temporary-effects.mjs";
import { isAuraDefeated, isAuraIncapacitated } from "./aura-conditions.mjs";
import { LEADER_PRESENCE_DEFINITIONS } from "./leader-presence-definitions.mjs";
import {doomedGiftActive,doomedEmpowered} from "./doomed-state.mjs";
export { isAuraDefeated, isAuraIncapacitated } from "./aura-conditions.mjs";

export function auraFeature(actor, definition) {
  return (definition.sourceFeatures ?? [definition.sourceFeature ?? definition.activityFeature]).filter(Boolean).map(key => findFeature(actor, key)).find(Boolean);
}
export function carnageDamageType(actor) {
  const type = actor?.getFlag?.(MODULE_ID, "carnageAuraDamageType") ?? actor?.flags?.[MODULE_ID]?.carnageAuraDamageType;
  return ["bludgeoning", "piercing", "slashing"].includes(type) ? type : null;
}
const change = (key, value, type = "add") => ({ key, value: String(value), type, phase: "initial", priority: 20 });

export const AURA_DEFINITIONS = [
  ...LEADER_PRESENCE_DEFINITIONS,
  ...[false,true].flatMap(empowered=>[
    {id:`doomed-cold-${empowered?"empowered":"normal"}`,name:"Мёртвый холод",radius:empowered?20:10,indicatorColor:"#7ebfd4",
      sourceFeature:"doomed-curse-cold",affects:"enemies",
      sourceCondition:token=>doomedGiftActive(token.actor,"cold")&&!isAuraIncapacitated(token.actor)&&!isAuraDefeated(token)&&doomedEmpowered(token.actor,"cold")===empowered,
      events:[{trigger:"targetStart",damage:[{formula:empowered?"2d8":"1d8",type:"cold"}]}]},
    {id:`doomed-outcast-${empowered?"empowered":"normal"}`,name:"Клеймо отверженного",radius:empowered?15:5,indicatorColor:"#8558b5",
      sourceFeature:"doomed-curse-outcast",affects:"enemies",
      sourceCondition:token=>doomedGiftActive(token.actor,"outcast")&&!isAuraIncapacitated(token.actor)&&!isAuraDefeated(token)&&doomedEmpowered(token.actor,"outcast")===empowered}
  ]),
  {
    id: "hollow-masking-aura", name: "Аура маскировки", radius: 10, indicatorColor: "#b7d6e8",
    sourceFeature: "masking-aura", sourceEffectFlag: FLAGS.HOLLOW_PASSIVE, sourceEffectValue: "masking-aura",
    affects: "allies", stacking: "highest",
    effect: token => ({ name: "Аура маскировки: бонус спасбросков", img: findFeature(token.actor, "masking-aura")?.img,
      description: "Бонус союзнику от Полого. Магическое обнаружение разрешает Мастер.",
      changes: [change("system.bonuses.abilities.save", token.actor.system?.abilities?.con?.mod ?? 0)] })
  },
  {
    id: "death-knight-battle-undead", name: "Боевая нежить", radius: 60, indicatorColor: "#50c878",
    sourceFeature: "battle-undead", affects: "selfAndAllies", targetType: "undead",
    sourceCondition: token => !isAuraDefeated(token) && !isAuraIncapacitated(token.actor),
    effect: token => ({ name: "Боевая нежить: в ауре", img: findFeature(token.actor, "battle-undead")?.img,
      description: "Преимущество только против эффектов, направленных непосредственно против нежити; подтвердите его при таком спасброске.", changes: [] })
  },
  {
    id: "spirit-vessel-fiend-flames", name: "Пламя исчадия", radius: 5, indicatorColor: "#ff5a36",
    activityFeature: "spirit-fiend", sourceEffectFlag: FLAGS.SPIRIT_VESSEL_FIEND_FLAMES_EFFECT, affects: "nonSelf",
    events: [{ trigger: "sourceStart", damage: [{ formula: "1d6", type: "fire" }] },
      { trigger: "meleeAttempt", damage: [{ formula: "1d6", type: "fire" }] }]
  },
  {
    id: "crusader-divine-devotion", name: "Божественная преданность", radius: 30, indicatorColor: "#f6d67b",
    sourceFeature: "divine-devotion", affects: "allies", sourceCondition: token => !isAuraDefeated(token),
    effect: token => ({ name: "Божественная преданность: спасброски от смерти", img: findFeature(token.actor, "divine-devotion")?.img,
      changes: [change("flags.midi-qol.advantage.deathSave", "true", "override")] })
  },
  {
    id: "demonologist-vitality", name: "Демоническая живучесть", radius: 5, indicatorColor: "#e33e22",
    activityFeature: "demonic-vitality", sourceEffectFlag: FLAGS.DEMONOLOGIST_VITALITY_EFFECT, affects: "nonSelf",
    events: [{ trigger: "meleeAttempt", requiresInside: true, damage: [{ formula: "3d10", type: "fire" }], ignoreTraits: ["idr.fire"] }]
  },
  {
    id: "murderspawn-carnage", name: "Аура резни", radius: 15, indicatorColor: "#aa143c",
    sourceFeature: "aura-of-carnage", affects: "all",
    sourceCondition: token => !isAuraDefeated(token) && !token.actor.statuses?.has?.("unconscious")
      && ![...(token.actor.effects ?? [])].some(effect => isEffectActive(effect) && effect.statuses?.has?.("unconscious")),
    effect: token => {
      const type = carnageDamageType(token.actor);
      return type ? { name: "Аура резни: уязвимость", img: findFeature(token.actor, "aura-of-carnage")?.img,
        changes: [change("system.traits.dv.value", type)] } : null;
    }
  },
  {
    id: "devil-devastated-souls", name: "Аура опустошённых душ", radius: 60, indicatorColor: "#7941a7",
    sourceFeatures: ["aura-of-devastated-souls", "аура-опустоше-нных-душ-6"], affects: "nonSelf",
    sourceCondition: token => !isAuraDefeated(token), events: [{ trigger: "death", temporaryHpBySize: true }]
  },
  {
    id: "npc-plague-infection", name: "Аура заражения", radius: 30, indicatorColor: "#91a92c",
    sourceFeature: "аура-заражения-10", affects: "enemies", sourceCondition: token => !isAuraDefeated(token),
    events: [{ trigger: "targetStart", save: "con", dc: "15", damage: [], onSave: "none",
      condition: { name: "Скрытая чума интеллекта", key: "hidden-intellect-plague", persistent: true, changes: [] } }]
  },
  {
    id: "gutz-enlightenment", name: "Аура Просвещения", radius: 30, indicatorColor: "#d7be62",
    sourceFeature: "аура-просвещения-1", affects: "selfAndAllies", stacking: "highest",
    sourceCondition: token => !isAuraDefeated(token),
    effect: token => ({ name: "Аура Просвещения: проверки", img: findFeature(token.actor, "аура-просвещения-1")?.img,
      changes: [change("system.bonuses.abilities.check", token.actor.system?.abilities?.cha?.mod ?? 0)] })
  },
  {
    id: "npc-leader-command", name: "Аура командования", radius: 60, indicatorColor: "#659ee7",
    sourceFeature: "тактическое-присутствие-аура-командования-1", affects: "selfAndAllies", stacking: "highest",
    sourceCondition: token => !isAuraDefeated(token) && !isAuraIncapacitated(token.actor),
    targetCondition: (_source, target) => !(target.actor.statuses?.has?.("blinded") && target.actor.statuses?.has?.("deafened")),
    effect: token => ({ name: "Аура командования: инициатива", img: findFeature(token.actor, "тактическое-присутствие-аура-командования-1")?.img,
      description: "Требуется видеть или слышать Лидера. Дополнительные 3 урона один раз за ход подтверждает Мастер.",
      changes: [change("system.attributes.init.bonus", token.actor.system?.abilities?.int?.mod ?? 0)] })
  }
];
