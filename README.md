# omilevin — Craft Advisor для Path of Exile 2

Оверлей для PoE 2, который на наведённый предмет отвечает не «сколько стоит»,
а **что докрутить, каким методом и с какой вероятностью**, чтобы предмет стоил
кратно дороже.

Форк [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (MIT), который
в свою очередь форк [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade).
Штатный прайс-чек EE2 сохранён как есть, поверх него добавлен виджет
**Craft Advisor** (хоткей **Ctrl + E**).

## Как это работает

1. **Слой 0** — база, iLvl, занятые и свободные слоты префиксов/суффиксов.
2. **Слой 2** — сравнимые предметы из trade2 (не меньше двух общих модов, выборка 40).
3. **Слой 3** — «шаблон базы»: частота модов + лучший достижимый тир →
   рекомендации keep / improve / add с учётом свободных слотов.
4. **Слой 5** — Claude через локальный `claude` CLI на подписке объясняет метод
   крафта (эссенция, экзальт, аннул, …) и приблизительную вероятность.

Цена листингов намеренно не используется: рынок poe2 бимодален (transmute-джанк
и mirror-витрины), среднего нет. Текущую цену показывает штатный прайс-чек EE2
(Ctrl + D). Подробности — в PRD, раздел 10.

## Запуск (dev)

```sh
cd renderer && npm i && npm run make-index-files && npm run dev   # vite :5173
cd main && npm i && npm run dev                                   # electron overlay
```

На Windows `start-craft-advisor.bat` поднимает оба процесса одним кликом.
Для кнопки «Подробнее от Claude» нужен установленный и залогиненный Claude Code.

Сборка инсталлятора: `cd renderer && npm run build`, затем
`cd main && npm run build && npm run package`.

## Тесты

```sh
cd renderer && npx vitest run specs/craft-advisor/
CRAFT_LIVE=1 npx vitest run specs/craft-advisor/live.test.ts   # живая trade2-сессия
```

## Документация

- [docs/craft-advisor.md](./docs/craft-advisor.md) — руководство по виджету
- [PRD-craft-advisor-v2.md](./PRD-craft-advisor-v2.md) — замысел и as-built (раздел 10)
- [DEVELOPING.md](./DEVELOPING.md) — устройство, сборка, релиз

## Лицензия

MIT, см. [LICENSE](./LICENSE). Копирайт-нотисы Awakened PoE Trade и
Exiled Exchange 2 сохранены.
