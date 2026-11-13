import { FLAGS, MODULE_ID } from "./constants.mjs";
import { automationActors } from "../effects/temporary-effects.mjs";
import { listAutomationEvents, resolvePendingAutomation } from "./event-ledger.mjs";
import { inspectAutomation } from "./diagnostics.mjs";
import { chooseLeaderPresenceTargets } from "../classes/leader-presences.mjs";
import { presenceChoices } from "./leader-presence-definitions.mjs";
import { isAuraIncapacitated } from "./aura-conditions.mjs";
import { endInsectBloodDrain } from "../classes/insect-combat.mjs";
import { manageSummons } from "./summon-lifecycle.mjs";
import { sceneZones } from "./scene-zones.mjs";

export const canInspectActor = actor =>
  Boolean(actor && (game.user?.isGM || actor.testUserPermission?.(game.user, "OWNER")));
const escape = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const states = {
  queued: "Ожидает GM",
  running: "Выполняется / проверить после перезагрузки",
  "needs-review": "Нужна проверка",
  completed: "Выполнено",
  skipped: "Пропущено",
  cancelled: "Отменено"
};
export function panelEventRows(events, actorUuid = null) {
  if (!game.user?.isGM) return [];
  return events
    .filter(
      event =>
        (!actorUuid || event.sourceActorUuid === actorUuid) &&
        ["queued", "running", "needs-review"].includes(event.state)
    )
    .map(event => ({
      ...event,
      stateLabel: states[event.state],
      canApply:
        event.state === "queued" &&
        game.users?.activeGM?.id === game.user.id &&
        globalThis.canvas?.scene?.id === event.sceneId,
      canSkip: event.state === "queued" && game.users?.activeGM?.id === game.user.id
    }));
}
async function visibleName(uuid) {
  if (!uuid) return "—";
  const document = await fromUuid(uuid);
  if (!document) return "Недоступен";
  if (
    !game.user.isGM &&
    ((document.hidden && !canInspectActor(document.actor)) ||
      (document.actor && !document.actor.testUserPermission?.(game.user, "OBSERVER")))
  )
    return "Скрытый источник / цель";
  return document.name ?? document.actor?.name ?? "—";
}
export async function automationPanelData(actorOrUuid = null, actionHandlers = new Map()) {
  const filter = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
  if (actorOrUuid && !canInspectActor(filter)) throw Error("Нет доступа к этому персонажу.");
  const actors = (filter ? [filter] : automationActors()).filter(canInspectActor);
  const records = [],
    now = Number(game.time?.worldTime ?? 0);
  for (const actor of actors) {
    const report = await inspectAutomation(actor, { actionHandlers });
    for (const effect of report.effects) {
      const flags = effect.moduleFlags,
        benefit = flags.combatBenefit;
      if (!Object.keys(flags).length) continue;
      const category = benefit ? "Ограниченные бонусы" : flags[FLAGS.AURA_EFFECT] ? "Ауры / присутствия" : "Эффекты";
      const source = await visibleName(
        benefit?.sourceTokenUuid ?? flags[FLAGS.AURA_SOURCE] ?? flags.hollowWeakening?.sourceTokenUuid ?? effect.origin
      );
      records.push({
        category,
        name: effect.name,
        actor: actor.name,
        source,
        targets: actor.name,
        expires:
          effect.remainingSeconds === null ? (benefit?.expiry ?? "Без таймера") : `${effect.remainingSeconds} сек.`,
        remaining: benefit?.remaining ?? "—",
        reason:
          [
            ...effect.reasons,
            ...effect.warnings,
            ...(benefit?.reserved ? ["Ожидает подтверждения броска / урона"] : []),
            ...(benefit?.dash
              ? [
                  `Рывок: +${benefit.additionalMovement} ${benefit.movementUnits ?? "ft"} перемещения; прыжок в длину с разбега ${benefit.longJumpFeet} футов. Перемещение вручную.`
                ]
              : []),
            ...(flags.repeatSaveReview ? ["Спасбросок требует проверки"] : [])
          ].join(", ") || "Доступен",
        // Persistent passives and aura recipients cannot be ended here: the engine would recreate them.
        endUuid: benefit || flags.hollowWeakening || flags.repeatSave ? effect.uuid : null
      });
    }
    for (const record of presenceChoices(actor))
      records.push({
        category: "Присутствия Лидера",
        name: record.key,
        actor: actor.name,
        source: await visibleName(record.sourceTokenUuid),
        targets: (await Promise.all(record.targetUuids.map(visibleName))).join(", ") || "Нет выбранных союзников",
        expires: "Пока действует присутствие",
        remaining: "—",
        reason: isAuraIncapacitated(actor) ? "Лидер недееспособен" : "Доступен",
        presenceActor: actor.uuid,
        presenceKey: record.key
      });
    for (const summon of report.summons)
      records.push({
        category: "Призывы",
        name: summon.name,
        actor: actor.name,
        source: actor.name,
        targets: summon.name,
        expires:
          summon.lifecycle?.expiresAt != null ? `${Math.max(0, summon.lifecycle.expiresAt - now)} сек.` : "Без таймера",
        remaining: `${summon.hp}/${summon.maxHp} HP`,
        reason: summon.warnings.join(", ") || "Доступен",
        summonActor: actor.uuid
      });
    if (report.links.bloodDrain)
      records.push({
        category: "Высасывание крови",
        name: "Активная связь",
        actor: actor.name,
        source: actor.name,
        targets: await visibleName(report.links.bloodDrain.targetTokenUuid),
        expires: "Пока выполнены условия",
        remaining: "Раз в раунд",
        reason: "Проверяется дистанция и допустимость цели",
        drainActor: actor.uuid
      });
    for (const application of Object.values(report.nativeApplications ?? {}).filter(
      row => row.state === "needs-review"
    ))
      records.push({
        category: "Неподтверждённые применения",
        name: application.action,
        actor: actor.name,
        source: actor.name,
        targets: application.requestId,
        expires: "Ручная проверка, без автоматического повтора",
        remaining: "—",
        reason:
          application.error ??
          (application.expenseConfirmed
            ? "Расход подтверждён; результат требуется проверить"
            : "Midi не подтвердил расход или результат")
      });
    for (const item of report.items)
      for (const action of item.actions.filter(action => action.reasons.length))
        records.push({
          category: "Недоступные способности",
          name: `${item.name}: ${action.name}`,
          actor: actor.name,
          source: actor.name,
          targets: "—",
          expires: "—",
          remaining: item.resources.available ?? "—",
          reason: action.reasons.join(", ")
        });
  }
  for (const scene of game.scenes ?? [])
    for (const doc of sceneZones(scene)) {
      const flags = doc.flags?.[MODULE_ID] ?? {},
        sourceUuid = flags.sourceActor ?? flags.periodicZone?.sourceActorUuid;
      const sourceTokenUuid = flags.auraSource ?? flags.periodicZone?.sourceTokenUuid;
      const sourceToken = sourceTokenUuid && (await fromUuid(sourceTokenUuid));
      const owner = sourceUuid ? await fromUuid(sourceUuid) : sourceToken?.actor;
      if (!game.user.isGM && (!canInspectActor(owner) || doc.hidden)) continue;
      if (filter && owner?.uuid !== filter.uuid) continue;
      if (!flags.auraIndicator && !flags.zoneTemplate && !flags.periodicZone) continue;
      const expiresAt = flags.zoneExpiresAt ?? flags.periodicZone?.expiresAt;
      records.push({
        category: flags.auraIndicator ? "Трафареты аур" : "Зоны",
        name: doc.name ?? flags.zoneKey ?? "Область",
        actor: owner?.name ?? "—",
        source: await visibleName(sourceTokenUuid ?? sourceUuid),
        targets: scene.name,
        expires: expiresAt != null ? `${Math.max(0, expiresAt - now)} сек.` : "Пока активен источник",
        remaining: "—",
        reason: doc.hidden ? "Скрыта от игроков, механика действует" : "Доступна",
        zoneUuid: game.user.isGM && !flags.auraIndicator ? doc.uuid : null
      });
    }
  const pending = panelEventRows(await listAutomationEvents(), filter?.uuid);
  for (const event of pending) {
    event.sceneName = game.scenes?.get?.(event.sceneId)?.name ?? event.sceneId;
    event.sourceName = await visibleName(event.sourceTokenUuid ?? event.sourceActorUuid);
    event.targetNames = (
      await Promise.all((event.targetUuids ?? [event.targetTokenUuid].filter(Boolean)).map(visibleName))
    ).join(", ");
  }
  return { records, pending, actor: filter?.name ?? "Все доступные персонажи" };
}
function button(action, label, attributes = {}) {
  return `<button type="button" data-action="${action}" ${Object.entries(attributes)
    .map(([key, value]) => `data-${key}="${escape(value)}"`)
    .join(" ")}>${escape(label)}</button>`;
}
export function renderAutomationPanel(data) {
  const groups = [...new Set(data.records.map(record => record.category))];
  return `<section class="grimgutz-automation-panel"><p>${escape(data.actor)}. Обновление не меняет документы.</p>${button("refresh", "Обновить")}
    ${groups
      .map(
        category => `<h3>${escape(category)}</h3><table><thead><tr><th>Способность / источник</th><th>Цели</th><th>Срок / остаток</th><th>Состояние</th></tr></thead><tbody>
      ${data.records
        .filter(row => row.category === category)
        .map(
          row => `<tr><td>${escape(row.name)}<br><small>${escape(row.actor)} · ${escape(row.source)}</small></td>
      <td>${escape(row.targets)}</td><td>${escape(row.expires)}<br>${escape(row.remaining)}</td><td>${escape(row.reason)}
      ${row.presenceActor ? button("presence", "Получатели", { actor: row.presenceActor, key: row.presenceKey }) : ""}
      ${row.endUuid ? button("endEffect", "Снять", { uuid: row.endUuid }) : ""}
      ${row.zoneUuid ? button("endZone", "Удалить область", { uuid: row.zoneUuid }) : ""}
      ${row.summonActor ? button("summons", "Управлять", { actor: row.summonActor }) : ""}
      ${row.drainActor ? button("endDrain", "Прекратить", { actor: row.drainActor }) : ""}</td></tr>`
        )
        .join("")}</tbody></table>`
      )
      .join("")}
    <h3>Очередь событий (GM)</h3><p>Другая сцена: сначала откройте её. Неопределённый результат проверяется вручную, без автоматического повтора.</p>
    ${
      data.pending.length
        ? data.pending
            .map(
              event => `<article><strong>${escape(event.name ?? event.kind)}</strong> · ${escape(event.stateLabel)}
      <p>${escape(event.sceneName)} · ${escape(event.sourceName)} → ${escape(event.targetNames)}</p>
      ${event.error ? `<p>${escape(event.error)}</p>` : ""}${event.canApply ? button("applyEvent", "Провести", { event: event.id }) : ""}
      ${event.canSkip ? button("skipEvent", "Пропустить", { event: event.id }) : ""}</article>`
            )
            .join("")
        : "<p>Нет ожидающих событий.</p>"
    }</section>`;
}
let PanelClass,
  handlers = new Map();
