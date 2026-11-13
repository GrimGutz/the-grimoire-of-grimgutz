import { FLAGS, MODULE_ID, SETTINGS } from "../shared/constants.mjs";
import {
  automationData,
  findFeature,
  hasFeature,
  isAutomationAuthority,
  itemIdentifier,
  itemUses,
  notify
} from "../shared/helpers.mjs";
import { flaggedPassiveEffectData, syncFlaggedPassiveEffects } from "../effects/passive-helpers.mjs";
import { createSummonedCreature } from "../shared/summons.mjs";
import { ghostWalkerSpiritSummon } from "../shared/summon-templates.mjs";

const ghostWalkerSyncs = new Set();
const ghostWalkerPassiveSyncs = new Set();

export function ghostWalkerClass(actor) {
  return actor?.items?.find(item => item.type === "class" && itemIdentifier(item) === "ghost-walker");
}

export function ghostWalkerLevel(actor) {
  return Number(ghostWalkerClass(actor)?.system?.levels ?? 0);
}

function hasSkillProficiency(actor, key) {
  const skill = actor?.system?.skills?.[key];
  const value = Number(skill?.value ?? skill?.proficient ?? 0);
  return value > 0 || skill?.proficient === true;
}

export function ghostWalkerPrerequisiteFailures(actor) {
  const failures = [];
  if (Number(actor?.system?.abilities?.con?.value ?? 0) < 13) failures.push("Телосложение 13");
  if (Number(actor?.system?.abilities?.cha?.value ?? 0) < 13) failures.push("Харизма 13");
  if (Number(actor?.system?.details?.level ?? 0) < 5) failures.push("5-й уровень персонажа");
  if (!hasSkillProficiency(actor, "arc") && !hasSkillProficiency(actor, "rel")) {
    failures.push("владение навыком Магия или Религия");
  }
  return failures;
}

export function validateGhostWalkerPrerequisites(item, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  if (!actor || item.type !== "class" || itemIdentifier(item) !== "ghost-walker") return true;
  const failures = ghostWalkerPrerequisiteFailures(actor);
  if (failures.length) {
    notify(
      `Нельзя добавить класс «Призрачный Странник». Не выполнено: ${failures.join(", ")}. Событие встречи со смертью подтверждает Мастер.`,
      "error"
    );
    return false;
  }
  return true;
}

export function validateGhostWalkerFeaturePrerequisites(item, options, userId) {
  if (userId !== game.user.id || !game.settings.get(MODULE_ID, SETTINGS.STRICT_PREREQUISITES)) return true;
  const actor = item.parent;
  const data = automationData(item);
  if (!actor || data.ghostWalkerFeature !== true || options?.isAdvancement) return true;
  const level = ghostWalkerLevel(actor);
  if (!level) {
    notify(`Особенность «${item.name}» требует класс «Призрачный Странник».`, "error");
    return false;
  }
  const requiredLevel = Number(data.minimumLevel ?? item.system?.prerequisites?.level ?? 0);
  if (requiredLevel && level < requiredLevel) {
    notify(`Особенность «${item.name}» требует ${requiredLevel}-й уровень Призрачного Странника.`, "error");
    return false;
  }
  return true;
}

function spiritFormUses(level) {
  if (level >= 5) return 4;
  if (level >= 3) return 3;
  if (level >= 1) return 2;
  return 0;
}

function currentMax(item) {
  return String(item?.system?.uses?.max ?? "");
}

async function syncUses(feature, maximum) {
  if (!feature) return false;
  const max = String(Math.max(0, maximum));
  const spent = Number(feature.system?.uses?.spent ?? 0);
  const update = {};
  if (currentMax(feature) !== max) update["system.uses.max"] = max;
  if (Number.isFinite(spent) && spent > Number(max)) update["system.uses.spent"] = Number(max);
  if (!Object.keys(update).length) return false;
  await feature.update(update);
  return true;
}

export async function syncGhostWalkerResources(actor, { notifyResult = false } = {}) {
  if (!actor?.isOwner || !isAutomationAuthority(actor) || ghostWalkerSyncs.has(actor.uuid)) return false;
  const level = ghostWalkerLevel(actor);
  if (!level) return false;

  ghostWalkerSyncs.add(actor.uuid);
  try {
    const updates = [
      await syncUses(findFeature(actor, "spirit-form"), spiritFormUses(level)),
      await syncUses(findFeature(actor, "otherworldly-presence"), 1),
      await syncUses(findFeature(actor, "unfinished-business"), 1)
    ];
    const changed = updates.some(Boolean);
    if (notifyResult && changed) notify(`${actor.name}: ресурсы Призрачного Странника синхронизированы.`);
    return changed;
  } finally {
    ghostWalkerSyncs.delete(actor.uuid);
  }
}

