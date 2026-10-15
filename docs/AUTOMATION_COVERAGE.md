# Реестр покрытия автоматизации

Сгенерирован `npm run coverage`. Включает все карточки семи библиотек и вложенные особенности NPC.

Это консервативный статический реестр, не сертификат живой проверки: регистрация функции доказывает её наличие, но не полноту правила. «Требует исправления» также означает отсутствие подтверждённой связи с runtime: сначала проверять конкретную способность, не создавать пустой эффект. «Частично» включает намеренно сохраняемые решения игрока/GM. Нативные поля проверены валидатором; ссылки на тесты указывают проверяемый механизм, не обещают отдельный игровой сценарий каждой карточки.

- автоматизировано: 300
- частично: 551
- обоснованно вручную: 177
- требует исправления: 362

Полные основания и замечания: [AUTOMATION_COVERAGE.json](AUTOMATION_COVERAGE.json).

| Библиотека / карточка | Статус | Обработчики | Проверки |
| --- | --- | --- | --- |
| classes / Сокрушитель | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Лидер | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Рыцарь смерти | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Еретик | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Лесной владыка | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Абберант | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Ведьмин клинок | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Джаггернаут | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Пожиратель душ | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Страж / Guardian | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Крестоносец / Crusader | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Воитель фей / Fey Warrior | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Призрачный Странник / Ghost Walker | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Мерцающий / Blinker | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Падший жрец / Fallen Priest | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Чумной маг / Plague Doctor | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Владыка насекомых / Insect Lord | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Харроуер / Gambler | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Хранитель / Keeper | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Маг крови | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Онмёджи / Onmyoji | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Ритуалист / Ritualist | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Воин тьмы / Dark Warrior | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Дьяволопоклонник / Devil Worshipper | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Нетерильский арканист / Netherese Arcanist | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Сосуд Духа / Spirit Vessel | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Оракул / Oracle | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Демонолог / Demonologist | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Сангвинист / Sanguinist | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Мастер / Master | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Охотник за головами / Bounty Hunter | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Арлекин / Jester | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Самобичеватель / Flagellant | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Обречённый / Doomed | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Кошмар / Nightmare | частично | dnd5e:Advancement | tests/progression.test.mjs |
| classes / Эмпат / Empath | частично | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Создатель големов | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Искатель мифов | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Духовный медиум | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Дикий укротитель | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Школа стали | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Абберация | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Небожитель / Celestial | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Элементаль: Земля | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Элементаль: Воздух | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Элементаль: Огонь | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Элементаль: Вода | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Фея | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Исчадие | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Нежить | автоматизировано | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Путь Клинка | частично | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Путь Стрелка | частично | dnd5e:Advancement | tests/progression.test.mjs |
| subclasses / Путь Арканы | частично | dnd5e:Advancement | tests/progression.test.mjs |
| transformations / Трансформация: Порождение убийств / Murderspawn | частично | dnd5e:Advancement | tests/progression.test.mjs |
| transformations / Трансформация: Полый / Hollow | частично | dnd5e:Advancement | tests/progression.test.mjs |
| transformations / Трансформация: Присутствие / Arkane | частично | module:arkane-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Автоматон | частично | module:automaton-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Королева Улья | частично | module:broodmother-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Химера | частично | module:chimera-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Рыцарь Смерти | частично | module:deathknight-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Дуллахан | частично | module:dullahan-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Фабрика | частично | module:factory-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Божество | частично | module:god-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| transformations / Трансформация: Ведьма | частично | module:hag-control, dnd5e:Advancement | tests/registrations.test.mjs, tests/progression.test.mjs |
| features / Стиль огромного оружия | частично | module:toggle-gwm | tests/registrations.test.mjs |
| features / Раскалывание | частично | module:set-style-cleaving | tests/registrations.test.mjs |
| features / Сокрушение | частично | module:set-style-crushing | tests/registrations.test.mjs |
| features / Убийца гигантов | требует исправления | — | нужна отдельная проверка |
| features / Техники Сокрушителя | требует исправления | — | нужна отдельная проверка |
| features / Импульс | требует исправления | — | нужна отдельная проверка |
| features / Стальная воля | частично | module:arm-steel-will | tests/registrations.test.mjs |
| features / Стальной гигант | частично | module:sync-steel-giant | tests/registrations.test.mjs |
| features / Адаптивность | частично | module:toggle-style | tests/registrations.test.mjs |
| features / Превосходный контроль | требует исправления | — | нужна отдельная проверка |
| features / Мощное сокрушение | требует исправления | — | нужна отдельная проверка |
| features / Мощное раскалывание | требует исправления | — | нужна отдельная проверка |
| features / Несокрушимость | требует исправления | — | нужна отдельная проверка |
| features / Кузнечное ремесло | частично | module:smithing | tests/registrations.test.mjs |
| features / Сокрушение гигантов | требует исправления | — | нужна отдельная проверка |
| features / Боевая тренировка | частично | module:school-steel-choose-weapons, module:school-steel-bonus-attack | tests/registrations.test.mjs |
| features / Калечащие удары | частично | dnd5e:utility | tools/validate.mjs |
| features / Мастер металла | частично | module:sync-school-steel | tests/registrations.test.mjs |
| features / Фирменный приём | требует исправления | — | нужна отдельная проверка |
| features / Стальной шторм | требует исправления | — | нужна отдельная проверка |
| features / Имперская досягаемость | требует исправления | — | нужна отдельная проверка |
| features / Металлист | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Стратагемы командования | требует исправления | — | нужна отдельная проверка |
| features / Мгновение славы | обоснованно вручную | — | нужна отдельная проверка |
| features / Проблеск гения | частично | module:arm-glimpse-of-genius | tests/registrations.test.mjs |
| features / Экспертность лидерства | требует исправления | — | нужна отдельная проверка |
| features / Дирижёр поля боя | требует исправления | — | нужна отдельная проверка |
| features / Мастер построения | требует исправления | — | нужна отдельная проверка |
| features / Командир на передовой | требует исправления | — | нужна отдельная проверка |
| features / Универсальный коммуникатор | требует исправления | — | нужна отдельная проверка |
| features / Идеальная координация | обоснованно вручную | — | нужна отдельная проверка |
| features / Присутствие лидера | требует исправления | — | нужна отдельная проверка |
| features / Успокаивающее присутствие | частично | module:choose-leader-presence-targets, aura:leader-calming-presence | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Отвлекающее присутствие | частично | module:choose-leader-presence-targets, aura:leader-distracting-presence | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Буйное присутствие | частично | module:choose-leader-presence-targets, aura:leader-boisterous-presence | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Тактическое присутствие | частично | module:choose-leader-presence-targets, aura:leader-tactical-presence | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Проницательное присутствие | частично | module:choose-leader-presence-targets, aura:leader-insightful-presence | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Вдохновляющее присутствие | частично | module:choose-leader-presence-targets, aura:leader-inspiring-presence | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Хитрая уловка | автоматизировано | leader-stratagem:contest | tests/leader-use.test.mjs |
| features / Боевой клич | частично | leader-stratagem:battle-cry | tests/leader-use.test.mjs |
| features / Приказ к осторожности | автоматизировано | leader-stratagem:caution | tests/leader-use.test.mjs |
| features / Направить атаку | автоматизировано | dnd5e:utility, leader-stratagem:direct | tools/validate.mjs, tests/leader-use.test.mjs |
| features / Отступить и перегруппироваться | частично | leader-stratagem:retreat | tests/leader-use.test.mjs |
| features / Направляющая магия | частично | leader-stratagem:guiding | tests/leader-use.test.mjs |
| features / Протянутая рука помощи | частично | leader-stratagem:help | tests/leader-use.test.mjs |
| features / Держать строй | автоматизировано | leader-stratagem:line | tests/leader-use.test.mjs |
| features / Вдохновляющее слово | автоматизировано | dnd5e:utility, leader-stratagem:word | tools/validate.mjs, tests/leader-use.test.mjs |
| features / Личный пример | автоматизировано | leader-stratagem:example | tests/leader-use.test.mjs |
| features / Берегись! | автоматизировано | leader-stratagem:dodge | tests/leader-use.test.mjs |
| features / Положительное/отрицательное подкрепление | автоматизировано | dnd5e:utility, leader-stratagem:reinforce | tools/validate.mjs, tests/leader-use.test.mjs |
| features / Утешающий комфорт | автоматизировано | leader-stratagem:comfort | tests/leader-use.test.mjs |
| features / Протрубить атаку/отступление | автоматизировано | leader-stratagem:charge | tests/leader-use.test.mjs |
| features / Тонкая дезинформация | автоматизировано | leader-stratagem:mark | tests/leader-use.test.mjs |
| features / Удар полководца | частично | leader-stratagem:strike | tests/leader-use.test.mjs |
| features / Тактика волчьей стаи | частично | leader-stratagem:wolf | tests/leader-use.test.mjs |
| features / Мистическая сила | требует исправления | — | нужна отдельная проверка |
| features / Нежить | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Сопротивление магии | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Сильная нежить | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Боевая нежить | частично | aura:death-knight-battle-undead | tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Дополнительная атака Рыцаря смерти | требует исправления | — | нужна отдельная проверка |
| features / Оккультные дары | частично | module:choose-occult-ability, module:use-occult-points | tests/registrations.test.mjs |
| features / Отмеченный порчей | требует исправления | — | нужна отдельная проверка |
| features / Гнусные силы | требует исправления | — | нужна отдельная проверка |
| features / Запретный талант | обоснованно вручную | — | нужна отдельная проверка |
| features / Искажённое тело | требует исправления | — | нужна отдельная проверка |
| features / Проклятая плоть | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Острое тёмное зрение | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Оккультная магия | обоснованно вручную | — | нужна отдельная проверка |
| features / Неугомонный | требует исправления | — | нужна отдельная проверка |
| features / Теневые карманы | требует исправления | — | нужна отдельная проверка |
| features / Пожиратель душ | требует исправления | — | нужна отдельная проверка |
| features / Нечестивость | обоснованно вручную | — | нужна отдельная проверка |
| features / Слабая гравитация | обоснованно вручную | — | нужна отдельная проверка |
| features / Чёрствый | требует исправления | — | нужна отдельная проверка |
| features / Циничный | обоснованно вручную | — | нужна отдельная проверка |
| features / Гордый | требует исправления | — | нужна отдельная проверка |
| features / Нежить порчи | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Изгнать свет | требует исправления | — | нужна отдельная проверка |
| features / Таинственный шаг | требует исправления | — | нужна отдельная проверка |
| features / Скрытое присутствие | требует исправления | — | нужна отдельная проверка |
| features / Откровенное зрение | требует исправления | — | нужна отдельная проверка |
| features / Теневой дворецкий | требует исправления | — | нужна отдельная проверка |
| features / Теневая марионетка | требует исправления | — | нужна отдельная проверка |
| features / Оборотень | требует исправления | — | нужна отдельная проверка |
| features / Нечестивая мантра | требует исправления | — | нужна отдельная проверка |
| features / Скрытник Бездны | требует исправления | — | нужна отдельная проверка |
| features / Искажённое тело: Улучшение характеристик | требует исправления | — | нужна отдельная проверка |
| features / Взгляд за грань | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Искажённая сила | обоснованно вручную | — | нужна отдельная проверка |
| features / Проклятые удары | обоснованно вручную | — | нужна отдельная проверка |
| features / Тёмная стража | требует исправления | — | нужна отдельная проверка |
| features / Осквернённое сердце | требует исправления | — | нужна отдельная проверка |
| features / Жуткая ловкость | требует исправления | — | нужна отдельная проверка |
| features / Запретная плоть | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Призрачный полёт | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Гульская мощь | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Чарующее обаяние | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Тёмная команда | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Мерцание и уклонение | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Призрачное присутствие | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Взрыв Ид | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Внушающий страх | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Затемняющая тайна | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Оккультный шаг | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Предзнаменование смерти | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Пройти незамеченным | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Глаз хищника | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Теневой взрыв | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Ткач теней | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Прикосновение порчи | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Сверхъестественные конечности | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Нечестивая сила | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Нечестивая кара | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Нечестивая мощь | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Невысказанные слова | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Посредник проклятий | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Фантомное «Я» | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Теневая форма | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Связывание духа | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Властелин ужаса | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Мысленный шпион | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Нечестивая ловкость | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Нечестивый круг | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Исчезновение | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Кукловод трупов | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Пожиратель снов | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Жуткие видения | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Творец мрака | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Преследующее проклятие | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Похититель разума | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Фантомный плащ | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Поразить живое/неживое | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Нечестивое оружие | частично | module:use-occult-points | tests/registrations.test.mjs |
| features / Древесный родич | требует исправления | — | нужна отдельная проверка |
| features / Магия природы | частично | module:choose-forest-base-class | tests/registrations.test.mjs |
| features / Чувство природы | требует исправления | — | нужна отдельная проверка |
| features / Коракожа | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Сила дуба | частично | module:forest-unarmed-damage | tests/registrations.test.mjs |
| features / Рост ели | требует исправления | — | нужна отдельная проверка |
| features / Сердце дуба | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Лесная мощь | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Пустить корни | частично | module:take-root, module:withdraw-roots | tests/registrations.test.mjs |
| features / Смертельная точность | частично | module:arm-deadly-precision | tests/registrations.test.mjs |
| features / Рефлексы чудовища | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Чувство арканы | требует исправления | — | нужна отдельная проверка |
| features / Токсичная кровь | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Энергичная природа | частично | module:vigorous-nature | tests/registrations.test.mjs |
| features / Финальные изменения | требует исправления | — | нужна отдельная проверка |
| features / Финальные изменения: Сила | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Финальные изменения: Ловкость | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Вариант: Неестественные черты | обоснованно вручную | — | нужна отдельная проверка |
| features / Неестественная черта: Когти | автоматизировано | dnd5e:utility | tools/validate.mjs |
| features / Неестественная черта: Клыки | автоматизировано | dnd5e:utility | tools/validate.mjs |
| features / Неестественная черта: Сгоревшие вены | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Неестественная черта: Кошачьи глаза | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Неестественная черта: Чутьё | обоснованно вручную | — | нужна отдельная проверка |
| features / Неестественная черта: Альбинос | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Чародейство | требует исправления | — | нужна отдельная проверка |
| features / Охотник на ведьм | частично | module:activate-witch-hunter-empower, dnd5e:utility | tests/registrations.test.mjs, tools/validate.mjs |
| features / Мертвая зона | частично | module:use-witch-blade-rage | tests/registrations.test.mjs |
| features / Печать Ведьминого клинка | частично | module:use-witch-blade-rage, module:use-witch-blade-seal-evil | tests/registrations.test.mjs |
| features / Великий замысел | требует исправления | — | нужна отдельная проверка |
| features / Эфирный ветер | требует исправления | — | нужна отдельная проверка |
| features / Закаленный разум | требует исправления | — | нужна отдельная проверка |
| features / Колдовская кристаллизация | частично | module:activate-witch-crystallization | tests/registrations.test.mjs |
| features / Эфирный толчок | частично | module:use-witch-blade-rage | tests/registrations.test.mjs |
| features / Бастион чародея | частично | dnd5e:utility | tools/validate.mjs |
| features / Эфирная буря | частично | module:activate-ethereal-storm | tests/registrations.test.mjs |
| features / Нематериальный вихрь | частично | module:open-immaterial-whirlwind | tests/registrations.test.mjs |
| features / Славное выживание | требует исправления | — | нужна отдельная проверка |
| features / Регенерирующая душа | частично | dnd5e:utility, runtime:classes/juggernaut-regeneration | tools/validate.mjs, tests/juggernaut-regeneration.test.mjs |
| features / Недостаток регенерации | частично | module:configure-juggernaut-regeneration | tests/registrations.test.mjs |
| features / Отрицание смерти | требует исправления | — | нужна отдельная проверка |
| features / Несгибаемость | требует исправления | — | нужна отдельная проверка |
| features / Что за рана? | обоснованно вручную | — | нужна отдельная проверка |
| features / Объять жизнь | требует исправления | — | нужна отдельная проверка |
| features / Неподвижный объект | требует исправления | — | нужна отдельная проверка |
| features / Малая регенерация | требует исправления | — | нужна отдельная проверка |
| features / Отказ от смерти | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Что за раны? | требует исправления | — | нужна отдельная проверка |
| features / Объять жизнь (улучшение) | требует исправления | — | нужна отдельная проверка |
| features / Большая регенерация | требует исправления | — | нужна отдельная проверка |
| features / Неудержимая сила | требует исправления | — | нужна отдельная проверка |
| features / Разрыв души | автоматизировано | dnd5e:utility | tools/validate.mjs |
| features / Поглощение души | обоснованно вручную | — | нужна отдельная проверка |
| features / Обмен душами | обоснованно вручную | — | нужна отдельная проверка |
| features / Осколок души | частично | module:activate-soul-shard | tests/registrations.test.mjs |
| features / Сила души | обоснованно вручную | — | нужна отдельная проверка |
| features / Призвание стража | требует исправления | — | нужна отдельная проверка |
| features / Метка стража | требует исправления | — | нужна отдельная проверка |
| features / Специализация защиты | требует исправления | — | нужна отдельная проверка |
| features / Жертвенный бросок | обоснованно вручную | — | нужна отдельная проверка |
| features / Защитная магия | обоснованно вручную | — | нужна отдельная проверка |
| features / Выдержать боль | частично | dnd5e:utility | tools/validate.mjs |
| features / Мощное возмездие | обоснованно вручную | — | нужна отдельная проверка |
| features / Божественное возмездие | частично | dnd5e:utility | tools/validate.mjs |
| features / Яростное возмездие | обоснованно вручную | — | нужна отдельная проверка |
| features / Прыжковое возмездие | обоснованно вручную | — | нужна отдельная проверка |
| features / Воинское возмездие | обоснованно вручную | — | нужна отдельная проверка |
| features / Планарное возмездие | обоснованно вручную | — | нужна отдельная проверка |
| features / Заклинательное возмездие | обоснованно вручную | — | нужна отдельная проверка |
| features / Угрожающее возмездие | частично | dnd5e:utility | tools/validate.mjs |
| features / Непоколебимость | требует исправления | — | нужна отдельная проверка |
| features / Мощное возмездие (улучшение) | требует исправления | — | нужна отдельная проверка |
| features / Несгибаемость | требует исправления | — | нужна отдельная проверка |
| features / Чудеса Крестоносца | требует исправления | — | нужна отдельная проверка |
| features / Ярость | частично | module:activate-crusader-rage, dnd5e:utility | tests/registrations.test.mjs, tools/validate.mjs |
| features / Эгида крестоносца | обоснованно вручную | — | нужна отдельная проверка |
| features / Божественная преданность | автоматизировано | dnd5e:ActiveEffect, aura:crusader-divine-devotion | tests/passives.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Освящение | частично | module:use-crusader-consecration | tests/registrations.test.mjs |
| features / Осуждение | частично | module:condemn-crusader-target | tests/registrations.test.mjs |
| features / Трансформация в фею | требует исправления | — | нужна отдельная проверка |
| features / Заговоры Воителя фей | обоснованно вручную | — | нужна отдельная проверка |
| features / Зов Страны Фей | обоснованно вручную | — | нужна отдельная проверка |
| features / Очаровательная защита | требует исправления | — | нужна отдельная проверка |
| features / Химерическое оружие | требует исправления | — | нужна отдельная проверка |
| features / Постоянное проявление | обоснованно вручную | — | нужна отдельная проверка |
| features / Магия фей | обоснованно вручную | — | нужна отдельная проверка |
| features / Фейская кожа | обоснованно вручную | — | нужна отдельная проверка |
| features / Маска | обоснованно вручную | — | нужна отдельная проверка |
| features / Кровь фей | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Глаза феи | частично | dnd5e:utility, dnd5e:ActiveEffect | tools/validate.mjs, tests/passives.test.mjs |
| features / Облик феи | частично | dnd5e:utility, dnd5e:Advancement | tools/validate.mjs, tests/progression.test.mjs |
| features / Скорость фей | частично | dnd5e:Advancement, dnd5e:ActiveEffect | tests/progression.test.mjs, tests/passives.test.mjs |
| features / Непреодолимые чары | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Неистребимая жизнь | частично | dnd5e:utility | tools/validate.mjs |
| features / Адепт исцеления | частично | dnd5e:utility | tools/validate.mjs |
| features / Грациозный боец | обоснованно вручную | — | нужна отдельная проверка |
| features / Тронутый Смертью | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Форма Духа | частично | module:activate-spirit-form, module:end-spirit-form, dnd5e:utility | tests/registrations.test.mjs, tools/validate.mjs |
| features / Одержимость | частично | dnd5e:utility | tools/validate.mjs |
| features / Призрачный Шаг | требует исправления | — | нужна отдельная проверка |
| features / Потустороннее Присутствие | автоматизировано | dnd5e:save | tools/validate.mjs |
| features / Высосать Душу | частично | dnd5e:utility | tools/validate.mjs |
| features / Родственный Дух | обоснованно вручную | — | нужна отдельная проверка |
| features / Незаконченное Дело | частично | module:summon-ghost-walker-spirit | tests/registrations.test.mjs |
| features / Внутреннее Мерцание | частично | module:use-inner-blink | tests/registrations.test.mjs |
| features / Мерцание с разворотом | обоснованно вручную | — | нужна отдельная проверка |
| features / Сдвиг в сторону | частично | module:activate-sideways-shift | tests/registrations.test.mjs |
| features / Мерцающий шаг | обоснованно вручную | — | нужна отдельная проверка |
| features / Улучшенная техника | требует исправления | — | нужна отдельная проверка |
| features / Мерцающее запястье | обоснованно вручную | — | нужна отдельная проверка |
| features / Внешнее Мерцание | частично | module:use-outer-blink | tests/registrations.test.mjs |
| features / Чувство сдвига | обоснованно вручную | — | нужна отдельная проверка |
| features / Исчезновение | требует исправления | — | нужна отдельная проверка |
| features / Чудесное возвращение домой | требует исправления | — | нужна отдельная проверка |
| features / Еретик | обоснованно вручную | — | нужна отдельная проверка |
| features / Чтение заклинаний | частично | module:sync-fallen-priest-spellcasting | tests/registrations.test.mjs |
| features / Изгнание нежити | частично | dnd5e:utility | tools/validate.mjs |
| features / Сопротивление божественному | обоснованно вручную | — | нужна отдельная проверка |
| features / Поглощение силы | частично | dnd5e:utility | tools/validate.mjs |
| features / Копирование божественного | обоснованно вручную | — | нужна отдельная проверка |
| features / Копирование арканы | обоснованно вручную | — | нужна отдельная проверка |
| features / Скрытая атака Чумного мага | частично | module:roll-plague-sneak-attack | tests/registrations.test.mjs |
| features / Разносчик заболеваний | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Оборванец | обоснованно вручную | — | нужна отдельная проверка |
| features / Касание болезни | частично | dnd5e:utility | tools/validate.mjs |
| features / Умная инфекция | частично | module:create-smart-infection, module:clear-smart-infections | tests/registrations.test.mjs |
| features / Инфицирование ран | требует исправления | — | нужна отдельная проверка |
| features / Форма болезни | частично | module:activate-disease-form, module:end-disease-form, dnd5e:utility | tests/registrations.test.mjs, tools/validate.mjs |
| features / Хитиновый панцирь | требует исправления | — | нужна отдельная проверка |
| features / Насекомое-фамильяр | частично | module:summon-insect-familiar | tests/registrations.test.mjs |
| features / Природное оружие | частично | module:roll-insect-tail-sting, module:roll-insect-bone-blades | tests/registrations.test.mjs |
| features / Высасывание крови | частично | dnd5e:attack, dnd5e:damage | tools/validate.mjs |
| features / Шевелящаяся броня | частично | module:use-crawling-armor | tests/registrations.test.mjs |
| features / Изрыгание насекомых | частично | module:roll-insect-spew | tests/registrations.test.mjs |
| features / Разум роя | частично | module:summon-insect-swarm | tests/registrations.test.mjs |
| features / Ползучий глаз | частично | module:detach-crawling-eye, module:return-crawling-eye | tests/registrations.test.mjs |
| features / Колода Астральных Тайн | частично | module:draw-astral-card, module:use-held-astral-card, module:discard-held-astral-card | tests/registrations.test.mjs |
| features / Сдавай Их | частично | module:deal-them | tests/registrations.test.mjs |
| features / Плутам везёт | частично | module:rogues-are-lucky | tests/registrations.test.mjs |
| features / В Рукаве | частично | module:store-sleeved-card, module:use-sleeved-card | tests/registrations.test.mjs |
| features / Тузы бьют | частично | module:aces-beat | tests/registrations.test.mjs |
| features / Страж и подопечный | частично | module:sync-keeper-ally-points, module:summon-keeper-ally, module:roll-keeper-ally-strike | tests/registrations.test.mjs |
| features / Таланты союзника | обоснованно вручную | — | нужна отдельная проверка |
| features / Специализация: Создатель големов | обоснованно вручную | — | нужна отдельная проверка |
| features / Специализация: Искатель мифов | обоснованно вручную | — | нужна отдельная проверка |
| features / Специализация: Духовный медиум | обоснованно вручную | — | нужна отдельная проверка |
| features / Специализация: Дикий укротитель | обоснованно вручную | — | нужна отдельная проверка |
| features / Стратегия и синергия | обоснованно вручную | — | нужна отдельная проверка |
| features / Едины и защищены | требует исправления | — | нужна отдельная проверка |
| features / Отдых и восстановление | частично | module:roll-keeper-rest-recovery | tests/registrations.test.mjs |
| features / Могущество и магия | частично | module:roll-keeper-might-damage | tests/registrations.test.mjs |
| features / Использование заклинаний | требует исправления | — | нужна отдельная проверка |
| features / Магия крови | частично | module:apply-blood-magic-cost | tests/registrations.test.mjs |
| features / Холст плоти | требует исправления | — | нужна отдельная проверка |
| features / Пир павших | требует исправления | — | нужна отдельная проверка |
| features / Перенос крови | требует исправления | — | нужна отдельная проверка |
| features / Сангвинистическая стойкость | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Жертва | частично | module:roll-blood-mage-sacrifice | tests/registrations.test.mjs |
| features / Кровный трэлл | требует исправления | — | нужна отдельная проверка |
| features / Малефикар | требует исправления | — | нужна отдельная проверка |
| features / Сангвиническая сила | требует исправления | — | нужна отдельная проверка |
| features / Ки | частично | module:sync-onmyoji-resources | tests/registrations.test.mjs |
| features / Талисман Шикигами | частично | module:summon-onmyoji-shikigami | tests/registrations.test.mjs |
| features / Обряд Очищения | частично | dnd5e:utility | tools/validate.mjs |
| features / Шикигами Призрачный Охотник | обоснованно вручную | — | нужна отдельная проверка |
| features / Место Духа | обоснованно вручную | — | нужна отдельная проверка |
| features / Дух Алкоголя | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Книги | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Огня | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Еды | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Горы | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Стали | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Воды | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Дерева | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Богатства | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Дух Ветра | частично | module:use-onmyoji-ki | tests/registrations.test.mjs |
| features / Ритуал привязки | частично | module:sync-ritualist-resources, module:summon-ritualist-spirits, module:dismiss-ritualist-spirits, module:regain-ritualist-spirits, module:show-ritualist-spirit-dc, module:roll-ritualist-spirit-agony, module:roll-ritualist-spirit-life, module:roll-ritualist-spirit-protection, module:roll-ritualist-spirit-sorrow, module:roll-ritualist-spirit-destruction-die, runtime:classes/ritualist-spirits | tests/registrations.test.mjs, tests/ritualist-spirits.test.mjs |
| features / Духовное зрение | требует исправления | — | нужна отдельная проверка |
| features / Разум, тело и душа | автоматизировано | runtime:classes/ritualist | tests/ritualist-zones.test.mjs |
| features / Ритуал защиты | требует исправления | — | нужна отдельная проверка |
| features / Канал духов | частично | module:show-ritualist-spirit-channel | tests/registrations.test.mjs |
| features / Эфирный странник | обоснованно вручную | — | нужна отдельная проверка |
| features / Масло чёрной магии | частично | module:apply-black-magic-oil, module:sync-dark-warrior-resources | tests/registrations.test.mjs |
| features / Эликсир чёрной магии | частично | module:drink-dark-warrior-elixir | tests/registrations.test.mjs |
| features / Улучшенное чёрное масло | требует исправления | — | нужна отдельная проверка |
| features / Улучшенный эликсир | частично | module:sync-dark-warrior-resources | tests/registrations.test.mjs |
| features / Тёмное сопротивление | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Очернение оружия | обоснованно вручную | — | нужна отдельная проверка |
| features / Базовая характеристика заклинаний | частично | module:choose-devil-worshipper-ability | tests/registrations.test.mjs |
| features / Адское пламя | обоснованно вручную | — | нужна отдельная проверка |
| features / Бесовский фамильяр | частично | module:summon-devil-imp-familiar | tests/registrations.test.mjs |
| features / Зрение дьявола | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Тёмная удача | частично | module:show-dark-luck | tests/registrations.test.mjs |
| features / Тихий шёпот | обоснованно вручную | — | нужна отдельная проверка |
| features / Усиленные чары | частично | module:show-empowered-charms | tests/registrations.test.mjs |
| features / Ярость адского огня | требует исправления | — | нужна отдельная проверка |
| features / Дьявольская гвизарма | частично | module:summon-devil-glaive, module:roll-devil-glaive-damage, module:roll-devil-glaive-grapple-damage | tests/registrations.test.mjs |
| features / Аура опустошённых душ | частично | module:gain-devil-soul-aura-temp-hp, aura:devil-devastated-souls | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Учёный арканист | частично | module:show-scholar-arcanist | tests/registrations.test.mjs |
| features / Нетерильский гримуар | обоснованно вручную | — | нужна отдельная проверка |
| features / Мини-мифаль | частично | module:activate-mini-mythal, module:teleport-in-mini-mythal, module:overload-mini-mythal | tests/registrations.test.mjs |
| features / Древнее знание | частично | module:use-ancient-knowledge | tests/registrations.test.mjs |
| features / Великие заклинания | частично | module:cast-netherese-great-spell | tests/registrations.test.mjs |
| features / Уполовиненное эго | обоснованно вручную | — | нужна отдельная проверка |
| features / Магия договора | частично | module:choose-spirit-vessel-ability | tests/registrations.test.mjs |
| features / Тип Духа | требует исправления | — | нужна отдельная проверка |
| features / Концентрированный удар | частично | module:choose-spirit-vessel-strike-damage, module:roll-spirit-vessel-concentrated-strike | tests/registrations.test.mjs |
| features / Улучшение характеристики | частично | module:show-spirit-vessel-ability-improvement | tests/registrations.test.mjs |
| features / Поток | частично | module:activate-spirit-flow | tests/registrations.test.mjs |
| features / Метафизическое воплощение | требует исправления | — | нужна отдельная проверка |
| features / Дух: Абберация | частично | module:spirit-vessel-aberration-charm | tests/registrations.test.mjs |
| features / Дух: Небожитель / Celestial | требует исправления | — | нужна отдельная проверка |
| features / Дух: Элементаль Земли | обоснованно вручную | — | нужна отдельная проверка |
| features / Дух: Элементаль Воздуха | обоснованно вручную | — | нужна отдельная проверка |
| features / Дух: Элементаль Огня | обоснованно вручную | — | нужна отдельная проверка |
| features / Дух: Элементаль Воды | обоснованно вручную | — | нужна отдельная проверка |
| features / Дух: Фея | частично | module:spirit-vessel-fey-charm | tests/registrations.test.mjs |
| features / Дух: Исчадие | частично | module:spirit-vessel-fiend-flames, aura:spirit-vessel-fiend-flames | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Дух: Нежить | частично | module:spirit-vessel-undead-frighten | tests/registrations.test.mjs |
| features / Воздействие на судьбы | частично | module:sync-oracle-resources, module:oracle-fate-miss, module:oracle-mysterious-guidance, module:oracle-balancing-ritual | tests/registrations.test.mjs |
| features / Первый секрет Оракула | частично | module:oracle-free-scrying, module:oracle-read-threads | tests/registrations.test.mjs |
| features / Переплетение связей | частично | module:oracle-remove-dissonance-slot, module:oracle-restore-slot-dissonance | tests/registrations.test.mjs |
| features / Чувство судьбы | частично | module:oracle-danger | tests/registrations.test.mjs |
| features / Главный секрет оракула | частично | module:oracle-astral-projection, module:oracle-exchange-fates, module:oracle-fate-scissors | tests/registrations.test.mjs |
| features / Очарование демонов | частично | module:show-demonologist-demon-charm | tests/registrations.test.mjs |
| features / Инфернальный фамильяр | частично | module:show-demonologist-infernal-familiar | tests/registrations.test.mjs |
| features / Мастер призыва | частично | module:use-demonologist-master-summoner | tests/registrations.test.mjs |
| features / Тёмное знание | частично | module:cast-demonologist-protection, module:cast-demonologist-spirit-guardians | tests/registrations.test.mjs |
| features / Демоническое сопротивление | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Демоническая живучесть | частично | module:activate-demonic-vitality, aura:demonologist-vitality | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Демонический разум | частично | module:cast-demonologist-detect-thoughts, dnd5e:ActiveEffect | tests/registrations.test.mjs, tests/passives.test.mjs |
| features / Удвоенный призыв | частично | module:use-demonologist-double-summon | tests/registrations.test.mjs |
| features / Доминация | частично | module:show-demonologist-domination | tests/registrations.test.mjs |
| features / Кровавая магия | частично | module:sync-sanguinist-resources, module:gain-sanguinist-blood-point, module:spend-sanguinist-blood-points | tests/registrations.test.mjs |
| features / Гематургия | частично | module:use-hematurgy | tests/registrations.test.mjs |
| features / Накладывание заклинаний | частично | module:show-sanguinist-spellcasting | tests/registrations.test.mjs |
| features / Ученик крови | частично | module:cast-blood-reading, module:mark-sanguinist-blood-spell | tests/registrations.test.mjs |
| features / Багровая сила | частично | module:sanguine-power-hit-die, module:sanguine-power-blood-point | tests/registrations.test.mjs |
| features / Жизненное восстановление | частично | module:show-vital-restoration | tests/registrations.test.mjs |
| features / Кровавая совместимость | частично | module:show-blood-compatibility | tests/registrations.test.mjs |
| features / Моя собственная кровь | частично | module:use-my-own-blood-recovery | tests/registrations.test.mjs |
| features / Кровь других | частично | module:gain-sanguinist-blood-points-others | tests/registrations.test.mjs |
| features / Ритуальное жертвоприношение | частично | module:show-ritual-sacrifice | tests/registrations.test.mjs |
| features / Багровое мастерство | требует исправления | — | нужна отдельная проверка |
| features / Артериальная марионетка | частично | module:use-arterial-puppetry | tests/registrations.test.mjs |
| features / Кровавая обратная связь | частично | module:use-blood-backlash | tests/registrations.test.mjs |
| features / Кровопускание | частично | module:use-bloodletting | tests/registrations.test.mjs |
| features / Ушиб | частично | module:use-contusion | tests/registrations.test.mjs |
| features / Багровая ярость | частично | module:use-crimson-fury | tests/registrations.test.mjs |
| features / Багровая буря | частично | module:use-sanguine-storm | tests/registrations.test.mjs |
| features / Переливание | частично | module:use-transfusion | tests/registrations.test.mjs |
| features / Вампиризм | частично | module:use-vampirism | tests/registrations.test.mjs |
| features / Путь совершенства | частично | module:master-control | tests/registrations.test.mjs |
| features / Избранное владение | частично | module:master-control | tests/registrations.test.mjs |
| features / Техники | обоснованно вручную | — | нужна отдельная проверка |
| features / Воля к совершенству | обоснованно вручную | — | нужна отдельная проверка |
| features / Совершенное ремесло | требует исправления | — | нужна отдельная проверка |
| features / Серия приемов | частично | module:master-control | tests/registrations.test.mjs |
| features / Увеличение характеристик | частично | module:master-control | tests/registrations.test.mjs |
| features / Вершина пути | требует исправления | — | нужна отдельная проверка |
| features / Улучшенная серия приемов | обоснованно вручную | — | нужна отдельная проверка |
| features / Путь Клинка | частично | module:master-control, runtime:classes/master-blade | tests/registrations.test.mjs, tests/master-blade.test.mjs |
| features / Путь Стрелка | частично | module:master-control | tests/registrations.test.mjs |
| features / Путь Арканы | частично | module:master-control | tests/registrations.test.mjs |
| features / Бой в упор | требует исправления | — | нужна отдельная проверка |
| features / Быстрая перезарядка | частично | module:master-control | tests/registrations.test.mjs |
| features / Опытный взгляд | обоснованно вручную | — | нужна отдельная проверка |
| features / Дальний выстрел | требует исправления | — | нужна отдельная проверка |
| features / Дальняя формула | частично | module:master-control | tests/registrations.test.mjs |
| features / Защитная формула | частично | module:master-control | tests/registrations.test.mjs |
| features / Сквозь укрытие | обоснованно вручную | — | нужна отдельная проверка |
| features / Длинный выпад | частично | module:master-control | tests/registrations.test.mjs |
| features / Надежная формула | частично | module:master-control | tests/registrations.test.mjs |
| features / Натиск клинка | частично | module:master-control | tests/registrations.test.mjs |
| features / Отступающий выстрел | обоснованно вручную | — | нужна отдельная проверка |
| features / Предусмотрительность | частично | module:master-control | tests/registrations.test.mjs |
| features / Разоружающий удар | частично | module:master-control | tests/registrations.test.mjs |
| features / Рискованный прием | частично | module:master-control | tests/registrations.test.mjs |
| features / Совершенная рука | частично | module:master-control | tests/registrations.test.mjs |
| features / Стальной заслон | частично | module:master-control | tests/registrations.test.mjs |
| features / Срывающий выстрел | частично | module:master-control | tests/registrations.test.mjs |
| features / Учёная формула | обоснованно вручную | — | нужна отдельная проверка |
| features / Безупречная контратака | частично | module:master-control | tests/registrations.test.mjs |
| features / Власть над стихией | частично | module:master-control | tests/registrations.test.mjs |
| features / Выстрел навскидку | частично | module:master-control | tests/registrations.test.mjs |
| features / Избирательная формула | обоснованно вручную | — | нужна отдельная проверка |
| features / Специалист школы | требует исправления | — | нужна отдельная проверка |
| features / Непоколебимая концентрация | требует исправления | — | нужна отдельная проверка |
| features / Оборонительная стойка | требует исправления | — | нужна отдельная проверка |
| features / Подавляющий выстрел | частично | module:master-control | tests/registrations.test.mjs |
| features / Пригвождающий прием | частично | module:master-control | tests/registrations.test.mjs |
| features / Пробивающий выстрел | частично | module:master-control | tests/registrations.test.mjs |
| features / Расширенная формула | частично | module:master-control | tests/registrations.test.mjs |
| features / Рассечение | частично | module:master-control | tests/registrations.test.mjs |
| features / Рикошет | частично | module:master-control | tests/registrations.test.mjs |
| features / Страж клинка | частично | module:master-control | tests/registrations.test.mjs |
| features / Великое заклинание | частично | module:master-control | tests/registrations.test.mjs |
| features / Вихрь клинка | частично | module:master-control | tests/registrations.test.mjs |
| features / Выверенная позиция | обоснованно вручную | — | нужна отдельная проверка |
| features / Прицельный залп | частично | module:master-control | tests/registrations.test.mjs |
| features / Неотвратимое попадание | обоснованно вручную | — | нужна отдельная проверка |
| features / Непререкаемая магия | обоснованно вручную | — | нужна отдельная проверка |
| features / Ответ на магию | частично | module:master-control | tests/registrations.test.mjs |
| features / Смертельная дистанция | частично | module:master-control | tests/registrations.test.mjs |
| features / Стремительная серия | частично | module:master-control | tests/registrations.test.mjs |
| features / Добыча трофеев | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Одноразовые трофеи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Разбор | частично | runtime:classes/bounty-hunter-combat | tests/bounty-hunter.test.mjs |
| features / Гон добычи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Один на один | частично | runtime:classes/bounty-hunter-combat | tests/bounty-hunter.test.mjs |
| features / Средний трофей | требует исправления | — | нужна отдельная проверка |
| features / Комбинация | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Увеличение характеристик | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей | требует исправления | — | нужна отдельная проверка |
| features / Разжигание охоты | автоматизировано | runtime:classes/bounty-hunter-events | tests/bounty-hunter.test.mjs |
| features / Малый трофей аберрации | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей аберрации | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей аберрации | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей зверя | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей зверя | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей зверя | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей небожителя | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей небожителя | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей небожителя | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей конструкта | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей конструкта | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей конструкта | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей дракона | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей дракона | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей дракона | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей элементаля | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей элементаля | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей элементаля | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей феи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей феи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей феи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей исчадия | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей исчадия | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей исчадия | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей великана | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей великана | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей великана | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей гуманоида | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей гуманоида | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей гуманоида | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей чудовища | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей чудовища | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей чудовища | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей слизи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей слизи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей слизи | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей растения | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей растения | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей растения | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Малый трофей нежити | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Средний трофей нежити | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Великий трофей нежити | частично | module:bounty-hunter-control | tests/registrations.test.mjs |
| features / Очки хаоса | частично | module:jester-control | tests/registrations.test.mjs |
| features / Экспромт | частично | module:jester-control | tests/registrations.test.mjs |
| features / Смена декораций | частично | module:jester-control | tests/registrations.test.mjs |
| features / Острая реплика | частично | module:jester-control | tests/registrations.test.mjs |
| features / Смех зала | частично | module:jester-control | tests/registrations.test.mjs |
| features / Мизансцена | автоматизировано | runtime:classes/jester-actions | tests/jester.test.mjs |
| features / Правка суфлера | частично | module:jester-control | tests/registrations.test.mjs |
| features / Жребий роли | частично | module:jester-control | tests/registrations.test.mjs |
| features / Финальный номер | частично | module:jester-control | tests/registrations.test.mjs |
| features / Импровизация | автоматизировано | runtime:classes/jester-actions | tests/jester.test.mjs |
| features / Цена силы | автоматизировано | runtime:classes/flagellant | tests/flagellant.test.mjs |
| features / Исступление | автоматизировано | runtime:classes/flagellant | tests/flagellant.test.mjs |
| features / Самобичевание | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Натиск | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Стойкость | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Порыв | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Жестокий урок | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Воздаяние | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Закалённая плоть | автоматизировано | runtime:classes/flagellant | tests/flagellant.test.mjs |
| features / Дар крови | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Жертвенное увеличение | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Через силу | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Пир страданий | частично | module:flagellant-control | tests/registrations.test.mjs |
| features / Принятые проклятия | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Стойкость обречённого | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Разделённая участь | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Чутьё порчи | обоснованно вручную | — | нужна отдельная проверка |
| features / Наперекор судьбе | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Усиление проклятия | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Проклятое увеличение | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Воплощение порчи | автоматизировано | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Отсроченный конец | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Безмолвие | частично | module:doomed-control, runtime:classes/doomed | tests/registrations.test.mjs, tests/doomed.test.mjs |
| features / Выжженное сердце | автоматизировано | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Кровавый голод | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Незаживающие раны | автоматизировано | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Неугасимое пламя | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Обнажённая душа | частично | module:doomed-control, runtime:classes/doomed | tests/registrations.test.mjs, tests/doomed.test.mjs |
| features / Правдивый язык | частично | module:doomed-control, runtime:classes/doomed | tests/registrations.test.mjs, tests/doomed.test.mjs |
| features / Проклятая удача | частично | module:doomed-control, runtime:classes/doomed | tests/registrations.test.mjs, tests/doomed.test.mjs |
| features / Расколотый разум | частично | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Тяжесть могилы | частично | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Истлевшая плоть | частично | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Клеймо отверженного | частично | aura:doomed-outcast-normal, aura:doomed-outcast-empowered | tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Мёртвый холод | частично | aura:doomed-cold-normal, aura:doomed-cold-empowered, runtime:classes/doomed | tests/auras.test.mjs, tests/aura-events.test.mjs, tests/doomed.test.mjs |
| features / Неконтролируемая ярость | автоматизировано | runtime:classes/doomed-events | tests/doomed.test.mjs |
| features / Отторжение реликвий | обоснованно вручную | — | нужна отдельная проверка |
| features / Срыв чар | частично | module:doomed-control, runtime:classes/doomed | tests/registrations.test.mjs, tests/doomed.test.mjs |
| features / Тень за спиной | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Украденный миг | частично | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Хрупкие кости | автоматизировано | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Могильные цепи | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Погребённая душа | частично | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Распад | частично | module:doomed-control | tests/registrations.test.mjs |
| features / Слепое откровение | частично | runtime:classes/doomed | tests/doomed.test.mjs |
| features / Питание страхом | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Навязанные страхи | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Зов кошмара | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Отголосок | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Неотвратимый ужас | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Слепое пятно | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Увеличение характеристик | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Безысходность | автоматизировано | runtime:classes/nightmare-fears | tests/nightmare.test.mjs |
| features / Владыка кошмаров | автоматизировано | runtime:classes/nightmare-actions | tests/nightmare.test.mjs |
| features / Агорафобия (Страх открытых пространств) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Алгофобия (Страх боли) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Атихифобия (Страх неудачи) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Аутофобия (Страх одиночества) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Гоплофобия (Страх оружия) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Клаустрофобия (Страх замкнутых пространств) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Никтофобия (Страх темноты) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Охлофобия (Страх толпы) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Рабдофобия (Страх колдовства) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Танатофобия (Страх смерти) | частично | module:nightmare-control | tests/registrations.test.mjs |
| features / Призыв кошмара: Соглядатай | обоснованно вручную | — | нужна отдельная проверка |
| features / Призыв кошмара: Преследователь | обоснованно вручную | — | нужна отдельная проверка |
| features / Призыв кошмара: Надзиратель | обоснованно вручную | — | нужна отдельная проверка |
| features / Маски чувств | частично | module:empath-control | tests/registrations.test.mjs |
| features / Импульс | частично | module:empath-control | tests/registrations.test.mjs |
| features / Сопричастность | частично | module:empath-control | tests/registrations.test.mjs |
| features / Голос сердца | частично | module:empath-control | tests/registrations.test.mjs |
| features / Отклик | автоматизировано | runtime:classes/empath-actions | tests/empath.test.mjs |
| features / Волна чувств | частично | module:empath-control | tests/registrations.test.mjs |
| features / Изменчивая природа | частично | module:empath-control | tests/registrations.test.mjs |
| features / Грани души | частично | runtime:classes/empath | tests/empath.test.mjs |
| features / Катарсис | частично | module:empath-control | tests/registrations.test.mjs |
| features / Сифон | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Магическая Форма | автоматизировано | runtime:transformations/arkane | tests/arkane.test.mjs |
| features / Дуговое Слияние | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Настойчивость | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Шторм Сил | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Сверхъестественные Чувства | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Аннулирование: лишение магии | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Отвратительная Внешность | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Безграничная Сила | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Одержимость | автоматизировано | runtime:transformations/arkane | tests/arkane.test.mjs |
| features / Паразит | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Фрактал | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Нестабильный | частично | runtime:transformations/arkane | tests/arkane.test.mjs |
| features / Пожирание | частично | runtime:transformations/arkane | tests/arkane.test.mjs |
| features / Сверхъестественное Тело | частично | module:arkane-control, runtime:transformations/arkane-spells | tests/registrations.test.mjs, tests/arkane.test.mjs |
| features / Аннулирование: барьер | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Наделение | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Сверхъестественное Искажение | частично | module:arkane-control | tests/registrations.test.mjs |
| features / Модель Автоматона | частично | module:automaton-control, runtime:transformations/automaton | tests/registrations.test.mjs, tests/automaton.test.mjs |
| features / Форма Конструкта | частично | runtime:transformations/automaton | tests/automaton.test.mjs |
| features / Восприимчивость к Анти-Магии | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Сила и уверенность стали | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Бронебойный | автоматизировано | runtime:transformations/automaton | tests/automaton.test.mjs |
| features / Только плоть терпит неудачу | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Перегрузка | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Перезарядка | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Плоть слаба! | автоматизировано | runtime:transformations/automaton-combat | tests/automaton.test.mjs |
| features / Живой материал | автоматизировано | runtime:transformations/automaton-combat | tests/automaton.test.mjs |
| features / Механизированный полет | автоматизировано | runtime:transformations/automaton | tests/automaton.test.mjs |
| features / Потустороннее вооружение | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Высасывание силы | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Сопротивление заклинаниям | частично | module:automaton-control, runtime:transformations/automaton-combat | tests/registrations.test.mjs, tests/automaton.test.mjs |
| features / Дуговая батарея | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Нестабильное ядро | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Реактивные катушки | частично | module:automaton-control, runtime:transformations/automaton-combat | tests/registrations.test.mjs, tests/automaton.test.mjs |
| features / Уязвимость к Анти-Магии | частично | module:automaton-control | tests/registrations.test.mjs |
| features / Выводок потомства | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Форма паука | автоматизировано | runtime:transformations/broodmother | tests/broodmother.test.mjs |
| features / Боязнь огня | обоснованно вручную | — | нужна отдельная проверка |
| features / Арахномантия | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Паучья мимикрия | частично | module:broodmother-control, runtime:transformations/broodmother | tests/registrations.test.mjs, tests/broodmother.test.mjs |
| features / Выброс паутины | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Ядовитое перо | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Отвратительная внешность | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Больший выводок | автоматизировано | runtime:transformations/broodmother-summons | tests/broodmother.test.mjs |
| features / Ядовитая кровь | автоматизировано | runtime:transformations/broodmother-events | tests/broodmother.test.mjs |
| features / Прядильщик нитей | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Кислотная желчь | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Пирофобия | частично | runtime:transformations/broodmother-events | tests/broodmother.test.mjs |
| features / Благословение матриарха | автоматизировано | runtime:transformations/broodmother-summons | tests/broodmother.test.mjs |
| features / Потомство ужаса | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Мимикрия | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Токсиколог | частично | runtime:transformations/broodmother-combat | tests/broodmother.test.mjs |
| features / Материнское презрение | частично | module:broodmother-control | tests/registrations.test.mjs |
| features / Менажери | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Гибридная форма | автоматизировано | runtime:transformations/chimera | tests/chimera.test.mjs |
| features / Химерическая аберрация | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Сложное знание | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Жало виверны | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Волосы Медузы | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Формы мимика | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Аллергия на бронзу | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Сопротивление гибрида | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Дыхание дракона | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Голос сирены | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Крылья грифона | автоматизировано | runtime:transformations/chimera | tests/chimera.test.mjs |
| features / Нестабильная личность | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Поделиться амальгамой | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Регенерация гидры | частично | runtime:transformations/chimera-events | tests/chimera.test.mjs |
| features / Молнии кракена | частично | module:chimera-control | tests/registrations.test.mjs |
| features / Панцирь Тараска | автоматизировано | runtime:transformations/chimera-spells | tests/chimera.test.mjs |
| features / Раздражённая кровь | частично | runtime:transformations/chimera-events | tests/chimera.test.mjs |
| features / Конечности хищников | обоснованно вручную | — | нужна отдельная проверка |
| features / Яд лягушкоплава | обоснованно вручную | — | нужна отдельная проверка |
| features / Гогот гуся | обоснованно вручную | — | нужна отдельная проверка |
| features / Панцирь черепахи | обоснованно вручную | — | нужна отдельная проверка |
| features / Выносливость медведя | обоснованно вручную | — | нужна отдельная проверка |
| features / Чувства волка | обоснованно вручную | — | нужна отдельная проверка |
| features / Мех выдры | обоснованно вручную | — | нужна отдельная проверка |
| features / Кровь ящерицы | обоснованно вручную | — | нужна отдельная проверка |
| features / Скорость барана | обоснованно вручную | — | нужна отдельная проверка |
| features / Прыжок зайца | обоснованно вручную | — | нужна отдельная проверка |
| features / Реакция мухи | обоснованно вручную | — | нужна отдельная проверка |
| features / Глаза ястреба | обоснованно вручную | — | нужна отдельная проверка |
| features / Ноги паука | обоснованно вручную | — | нужна отдельная проверка |
| features / Жабры рыбы | обоснованно вручную | — | нужна отдельная проверка |
| features / Поражённый могилой | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Форма нежити | частично | runtime:transformations/deathknight | tests/deathknight.test.mjs |
| features / Якорь | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Смертельный смог | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Обречённые удары | автоматизировано | runtime:transformations/deathknight-events | tests/deathknight.test.mjs |
| features / Нет отдыха для злых | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Сувенир | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Отвратительная внешность | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Связь душ | частично | module:deathknight-control, runtime:transformations/deathknight | tests/registrations.test.mjs, tests/deathknight.test.mjs |
| features / Быстрое исцеление | автоматизировано | runtime:transformations/deathknight-events | tests/deathknight.test.mjs |
| features / Тигель смерти | частично | module:deathknight-control, aura:deathknight-crucible-20, aura:deathknight-crucible-30, aura:deathknight-crucible-40, aura:deathknight-crucible-50, aura:deathknight-crucible-60, aura:deathknight-crucible-70, aura:deathknight-crucible-80, aura:deathknight-crucible-90, aura:deathknight-crucible-100 | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Специалист по нежити | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Существование смерти | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Шар адского огня | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Аура генерала смерти | автоматизировано | aura:deathknight-general, runtime:transformations/deathknight-events | tests/auras.test.mjs, tests/aura-events.test.mjs, tests/deathknight.test.mjs |
| features / Искореняющий удар | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Жнец | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Отверженный | частично | module:deathknight-control | tests/registrations.test.mjs |
| features / Скелет: Артиллерист | обоснованно вручную | — | нужна отдельная проверка |
| features / Скелет: Сапёр | обоснованно вручную | — | нужна отдельная проверка |
| features / Скелет: Воин | обоснованно вручную | — | нужна отдельная проверка |
| features / Скелет: Защитник | обоснованно вручную | — | нужна отдельная проверка |
| features / Скелет: Убийца | обоснованно вручную | — | нужна отдельная проверка |
| features / Клятва охотника | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Форма нежити | частично | runtime:transformations/dullahan | tests/dullahan.test.mjs |
| features / Нарушенная клятва | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Кошмарный скакун | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Великое зрение | автоматизировано | runtime:transformations/dullahan | tests/dullahan.test.mjs |
| features / Пылающие черепа | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Стойкость нежити | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Отвратительная внешность | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Голова Смерти | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Вой Безголосого | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Испепеляющий взгляд | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Смертельное прорицание | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Увядающая клятва | частично | runtime:transformations/dullahan | tests/dullahan.test.mjs |
| features / Охотник за головами | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Непреклонный | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Нервирующее пламя | частично | module:dullahan-control, runtime:transformations/dullahan-combat | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Туманы Отчуждения | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Безголовый Пешка | частично | module:dullahan-control, runtime:transformations/dullahan-actions | tests/registrations.test.mjs, tests/dullahan.test.mjs |
| features / Изготовленная форма | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Фабрика инноваций | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Зависимость | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Адаптированная стойкость | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Оно живое | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Бронебойный | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Электрическая дуга | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Отвратительная внешность | обоснованно вручную | — | нужна отдельная проверка |
| features / Скульптор плоти | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Изменение с модификацией | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Живой материал | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Заземление | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Несовершенства | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Deus Ex Machanicus | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Машина бессмертна! | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Воплощение совершенства | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Вознесение Омниссии | частично | module:factory-control, runtime:transformations/factory-actions | tests/registrations.test.mjs, tests/factory.test.mjs |
| features / Абстиненция | автоматизировано | runtime:transformations/factory-events | tests/factory.test.mjs |
| features / Улучшенные чувства | обоснованно вручную | — | нужна отдельная проверка |
| features / Улучшенные рефлексы | обоснованно вручную | — | нужна отдельная проверка |
| features / Имплантированные клыки | обоснованно вручную | — | нужна отдельная проверка |
| features / Неврологические импланты | обоснованно вручную | — | нужна отдельная проверка |
| features / Биомонитор | обоснованно вручную | — | нужна отдельная проверка |
| features / Отравленная кровь | обоснованно вручную | — | нужна отдельная проверка |
| features / Укреплённые лёгкие | обоснованно вручную | — | нужна отдельная проверка |
| features / Сильная спина | обоснованно вручную | — | нужна отдельная проверка |
| features / Подкожная броня | обоснованно вручную | — | нужна отдельная проверка |
| features / Хорошо отдохнувший | обоснованно вручную | — | нужна отдельная проверка |
| features / Кулаки гориллы | обоснованно вручную | — | нужна отдельная проверка |
| features / Клинки богомола | обоснованно вручную | — | нужна отдельная проверка |
| features / Укреплённые руки | обоснованно вручную | — | нужна отдельная проверка |
| features / Скелет-ключи | обоснованно вручную | — | нужна отдельная проверка |
| features / Шипастые пальцы | обоснованно вручную | — | нужна отдельная проверка |
| features / Амортизирующие подошвы | обоснованно вручную | — | нужна отдельная проверка |
| features / Укреплённые лодыжки | обоснованно вручную | — | нужна отдельная проверка |
| features / Перепончатые лапы | обоснованно вручную | — | нужна отдельная проверка |
| features / Усиленные сухожилия | обоснованно вручную | — | нужна отдельная проверка |
| features / Укреплённые ноги | обоснованно вручную | — | нужна отдельная проверка |
| features / Ярость берсерка | обоснованно вручную | — | нужна отдельная проверка |
| features / Брандмауэр | обоснованно вручную | — | нужна отдельная проверка |
| features / Фокусирующий чип | обоснованно вручную | — | нужна отдельная проверка |
| features / Обнаружение угроз | обоснованно вручную | — | нужна отдельная проверка |
| features / Адамантиновая кожа | обоснованно вручную | — | нужна отдельная проверка |
| features / Прочный | обоснованно вручную | — | нужна отдельная проверка |
| features / Иммунизирующая система | обоснованно вручную | — | нужна отдельная проверка |
| features / Механические руки | обоснованно вручную | — | нужна отдельная проверка |
| features / Резистентная трансплантация | обоснованно вручную | — | нужна отдельная проверка |
| features / Второе Сердце | обоснованно вручную | — | нужна отдельная проверка |
| features / Авто-перезарядка | обоснованно вручную | — | нужна отдельная проверка |
| features / Выдвижные руки | обоснованно вручную | — | нужна отдельная проверка |
| features / Запястная пусковая установка | обоснованно вручную | — | нужна отдельная проверка |
| features / Гипер мобильность | обоснованно вручную | — | нужна отдельная проверка |
| features / Неподвижность | обоснованно вручную | — | нужна отдельная проверка |
| features / Улучшенная ловкость | обоснованно вручную | — | нужна отдельная проверка |
| features / Интеллект-привод | обоснованно вручную | — | нужна отдельная проверка |
| features / Повелитель разума | обоснованно вручную | — | нужна отдельная проверка |
| features / Второй разум | обоснованно вручную | — | нужна отдельная проверка |
| features / Плащ хамелеона | обоснованно вручную | — | нужна отдельная проверка |
| features / Улучшенное Телосложение | обоснованно вручную | — | нужна отдельная проверка |
| features / Ослабление магии | обоснованно вручную | — | нужна отдельная проверка |
| features / Сандевестан | обоснованно вручную | — | нужна отдельная проверка |
| features / Амортизаторы силы | обоснованно вручную | — | нужна отдельная проверка |
| features / Улучшенная Сила | обоснованно вручную | — | нужна отдельная проверка |
| features / Воздушные ударники | обоснованно вручную | — | нужна отдельная проверка |
| features / Заряженный | обоснованно вручную | — | нужна отдельная проверка |
| features / Воздушные шагатели | обоснованно вручную | — | нужна отдельная проверка |
| features / Силовые топтуны | обоснованно вручную | — | нужна отдельная проверка |
| features / Улучшенная Ловкость | обоснованно вручную | — | нужна отдельная проверка |
| features / Инерционные зарядчики | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Глина | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Дерево | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Плоть | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Камень | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Железо | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Кристалл | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Адамантин | обоснованно вручную | — | нужна отдельная проверка |
| features / Гомункул: Мифрил | обоснованно вручную | — | нужна отдельная проверка |
| features / Божественное Рвение | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Божественная Форма | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Впадение в Апатию | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Демиургия | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Прометеева Мантия | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Транслокация | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Благожеланность/Вредоносность | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Божественное Напряжение | частично | module:god-control, aura:god-strain, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs, tests/god.test.mjs |
| features / Один за Всех/Все за Одного | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Выздоровление/Пожирание | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Милость | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Всемогущий Исполнитель Желаний | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Бессмертное Проклятие | частично | runtime:transformations/god-events | tests/god.test.mjs |
| features / Расширение Домена | частично | module:god-control, aura:god-domain, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs, tests/god.test.mjs |
| features / Суд/Аннигиляция | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Апофеоз | автоматизировано | runtime:transformations/god-events | tests/god.test.mjs |
| features / Демисциенция | частично | module:god-control, runtime:transformations/god-actions | tests/registrations.test.mjs, tests/god.test.mjs |
| features / Небесный Соперник | обоснованно вручную | — | нужна отдельная проверка |
| features / Проклятие | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Форма Ведьмы | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Межплановая Связь | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Двойное Проклятие | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Зачарованное Тело | частично | runtime:transformations/hag | tests/hag.test.mjs |
| features / Алхимическое Колдовство | автоматизировано | runtime:transformations/hag | tests/hag.test.mjs |
| features / Гадалка | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Отвратительная Внешность | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Ковен Проклятий | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Колдовство | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Наговор | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Гротескное Отражение | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Баба-Яга | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Сглаженные Заклинания | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Кукла Вуду | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Оживлённая Метла | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Проклятие Бабушки | обоснованно вручную | — | нужна отдельная проверка |
| features / Зов Ковена | частично | module:hag-control, runtime:transformations/hag-actions | tests/registrations.test.mjs, tests/hag.test.mjs |
| features / Убийственное намерение | обоснованно вручную | — | нужна отдельная проверка |
| features / Форма убийцы (1-й уровень) | обоснованно вручную | — | нужна отдельная проверка |
| features / Тёмный порыв | обоснованно вручную | — | нужна отдельная проверка |
| features / Форма убийцы (2-й уровень) | частично | dnd5e:Advancement | tests/progression.test.mjs |
| features / Да начнётся резня | обоснованно вручную | — | нужна отдельная проверка |
| features / Смертельный бег | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Смертоносный охотник | обоснованно вручную | — | нужна отдельная проверка |
| features / Алгофобия | обоснованно вручную | — | нужна отдельная проверка |
| features / Неудержимый | обоснованно вручную | — | нужна отдельная проверка |
| features / Аура резни | частично | module:choose-carnage-aura-type, aura:murderspawn-carnage | tests/registrations.test.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Первобытные рефлексы | частично | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Жажда смерти | обоснованно вручную | — | нужна отдельная проверка |
| features / Виновный | обоснованно вручную | — | нужна отдельная проверка |
| features / Неубиваемый | обоснованно вручную | — | нужна отдельная проверка |
| features / Какофония смерти | обоснованно вручную | — | нужна отдельная проверка |
| features / Идеальная разделка | обоснованно вручную | — | нужна отдельная проверка |
| features / Воплощение убийства | частично | dnd5e:utility | tools/validate.mjs |
| features / Избранный убийцы | обоснованно вручную | — | нужна отдельная проверка |
| features / Истребитель магии | частично | module:gain-hollow-charge, module:use-hollow-charges | tests/registrations.test.mjs |
| features / Негативное тело | автоматизировано | dnd5e:ActiveEffect | tests/passives.test.mjs |
| features / Полая душа | обоснованно вручную | — | нужна отдельная проверка |
| features / Выжигание заклинаний | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Аура маскировки | частично | aura:hollow-masking-aura | tests/auras.test.mjs, tests/aura-events.test.mjs |
| features / Негативный взгляд | обоснованно вручную | — | нужна отдельная проверка |
| features / Разрушающие удары | обоснованно вручную | — | нужна отдельная проверка |
| features / Магическая несовместимость | обоснованно вручную | — | нужна отдельная проверка |
| features / Ослабление чар | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Укреплённая душа | частично | runtime:midi/spell-resistance | tests/spell-resistance.test.mjs |
| features / Рассеивание | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Негативная пелена | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Резистентное тело | обоснованно вручную | — | нужна отдельная проверка |
| features / Высшее проклятие | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Рана в магии | обоснованно вручную | — | нужна отдельная проверка |
| features / Мистическая аннуляция | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Уничтожитель эфира | частично | module:use-hollow-charges | tests/registrations.test.mjs |
| features / Магическое ингибирование | обоснованно вручную | — | нужна отдельная проверка |
| equipment / Цвайхандер | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Огромный молот | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Нодати | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Одати | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Нагамаки | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Когти Порождения убийств (ур. 2) | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Когти Порождения убийств (ур. 3) | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| equipment / Когти Порождения убийств (ур. 4) | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| spells / Древесное лечение | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| spells / Бог из стали | частично | dnd5e:Item-spell | tools/validate.mjs |
| spells / Мстительное пламя | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Врата бесконечности | частично | dnd5e:Item-spell | tools/validate.mjs |
| spells / Перо правосудия | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Челюсти пожирателя звезд | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Колдовская стрела | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| spells / Кровавое копье | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Намек | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| spells / Дар хаоса | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Какофонический вопль | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| spells / Подчинение крови / Перенос крови | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Кровный трэлл | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Парящий остров Проктива / Proctiv's Floating Island | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| spells / Вечное солнце Амаунатора / Amaunator's Eternal Sun | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| spells / Огненная катаракта / Fiery Cataract | частично | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Поток Дилювиаля / Diluvial Torrent | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Ужасная засуха / Horrible Drought | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Смертоносный ветер Толодина / Tolodine's Killing Wind | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| spells / Тварь о тысяче ног / Beast of a Thousand Legs | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| spells / Волна чувств (Эмпат) | частично | module:empath-control, dnd5e:Item-spell | tests/registrations.test.mjs, tools/validate.mjs |
| bestiary / Фантом: Воин Тьмы | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Тёмное сопротивление | требует исправления | — | нужна отдельная проверка |
| bestiary / Демонический глаз | требует исправления | — | нужна отдельная проверка |
| bestiary / Демонические крылья | требует исправления | — | нужна отдельная проверка |
| bestiary / Очернённое оружие | требует исправления | — | нужна отдельная проверка |
| bestiary / Чёрные ритуалы | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака | требует исправления | — | нужна отдельная проверка |
| bestiary / Очернённый двуручный меч | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Ужасающий облик | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Улучшенный эликсир чёрной магии | требует исправления | — | нужна отдельная проверка |
| bestiary / Адская сила | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Адский щит | требует исправления | — | нужна отдельная проверка |
| bestiary / Возмездие тьмы | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Абберант | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Чувство арканы | требует исправления | — | нужна отдельная проверка |
| bestiary / Финальные изменения | требует исправления | — | нужна отдельная проверка |
| bestiary / Нестественные черты | требует исправления | — | нужна отдельная проверка |
| bestiary / Когти | требует исправления | — | нужна отдельная проверка |
| bestiary / Чудовищные глаза | требует исправления | — | нужна отдельная проверка |
| bestiary / Чудовищные рефлексы | требует исправления | — | нужна отдельная проверка |
| bestiary / Магия био-искажения | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Смертельная точность | требует исправления | — | нужна отдельная проверка |
| bestiary / Искажающий коготь | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Энергетическая природа | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Смертоносный выпад | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Ведьмин Клинок | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Закалённый разум | требует исправления | — | нужна отдельная проверка |
| bestiary / Оккультный резерв | требует исправления | — | нужна отдельная проверка |
| bestiary / Охотник на ведьм | требует исправления | — | нужна отдельная проверка |
| bestiary / Печать Ведьминого Клинка | требует исправления | — | нужна отдельная проверка |
| bestiary / Чары охотника | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака | требует исправления | — | нужна отдельная проверка |
| bestiary / Ведьмин клинок | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Мёртвая зона | требует исправления | — | нужна отдельная проверка |
| bestiary / Нематериальный вихрь | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Какофонический вопль | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Эфирная буря | требует исправления | — | нужна отдельная проверка |
| bestiary / Бастион чародея | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Фантом: Владыка Насекомых | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Хитиновый панцирь | требует исправления | — | нужна отдельная проверка |
| bestiary / Шевелящаяся броня | требует исправления | — | нужна отдельная проверка |
| bestiary / Дитя Инкубатора | требует исправления | — | нужна отдельная проверка |
| bestiary / Разум роя | требует исправления | — | нужна отдельная проверка |
| bestiary / Рой Плетения | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Природное оружие | требует исправления | — | нужна отдельная проверка |
| bestiary / Хитиновые жала | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Ползучий глаз | требует исправления | — | нужна отдельная проверка |
| bestiary / Высасывание жизни | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Изрыгание насекомых | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Фантом: Воитель Фей | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Кровь фей — Лазурный разум | требует исправления | — | нужна отдельная проверка |
| bestiary / Защита от магии — Непреодолимые чары | требует исправления | — | нужна отдельная проверка |
| bestiary / Фейская кожа — Уязвимость к Железу | требует исправления | — | нужна отдельная проверка |
| bestiary / Чары Очарования | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Химерический клинок | требует исправления | — | нужна отдельная проверка |
| bestiary / Фейская рапира | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Всплеск действий | требует исправления | — | нужна отдельная проверка |
| bestiary / Быстрые ноги — Всплеск скорости | требует исправления | — | нужна отдельная проверка |
| bestiary / Уход от опасности — Грациозный сдвиг | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Демонолог | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Очарование демонов | требует исправления | — | нужна отдельная проверка |
| bestiary / Тёмное знание и Глаза Бездны | требует исправления | — | нужна отдельная проверка |
| bestiary / Инфернальный фамильяр — квазит | требует исправления | — | нужна отдельная проверка |
| bestiary / Доминация | требует исправления | — | нужна отдельная проверка |
| bestiary / Книга Чародейства Бездны | требует исправления | — | нужна отдельная проверка |
| bestiary / Огненный снаряд | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Кинжал Бездны | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Удвоенный призыв | требует исправления | — | нужна отдельная проверка |
| bestiary / Духовные стражи Бездны | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Демоническая живучесть | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Мастер призыва | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Джаггернаут | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Славное выживание | требует исправления | — | нужна отдельная проверка |
| bestiary / Регенерирующая душа — Плоть тролля | требует исправления | — | нужна отдельная проверка |
| bestiary / Отказ от смерти | требует исправления | — | нужна отдельная проверка |
| bestiary / Несгибаемый бастион | требует исправления | — | нужна отдельная проверка |
| bestiary / Неподкупный объект | требует исправления | — | нужна отдельная проверка |
| bestiary / Осадное тело | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Осада плоти | требует исправления | — | нужна отдельная проверка |
| bestiary / Тяжёлый осадный клеймор | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Удар щитом | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Подавление строя | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Объятья жизни | требует исправления | — | нужна отдельная проверка |
| bestiary / Что за рана? | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Дьяволопоклонник | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Тёмная удача | требует исправления | — | нужна отдельная проверка |
| bestiary / Помощь Дьявола | требует исправления | — | нужна отдельная проверка |
| bestiary / Бесовский фамильяр | требует исправления | — | нужна отдельная проверка |
| bestiary / Усиленные чары | требует исправления | — | нужна отдельная проверка |
| bestiary / Ярость адского огня | требует исправления | — | нужна отдельная проверка |
| bestiary / Аура опустошённых душ | автоматизировано | aura:devil-devastated-souls | tests/auras.test.mjs, tests/aura-events.test.mjs |
| bestiary / Книга Адского Пламени | требует исправления | — | нужна отдельная проверка |
| bestiary / Огненный снаряд | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Дьявольская гвизарма | требует исправления | — | нужна отдельная проверка |
| bestiary / Атака гвизармой | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Адский захват гвизармой | требует исправления | — | нужна отдельная проверка |
| bestiary / Истязание гвизармы | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Тихое заклятие | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Еретик | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Оккультные маги | требует исправления | — | нужна отдельная проверка |
| bestiary / Нечестивость | требует исправления | — | нужна отдельная проверка |
| bestiary / Оккультный резерв | требует исправления | — | нужна отдельная проверка |
| bestiary / Оккультное колдовство | требует исправления | — | нужна отдельная проверка |
| bestiary / Теневой взрыв | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Похититель разума — Кукловод | требует исправления | — | нужна отдельная проверка |
| bestiary / Нечестивый кинжал | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Тактический оккультизм | требует исправления | — | нужна отдельная проверка |
| bestiary / Нечестивая мощь | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Оккультный шаг | требует исправления | — | нужна отдельная проверка |
| bestiary / Нечестивое оружие | требует исправления | — | нужна отдельная проверка |
| bestiary / Исчезновение | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Харроуер (Картёжник) | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Колода Астральных Тайн | требует исправления | — | нужна отдельная проверка |
| bestiary / 1. Весы | требует исправления | — | нужна отдельная проверка |
| bestiary / 2. Башня | требует исправления | — | нужна отдельная проверка |
| bestiary / 3. Стрела | требует исправления | — | нужна отдельная проверка |
| bestiary / 4. Копьё | требует исправления | — | нужна отдельная проверка |
| bestiary / 5. Кувшин | требует исправления | — | нужна отдельная проверка |
| bestiary / 6. Шпиль | требует исправления | — | нужна отдельная проверка |
| bestiary / Плутам везёт | требует исправления | — | нужна отдельная проверка |
| bestiary / В рукаве | требует исправления | — | нужна отдельная проверка |
| bestiary / Карточная магия | требует исправления | — | нужна отдельная проверка |
| bestiary / Бритвенная карта | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Сдавай их | требует исправления | — | нужна отдельная проверка |
| bestiary / Тузы бьют | требует исправления | — | нужна отдельная проверка |
| bestiary / Карточный финт | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Судейский расклад | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Крестоносец | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Божественная преданность | требует исправления | — | нужна отдельная проверка |
| bestiary / Священное снаряжение | требует исправления | — | нужна отдельная проверка |
| bestiary / Священная магия | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Праведный суд | требует исправления | — | нужна отдельная проверка |
| bestiary / Двуручный святой молот | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Осуждение | требует исправления | — | нужна отдельная проверка |
| bestiary / Вход в Ярость | требует исправления | — | нужна отдельная проверка |
| bestiary / Несокрушимая воля | требует исправления | — | нужна отдельная проверка |
| bestiary / Святая стойкость | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Праведная кара | требует исправления | — | нужна отдельная проверка |
| bestiary / Освящение | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Эгида крестоносца | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Лесной Владыка | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Сердце дуба | требует исправления | — | нужна отдельная проверка |
| bestiary / Древесный родич | требует исправления | — | нужна отдельная проверка |
| bestiary / Заклинания природы | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Сила дуба | требует исправления | — | нужна отдельная проверка |
| bestiary / Удар ветвью | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Древесный сон | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Пустить корни | требует исправления | — | нужна отдельная проверка |
| bestiary / Коряжка | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Лидер | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Тактическое присутствие — Аура командования | частично | aura:npc-leader-command | tests/auras.test.mjs, tests/aura-events.test.mjs |
| bestiary / Идеальная координация | требует исправления | — | нужна отдельная проверка |
| bestiary / Стратагемы командования | требует исправления | — | нужна отдельная проверка |
| bestiary / Отступить и перегруппироваться | требует исправления | — | нужна отдельная проверка |
| bestiary / Протянуть руку помощи | требует исправления | — | нужна отдельная проверка |
| bestiary / Держать строй | требует исправления | — | нужна отдельная проверка |
| bestiary / Тактический шаг | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Тактический выпад | требует исправления | — | нужна отдельная проверка |
| bestiary / Командирское копьё | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Направить атаку | требует исправления | — | нужна отдельная проверка |
| bestiary / Мгновение славы — Сейчас или никогда | требует исправления | — | нужна отдельная проверка |
| bestiary / Проницательный умысел | требует исправления | — | нужна отдельная проверка |
| bestiary / Мгновение славы — Поверь в себя | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Маг Крови | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Холст плоти | требует исправления | — | нужна отдельная проверка |
| bestiary / Малефикар — Слабость | требует исправления | — | нужна отдельная проверка |
| bestiary / Сотворение заклинаний Магии Крови | требует исправления | — | нужна отдельная проверка |
| bestiary / Гримуар Гемомантии | требует исправления | — | нужна отдельная проверка |
| bestiary / Кровавый снаряд | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Ритуальный кинжал | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Пир павших | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Подчинение крови | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Перенос крови | требует исправления | — | нужна отдельная проверка |
| bestiary / Жертва во имя магии | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Фантом: Мерцающий | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Внутреннее мерцание | требует исправления | — | нужна отдельная проверка |
| bestiary / Сдвиг в сторону | требует исправления | — | нужна отдельная проверка |
| bestiary / Чудесное возвращение домой | требует исправления | — | нужна отдельная проверка |
| bestiary / Магия Координат | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Разрыв координат | требует исправления | — | нужна отдельная проверка |
| bestiary / Пространственный разрез | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Внешнее мерцание | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Чувство сдвига | требует исправления | — | нужна отдельная проверка |
| bestiary / Мерцающий шаг | требует исправления | — | нужна отдельная проверка |
| bestiary / Мерцание с разворотом | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Нетерийский Арканист | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Учёный арканист | требует исправления | — | нужна отдельная проверка |
| bestiary / Древнее знание | требует исправления | — | нужна отдельная проверка |
| bestiary / Истощение Великих Заклинаний | требует исправления | — | нужна отдельная проверка |
| bestiary / Плетение Нетерила | требует исправления | — | нужна отдельная проверка |
| bestiary / Мистический заряд | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Развёртывание Мини-мифала | требует исправления | — | нужна отдельная проверка |
| bestiary / Защитный барьер | требует исправления | — | нужна отдельная проверка |
| bestiary / Пространственный контроль | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Поток Илионида — Великое заклинание | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Перегрузка Плетения | требует исправления | — | нужна отдельная проверка |
| bestiary / Поглощение мифала | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Онмёдзи | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Обряд очищения | требует исправления | — | нужна отдельная проверка |
| bestiary / Место Духа | требует исправления | — | нужна отдельная проверка |
| bestiary / Энергия Ки | требует исправления | — | нужна отдельная проверка |
| bestiary / Магия Свитков | требует исправления | — | нужна отдельная проверка |
| bestiary / Священное пламя | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Ритуальный посох | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Талисман Шикигами — Шикигами Призрачный Охотник | требует исправления | — | нужна отдельная проверка |
| bestiary / Атака Шикигами | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Призыв Мирового Духа | требует исправления | — | нужна отдельная проверка |
| bestiary / Дух Огня — Очищение | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Дух Стали — Твёрдость | требует исправления | — | нужна отдельная проверка |
| bestiary / Дух Ветра — Свобода | требует исправления | — | нужна отдельная проверка |
| bestiary / Малая Великая Чара стихий | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Защитный Обряд Омамори | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Оракул | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Истинное видение | требует исправления | — | нужна отдельная проверка |
| bestiary / Дилемма Диссонанса | требует исправления | — | нужна отдельная проверка |
| bestiary / Штраф Диссонанса | требует исправления | — | нужна отдельная проверка |
| bestiary / Нити Времени | требует исправления | — | нужна отдельная проверка |
| bestiary / Нить судьбы | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Воздействие на судьбу | требует исправления | — | нужна отдельная проверка |
| bestiary / Промах | требует исправления | — | нужна отдельная проверка |
| bestiary / Попадание | требует исправления | — | нужна отдельная проверка |
| bestiary / Главный секрет Оракула | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Переплетение связей | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Баланс судьбы | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Фантом: Падший Жрец | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Отступничество | требует исправления | — | нужна отдельная проверка |
| bestiary / Сопротивление божественному | требует исправления | — | нужна отдельная проверка |
| bestiary / Изгнание нежити | требует исправления | — | нужна отдельная проверка |
| bestiary / Украденное Плетение | требует исправления | — | нужна отдельная проверка |
| bestiary / Осквернённое пламя | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Нечестивый посох | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Поглощение силы | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Карантинные арканы | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Зеркальный догмат | требует исправления | — | нужна отдельная проверка |
| bestiary / Копирование божественного | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Фантом: Пожиратель Душ | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Омерзение природы | требует исправления | — | нужна отдельная проверка |
| bestiary / Осколок души | требует исправления | — | нужна отдельная проверка |
| bestiary / Магия поглощённых искр | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Разрыв души | требует исправления | — | нужна отдельная проверка |
| bestiary / Разрыв души | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Сила души | требует исправления | — | нужна отдельная проверка |
| bestiary / Поглощение души | требует исправления | — | нужна отдельная проверка |
| bestiary / Обмен душами | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Призрачный Странник | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Тронутый смертью — Полуживой | требует исправления | — | нужна отдельная проверка |
| bestiary / Духовное зрение | требует исправления | — | нужна отдельная проверка |
| bestiary / Родственный дух | требует исправления | — | нужна отдельная проверка |
| bestiary / Разорванная связь | требует исправления | — | нужна отдельная проверка |
| bestiary / Призрачные обряды | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Поступь мертвеца | требует исправления | — | нужна отдельная проверка |
| bestiary / Призрачное касание | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Одержимость | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Незаконченное дело | требует исправления | — | нужна отдельная проверка |
| bestiary / Форма духа | требует исправления | — | нужна отдельная проверка |
| bestiary / Эфирное скольжение | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Увядающая магия | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Бесплотная защита | требует исправления | — | нужна отдельная проверка |
| bestiary / Потустороннее присутствие | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Фантом: Ритуалист | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Духовное зрение | требует исправления | — | нужна отдельная проверка |
| bestiary / Разум и тело — Абсолютная концентрация | требует исправления | — | нужна отдельная проверка |
| bestiary / Бережный круг защиты | требует исправления | — | нужна отдельная проверка |
| bestiary / Оккультный резерв — Духовный пул | требует исправления | — | нужна отдельная проверка |
| bestiary / Ритуальные заговоры | требует исправления | — | нужна отдельная проверка |
| bestiary / Духовный луч | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Ритуальный посох | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Ритуал призыва | требует исправления | — | нужна отдельная проверка |
| bestiary / Призванный дух | требует исправления | — | нужна отдельная проверка |
| bestiary / Духовная атака | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Потеря контроля | требует исправления | — | нужна отдельная проверка |
| bestiary / Призрачный удар | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Укрощение эго | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Духовная передача | требует исправления | — | нужна отдельная проверка |
| bestiary / Канал духов — Кровь к плоти | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Сокрушитель | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Стиль огромного оружия — Раскалывание | требует исправления | — | нужна отдельная проверка |
| bestiary / Убийца гигантов | требует исправления | — | нужна отдельная проверка |
| bestiary / Импульс и стальная воля | требует исправления | — | нужна отдельная проверка |
| bestiary / Стальной гигант — Несокрушимость | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Стальной шквал | требует исправления | — | нужна отдельная проверка |
| bestiary / Струнный молот | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Техника: Раскалывание | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Техника: Превосходный контроль | требует исправления | — | нужна отдельная проверка |
| bestiary / Техника: Адаптивность | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Сосуд Духа | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Усложнённое Эго — Двойное сопротивление | требует исправления | — | нужна отдельная проверка |
| bestiary / Сонливость и беспокойный разум | требует исправления | — | нужна отдельная проверка |
| bestiary / Концентрированный удар | требует исправления | — | нужна отдельная проверка |
| bestiary / Магия Духовного Договора | требует исправления | — | нужна отдельная проверка |
| bestiary / Луч духа | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Духовное прикосновение | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Экзамен Воли — Ангельское очарование | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Вход в Поток | требует исправления | — | нужна отдельная проверка |
| bestiary / Превосходство ловкости | требует исправления | — | нужна отдельная проверка |
| bestiary / Эфирная защита | требует исправления | — | нужна отдельная проверка |
| bestiary / Ментальный прилив | требует исправления | — | нужна отдельная проверка |
| bestiary / Тактический Поток | требует исправления | — | нужна отдельная проверка |
| bestiary / Зеркальное отречение | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Фантом: Страж | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Призвание стража | требует исправления | — | нужна отдельная проверка |
| bestiary / Непоколебимость | требует исправления | — | нужна отдельная проверка |
| bestiary / Несгибаемость | требует исправления | — | нужна отдельная проверка |
| bestiary / Стойкий защитник | требует исправления | — | нужна отдельная проверка |
| bestiary / Снаряжение | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Карающий рубеж | требует исправления | — | нужна отдельная проверка |
| bestiary / Тяжёлый палаш | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Метка стража | требует исправления | — | нужна отдельная проверка |
| bestiary / Мощное возмездие | требует исправления | — | нужна отдельная проверка |
| bestiary / Прыжковое возмездие | требует исправления | — | нужна отдельная проверка |
| bestiary / Возмездие спасением | требует исправления | — | нужна отдельная проверка |
| bestiary / Угрожающее возмездие | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Выдержать боль | требует исправления | — | нужна отдельная проверка |
| bestiary / Жертвенный бросок | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Хранитель | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Страж и подопечный | требует исправления | — | нужна отдельная проверка |
| bestiary / Едины и защищены | требует исправления | — | нужна отдельная проверка |
| bestiary / Уязвимые и незащищённые | требует исправления | — | нужна отдельная проверка |
| bestiary / Инженерные арканы | требует исправления | — | нужна отдельная проверка |
| bestiary / Магический разряд | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Инженерный клинок | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Проводник магии | требует исправления | — | нужна отдельная проверка |
| bestiary / Наведение на брешь | требует исправления | — | нужна отдельная проверка |
| bestiary / Экспресс-ремонт | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Перехват траектории | требует исправления | — | нужна отдельная проверка |
| bestiary / Сконструированный голем | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Мультиатака | требует исправления | — | нужна отдельная проверка |
| bestiary / Кулак стража | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Защитная стойка | требует исправления | — | нужна отдельная проверка |
| bestiary / Стальной заслон | требует исправления | — | нужна отдельная проверка |
| bestiary / Фантом: Чумной Доктор | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Разносчик заболеваний | требует исправления | — | нужна отдельная проверка |
| bestiary / Скрытая атака инфекциониста | требует исправления | — | нужна отдельная проверка |
| bestiary / Касание болезни | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Хирургическое заражение | требует исправления | — | нужна отдельная проверка |
| bestiary / Чумной скальпель | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Инфекционная игла | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Форма болезни — Растворение тела | требует исправления | — | нужна отдельная проверка |
| bestiary / Невидимость инфекции | требует исправления | — | нужна отдельная проверка |
| bestiary / Бестелесная масса | требует исправления | — | нужна отдельная проверка |
| bestiary / Аура заражения | частично | dnd5e:save, aura:npc-plague-infection | tools/validate.mjs, tests/auras.test.mjs, tests/aura-events.test.mjs |
| bestiary / Отделение умной инфекции | требует исправления | — | нужна отдельная проверка |
| bestiary / 1 очко — Слежка | требует исправления | — | нужна отдельная проверка |
| bestiary / 2 очка — Заражение | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / 3 очка — Кукловод | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Активация чумного поветрия | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Посмертный распад | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Гатц, Хранитель Вечного Гримуара(фаза 1) | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Аура Просвещения | автоматизировано | aura:gutz-enlightenment | tests/auras.test.mjs, tests/aura-events.test.mjs |
| bestiary / Легендарное сопротивление | требует исправления | — | нужна отдельная проверка |
| bestiary / Архивариус Трансформаций | требует исправления | — | нужна отдельная проверка |
| bestiary / Живая Библиотека | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Аналитическое воздействие | требует исправления | — | нужна отдельная проверка |
| bestiary / Клинок Истины | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Эффект обучения | требует исправления | — | нужна отдельная проверка |
| bestiary / Таймкод Изменений | требует исправления | — | нужна отдельная проверка |
| bestiary / Откат уязвимости | требует исправления | — | нужна отдельная проверка |
| bestiary / Коррекция ошибок | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Саркастический анализ | автоматизировано | dnd5e:save, dnd5e:utility | tools/validate.mjs |
| bestiary / Редактирование Потока | требует исправления | — | нужна отдельная проверка |
| bestiary / Это уже было в истории | требует исправления | — | нужна отдельная проверка |
| bestiary / Лень разбираться | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Призыв Хроник Мастерства | требует исправления | — | нужна отдельная проверка |
| bestiary / Правило боя | требует исправления | — | нужна отдельная проверка |
| bestiary / Вариант 1 — Ослабленные | требует исправления | — | нужна отдельная проверка |
| bestiary / Вариант 2 — Усиленные | требует исправления | — | нужна отдельная проверка |
| bestiary / Конструктор Заклинаний Гатца | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Действия логова | требует исправления | — | нужна отдельная проверка |
| bestiary / Диктующие условия | требует исправления | — | нужна отдельная проверка |
| bestiary / Живая Библиотека: все заклинания жреца и паладина | требует исправления | — | нужна отдельная проверка |
| bestiary / Карающий отблеск | автоматизировано | dnd5e:attack, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Длань заступника | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Клеймо воздаяния | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Последняя молитва | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Печать немого суда | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Причастие раны | автоматизировано | dnd5e:attack, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Цепи исповедника | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Глас небесного суда | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Хор кающихся | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Очищающий приговор | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Двойной обет стражей | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Врата последнего суда | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Крылья заступника | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Судящий столп | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Обет неугасимого сердца | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Погребальный колокол | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Хор непоколебимых | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Анафема святотатцу | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Литания возвращённого дыхания | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Сошествие архонта | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Купол семи печатей | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Небесный обвал | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Великое отпущение | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Седьмая труба | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Гатц, Хранитель Вечного Гримуара(фаза 2) | автоматизировано | dnd5e:Actor-statblock | tools/validate.mjs |
| bestiary / Двойное Возвышение Престижа | требует исправления | — | нужна отдельная проверка |
| bestiary / Парадокс Кровавой Ярости | требует исправления | — | нужна отдельная проверка |
| bestiary / Удар возвращает жизнь | требует исправления | — | нужна отдельная проверка |
| bestiary / Одиночество и увядание | требует исправления | — | нужна отдельная проверка |
| bestiary / Сверхъестественная анатомия | требует исправления | — | нужна отдельная проверка |
| bestiary / Мультиатака — Стальное сечение | требует исправления | — | нужна отдельная проверка |
| bestiary / Клинок Силы | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Разрушение доспехов | требует исправления | — | нужна отдельная проверка |
| bestiary / Мёртвая зона | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Заготовленный приём | требует исправления | — | нужна отдельная проверка |
| bestiary / Прицельные рывки | автоматизировано | dnd5e:utility | tools/validate.mjs |
| bestiary / Шторм клинков | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Разрубание мира | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Упреждающий выпад | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Скользящий шаг | требует исправления | — | нужна отдельная проверка |
| bestiary / Перенятый опыт | требует исправления | — | нужна отдельная проверка |
| bestiary / Наказание за промах | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Встречное парирование | автоматизировано | dnd5e:attack, dnd5e:Item-weapon | tools/validate.mjs |
| bestiary / Перенаправление силы | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Анатомический укол | автоматизировано | dnd5e:save | tools/validate.mjs |
| bestiary / Разрушение стойки | требует исправления | — | нужна отдельная проверка |
| bestiary / Разрыв сухожилий | требует исправления | — | нужна отдельная проверка |
| bestiary / Глухая пешая защита | требует исправления | — | нужна отдельная проверка |
| bestiary / Действия логова | требует исправления | — | нужна отдельная проверка |
| bestiary / Диктующие условия | требует исправления | — | нужна отдельная проверка |
| bestiary / Живая Библиотека: все заклинания жреца и паладина | требует исправления | — | нужна отдельная проверка |
| bestiary / Карающий отблеск | автоматизировано | dnd5e:attack, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Длань заступника | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Клеймо воздаяния | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Последняя молитва | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Печать немого суда | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Причастие раны | автоматизировано | dnd5e:attack, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Цепи исповедника | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Глас небесного суда | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Хор кающихся | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Очищающий приговор | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Двойной обет стражей | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Врата последнего суда | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Крылья заступника | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Судящий столп | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Обет неугасимого сердца | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Погребальный колокол | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Хор непоколебимых | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Анафема святотатцу | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Литания возвращённого дыхания | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Сошествие архонта | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Купол семи печатей | автоматизировано | dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Небесный обвал | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Великое отпущение | автоматизировано | dnd5e:utility, dnd5e:Item-spell | tools/validate.mjs |
| bestiary / Седьмая труба | автоматизировано | dnd5e:save, dnd5e:Item-spell | tools/validate.mjs |