export function automationPanelClass() {
  if (PanelClass) return PanelClass;
  PanelClass = class AutomationPanel extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "grimgutz-automation-panel",
      tag: "section",
      window: { title: "Гримуар — автоматизация", resizable: true },
      position: { width: 900, height: 650 },
      actions: {
        refresh() {
          return this.render({ force: true });
        },
        async applyEvent(_event, target) {
          await resolvePendingAutomation(target.dataset.event, "apply");
          await this.render({ force: true });
        },
        async skipEvent(_event, target) {
          await resolvePendingAutomation(target.dataset.event, "skip");
          await this.render({ force: true });
        },
        async presence(_event, target) {
          const actor = await fromUuid(target.dataset.actor);
          if (!canInspectActor(actor)) return;
          await chooseLeaderPresenceTargets(actor, target.dataset.key);
          await this.render({ force: true });
        },
        async endEffect(_event, target) {
          const effect = await fromUuid(target.dataset.uuid),
            flags = effect?.flags?.[MODULE_ID];
          if (canInspectActor(effect?.parent) && (flags?.combatBenefit || flags?.repeatSave || flags?.hollowWeakening))
            await effect.delete();
          await this.render({ force: true });
        },
        async endZone(_event, target) {
          if (!game.user.isGM) return;
          const doc = await fromUuid(target.dataset.uuid),
            flags = doc?.flags?.[MODULE_ID];
          if (flags?.zoneTemplate || flags?.periodicZone) await doc.delete();
          await this.render({ force: true });
        },
        async summons(_event, target) {
          const actor = await fromUuid(target.dataset.actor);
          if (canInspectActor(actor)) await manageSummons(actor);
          await this.render({ force: true });
        },
        async endDrain(_event, target) {
          const actor = await fromUuid(target.dataset.actor);
          if (canInspectActor(actor)) await endInsectBloodDrain(actor);
          await this.render({ force: true });
        }
      }
    };
    constructor(actorOrUuid = null) {
      super();
      this.actorOrUuid = typeof actorOrUuid === "string" || actorOrUuid?.documentName === "Actor" ? actorOrUuid : null;
    }
    async _prepareContext() {
      return automationPanelData(this.actorOrUuid, handlers);
    }
    async _renderHTML(context) {
      return renderAutomationPanel(context);
    }
    _replaceHTML(result, content) {
      content.innerHTML = result;
    }
  };
  return PanelClass;
}
export function openAutomationPanel(actorOrUuid = null) {
  return new (automationPanelClass())(actorOrUuid).render({ force: true });
}
export function registerAutomationPanel(actionHandlers) {
  handlers = actionHandlers;
  game.settings.registerMenu(MODULE_ID, "automationPanel", {
    name: "Панель автоматизации Гримуара",
    label: "Открыть панель",
    hint: "Ауры, зоны, призывы, бонусы и очередь событий GM.",
    icon: "fas fa-wand-magic-sparkles",
    type: automationPanelClass(),
    restricted: false
  });
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    if (canInspectActor(sheet.actor))
      buttons.unshift({
        class: "grimgutz-automation",
        label: "Гримуар",
        icon: "fas fa-wand-magic-sparkles",
        onclick: () => openAutomationPanel(sheet.actor)
      });
  });
  Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => {
    if (canInspectActor(sheet.actor))
      controls.push({
        action: "grimgutzAutomation",
        label: "Панель Гримуара",
        icon: "fas fa-wand-magic-sparkles",
        onClick: () => openAutomationPanel(sheet.actor)
      });
  });
}
