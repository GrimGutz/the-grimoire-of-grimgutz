import { MODULE_ID } from "../shared/constants.mjs";
import { FACTORY_AREAS } from "../shared/factory-definitions.mjs";
import { FACTORY_AUGMENTS } from "../shared/factory-augments.mjs";
import {
  factoryHas,
  factoryState,
  factoryRecords,
  patchFactory,
  factoryInstallFailures,
  factoryInstalledItem,
  factoryLevel,
  factoryDC,
  factoryCharacterLevel
} from "./factory.mjs";
import { syncFactory } from "./factory-passives.mjs";
import { factoryUpgradeItem, factoryItemFingerprint } from "./factory-items.mjs";
import { factoryGm, factoryTargets, factoryExpense } from "./factory-use.mjs";
import { askOwner, confirmOwner } from "../shared/owner-prompts.mjs";
import { applyNativeOnce } from "../shared/native-applications.mjs";
import { useNativeUtility } from "../shared/native-actions.mjs";
import { serialMutation } from "../shared/transactions.mjs";
export async function factoryRestTicket(actor, kind) {
  const key = kind === "short" ? "shortRest" : "longRest",
    known = factoryState(actor)[key];
  if (known && !known.used) return known;
  if (
    !(await confirmOwner(
      factoryGm(actor),
      kind === "short" ? "GM: конец нового короткого отдыха" : "GM: конец нового продолжительного отдыха",
      "Новый соответствующий отдых завершён, но нативная запись ещё не была зарегистрирована? Это не выдача повторной операции за уже использованный отдых."
    ))
  )
    return null;
  const ticket = { id: foundry.utils.randomID(), at: Number(game.time.worldTime), used: false, manual: true };
  await patchFactory(actor, { [key]: ticket });
  return ticket;
}
async function configure(owner, target, def) {
  const data = {};
  if (def.id === "neural") {
    data.save = await askOwner(owner, {
      title: "Спасбросок Неврологических имплантов",
      choices: ["str", "dex", "con", "int", "wis", "cha"].map(id => [id, id.toUpperCase()])
    });
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(data.save)) return null;
  }
  if (def.id === "transplant") {
    const allowed = Object.keys(CONFIG.DND5E.damageTypes ?? {}).filter(
      t => !["psychic", "healing", "temphp", "maximum", "midi-none", "none"].includes(t)
    );
    data.damageType = await askOwner(owner, {
      title: "Сопротивление трансплантации (не психическое)",
      choices: allowed.map(t => [t, t])
    });
    if (!allowed.includes(data.damageType)) return null;
  }
  if (["fangs", "mantis"].includes(def.id)) {
    data.ability = await askOwner(owner, {
      title: "Характеристика встроенного оружия",
      choices: [
        ["int", "Интеллект создателя"],
        ["str", "Сила получателя"]
      ]
    });
    if (!["int", "str"].includes(data.ability)) return null;
  }
  if (def.id === "sturdy" && !factoryCharacterLevel(target)) {
    data.recipientLevel = await askOwner(factoryGm(owner), {
      kind: "number",
      title: "GM: уровень получателя без карточек классов",
      min: 0,
      max: 100,
      defaultValue: 0
    });
    if (!Number.isFinite(data.recipientLevel) || data.recipientLevel < 0) return null;
  }
  return data;
}
export async function installFactoryUpgrade(owner, activity, source, requestId) {
  const targets = await factoryTargets(owner, source, 1000000, "Согласный получатель улучшения", { self: true }),
    target = targets?.[0];
  if (!target) return false;
  const records = factoryRecords(target.actor),
    replaceId = await askOwner(owner, {
      title: "Новое улучшение или замена одного",
      choices: [
        ["new", "Новое — нужен свободный слот"],
        ...records
          .filter(r => r.ownerUuid === owner.uuid)
          .map(r => [r.id, `Заменить: ${FACTORY_AUGMENTS.find(a => a.id === r.augmentId)?.name ?? r.augmentId}`])
      ]
    });
  if (!replaceId) return false;
  const replaced = records.find(r => r.id === replaceId);
  if (replaceId !== "new" && !replaced) return false;
  const area = await askOwner(owner, { title: "Область тела", choices: Object.entries(FACTORY_AREAS) });
  if (!Object.hasOwn(FACTORY_AREAS, area)) return false;
  const candidates = FACTORY_AUGMENTS.filter(
      a =>
        a.area === area &&
        (a.tier === 1 ||
          (a.tier === 3 && factoryHas(owner, "sculptor")) ||
          (a.tier === 4 && factoryHas(owner, "deus"))) &&
        (!replaced || replaced.augmentId !== a.id)
    ),
    id = await askOwner(owner, {
      title: "Улучшение и стоимость компонентов",
      choices: candidates.map(a => [a.id, `${a.name} — ${a.cost} зм`])
    }),
    def = candidates.find(a => a.id === id);
  if (!def) return false;
  const errors = factoryInstallFailures(owner, target.actor, def, replaced?.id);
  if (errors.length) throw Error(errors.join("; "));
  const config = await configure(owner, target.actor, def);
  if (!config) return false;
  const ticket = await factoryRestTicket(owner, "short");
  if (!ticket) return false;
  const gold = Number(owner.system.currency?.gp ?? 0);
  if (gold < def.cost) throw Error(`Нужно ${def.cost} зм компонентов. Другие монеты модуль не меняет автоматически.`);
  if (
    !(await confirmOwner(
      factoryGm(owner),
      "GM: установка улучшения",
      `Конец SR, получатель согласен и действительно доступен для операции; компоненты подготовлены? Списать ${def.cost} зм с создателя и занять слот ${FACTORY_AREAS[area]}. Замена не восстанавливает ресурсы других карточек.`
    ))
  )
    return false;
  return applyNativeOnce(
    owner,
    { requestId, action: "factory-install", activityUuid: activity.uuid },
    () => useNativeUtility(activity, { dataPatch: factoryExpense(activity, { activation: "special" }) }),
    () =>
      serialMutation(`factory-install:${target.actor.uuid}`, async () => {
        if (factoryState(owner).shortRest?.id !== ticket.id || factoryState(owner).shortRest.used)
          throw Error("Операция этого SR уже выполнена.");
        const current = factoryRecords(target.actor),
          again = factoryInstallFailures(owner, target.actor, def, replaced?.id);
        if (again.length) throw Error(again.join("; "));
        const beforeGold = Number(owner.system.currency?.gp ?? 0);
        if (beforeGold < def.cost) throw Error("Золото уже потрачено.");
        const record = {
            id: foundry.utils.randomID(),
            ownerUuid: owner.uuid,
            augmentId: def.id,
            createdAt: Number(game.time.worldTime),
            sourceTokenUuid: source.uuid,
            ...config,
            snapshot: {
              int: Number(owner.system.abilities.int.mod),
              tier: factoryLevel(owner),
              prof: Number(owner.system.attributes.prof),
              dc: factoryDC(owner),
              imperfections: factoryHas(owner, "imperfections")
            }
          },
          next = [...current.filter(r => r.id !== replaced?.id), record];
        let made,
          paid = false,
          written = false;
        try {
          await owner.update({ "system.currency.gp": beforeGold - def.cost });
          paid = true;
          [made] = await target.actor.createEmbeddedDocuments("Item", [factoryUpgradeItem(target.actor, record)]);
          if (!made) throw Error("Карточка улучшения не создана.");
          await made.setFlag(MODULE_ID, "factoryManagedFingerprint", factoryItemFingerprint(made));
          await target.actor.setFlag(MODULE_ID, "factoryAugments", next);
          written = true;
        } catch (error) {
          const rollback = [];
          if (made)
            try {
              await made.delete();
            } catch (e) {
              rollback.push(e.message);
            }
          if (written && JSON.stringify(factoryRecords(target.actor)) === JSON.stringify(next))
            await target.actor.setFlag(MODULE_ID, "factoryAugments", current);
          if (paid && Number(owner.system.currency?.gp) === beforeGold - def.cost && !rollback.length)
            await owner.update({ "system.currency.gp": beforeGold });
          return { status: "needs-review", error: error.message, rollback };
        }
        await patchFactory(owner, {
          lastAugmentAt: Number(game.time.worldTime),
          shortRest: { ...ticket, used: true, requestId }
        });
        if (replaced) {
          const old = factoryInstalledItem(target.actor, replaced);
          if (old && old.getFlag(MODULE_ID, "factoryManagedFingerprint") === factoryItemFingerprint(old))
            await old.delete();
        }
        await syncFactory(target.actor);
        if (owner.uuid !== target.actor.uuid) await syncFactory(owner);
        return true;
      })
  );
}
export async function removeFactoryUpgrade(owner, source) {
  const targets = await factoryTargets(factoryGm(owner), source, 1000000, "GM: получатель удаляемого улучшения", {
      self: true
    }),
    target = targets?.[0];
  if (!target) return false;
  const options = factoryRecords(target.actor).filter(r => r.ownerUuid === owner.uuid),
    id = await askOwner(factoryGm(owner), {
      title: "Снять только собственное улучшение",
      choices: options.map(r => [r.id, FACTORY_AUGMENTS.find(a => a.id === r.augmentId)?.name ?? r.augmentId])
    }),
    record = options.find(r => r.id === id);
  if (!record) return false;
  if (
    !(await confirmOwner(
      factoryGm(owner),
      "Удаление улучшения (GM)",
      "Подтверждён демонтаж, без возврата золота и без сброса зависимости как за новое улучшение? Ручные правки карточки будут сохранены для проверки."
    ))
  )
    return false;
  const item = factoryInstalledItem(target.actor, record);
  if (item && item.getFlag(MODULE_ID, "factoryManagedFingerprint") === factoryItemFingerprint(item))
    await item.delete();
  await target.actor.setFlag(
    MODULE_ID,
    "factoryAugments",
    factoryRecords(target.actor).filter(r => r.id !== id)
  );
  await syncFactory(target.actor);
  return true;
}