function spiritFormEffect(actor) {
  return actor?.effects?.find(effect => effect.getFlag(MODULE_ID, FLAGS.SPIRIT_FORM_EFFECT));
}

export async function activateSpiritForm(actor) {
  if (!actor || !ghostWalkerClass(actor)) {
    notify("Эта активность требует класс «Призрачный Странник».", "warn");
    return false;
  }
  const feature = findFeature(actor, "spirit-form");
  if (!feature) {
    notify("Для Формы Духа требуется особенность «Форма Духа».", "warn");
    return false;
  }

  const changes = [
    {
      key: "system.traits.dr.value",
      type: "custom",
      value: "necrotic",
      phase: "initial",
      priority: 20
    }
  ];
  const data = {
    name: "Форма Духа",
    img: feature.img,
    origin: feature.uuid,
    transfer: false,
    disabled: false,
    showIcon: 1,
    statuses: [],
    flags: {
      [MODULE_ID]: {
        [FLAGS.SPIRIT_FORM_EFFECT]: true
      }
    },
    duration: {
      seconds: 60,
      startTime: game.time?.worldTime ?? 0
    },
    system: { changes }
  };

  const current = spiritFormEffect(actor);
  if (current) await current.update(data);
  else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  notify(`${actor.name}: активирована «Форма Духа» на 1 минуту.`);
  return true;
}

export async function endSpiritForm(actor) {
  const effect = spiritFormEffect(actor);
  if (!effect || !actor?.isOwner) return false;
  await effect.delete();
  notify(`${actor.name}: «Форма Духа» завершена.`);
  return true;
}

export function validateSpiritFormUse(actor, activity) {
  if (!actor || !ghostWalkerClass(actor)) {
    notify("Эта активность требует класс «Призрачный Странник».", "warn");
    return false;
  }
  const feature = activity?.item ?? activity?.parent ?? findFeature(actor, "spirit-form");
  const uses = itemUses(feature);
  if (feature && uses.remaining > 0) return true;
  notify("Недостаточно использований «Формы Духа». Завершите продолжительный отдых.", "warn");
  return false;
}

function selectedTargetActor() {
  const targets = [...(game.user?.targets ?? [])];
  return targets[0]?.actor ?? null;
}

export function validateGhostWalkerSummonUse(actor, activity) {
  if (!actor || !ghostWalkerClass(actor)) {
    notify("Эта активность требует класс «Призрачный странник».", "warn");
    return false;
  }
  const feature = activity?.item ?? activity?.parent ?? findFeature(actor, "unfinished-business");
  const uses = itemUses(feature);
  if (feature && uses.remaining > 0) return true;
  notify("Недостаточно использований «Незавершённого дела». Завершите продолжительный отдых.", "warn");
  return false;
}

export async function summonUnfinishedBusinessSpirit(actor, activity, { consumed = false } = {}) {
  if (!actor || !ghostWalkerClass(actor)) return false;
  if (!consumed && !validateGhostWalkerSummonUse(actor, activity)) return false;
  const feature = activity?.item ?? activity?.parent ?? findFeature(actor, "unfinished-business");
  if (!feature) return false;
  return createSummonedCreature(actor, ghostWalkerSpiritSummon(actor, selectedTargetActor()), {
    requireScene: true,
    resource: { itemUuid: feature.uuid, cost: 1, consumed }
  });
}

function ghostWalkerPassiveDefinitions(actor) {
  if (!ghostWalkerClass(actor)) return [];
  const definitions = [];

  const ghostStep = findFeature(actor, "ghost-step");
  const walk = Number(actor?.system?.attributes?.movement?.walk ?? 0);
  if (ghostStep && Number.isFinite(walk) && walk > 0) {
    definitions.push(
      flaggedPassiveEffectData(MODULE_ID, FLAGS.GHOST_WALKER_PASSIVE, {
        key: "ghost-step",
        feature: ghostStep,
        changes: [
          {
            key: "system.attributes.movement.fly",
            type: "upgrade",
            value: String(walk),
            phase: "final",
            priority: 20
          }
        ]
      })
    );
  }

  return definitions;
}

export async function syncGhostWalkerPassiveEffects(actor) {
  if (!actor?.isOwner || !isAutomationAuthority(actor)) return;
  return syncFlaggedPassiveEffects(
    actor,
    ghostWalkerPassiveSyncs,
    MODULE_ID,
    FLAGS.GHOST_WALKER_PASSIVE,
    ghostWalkerPassiveDefinitions
  );
}
