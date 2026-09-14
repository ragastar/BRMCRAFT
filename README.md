# Левин — лендинг

Лендинг устройства «Левин»: ИИ-диктофон, который работает в России без VPN,
с оплатой в рублях. Цель — собрать лист ожидания и показать концепт инвесторам.
Устройство рендерится в 3D прямо на странице.

**Стек:** Vite + vanilla JS, Three.js (устройство), GSAP ScrollTrigger (скролл),
Lenis (плавность). Шрифты Unbounded и Golos Text размещены локально в
`public/fonts` (OFL), чтобы страница не зависела от fonts.googleapis.com.

## Запуск

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run preview    # http://localhost:4173 — собранная версия
```

## Скриншоты (Playwright)

```sh
npm run build && npm run preview     # в одном терминале
npm run shots                        # в другом → shots/*.png, 390×844 и 1440×900
```

Полезные переменные: `SHOT_ONLY_TOP=1` — только первый экран,
`SHOT_STATE=record` — снять устройство в нужном состоянии глаза,
`SHOT_FORM=1` — заполнить и отправить форму, `SHOT_REDUCED=1` — режим
prefers-reduced-motion.

## Устройство и глаз

- `src/device.js` — кулон в форме глаза: миндалевидный корпус 60×28×9 мм,
  экран, кнопка на торце, ушко и шнур, свет, камера, поворот по скроллу.
- `src/eye.js` — глаз рисуется на 2D-canvas и идёт текстурой на экран.
  Состояния (`open`, `half`, `record`, `text`, `cold`, `letter`) описаны
  в `EYE_STATES`, панели ссылаются на них через `data-eye` в `index.html`.

## Форма листа ожидания

Заявка уходит в Telegram через Cloudflare Worker — см. [worker/README.md](worker/README.md).
Адрес воркера задаётся переменной `VITE_WAITLIST_ENDPOINT` (`.env.example`).
Без неё форма работает в режиме «записали» и ничего не отправляет.

## Деплой

`.github/workflows/pages.yml` собирает сайт и публикует его на GitHub Pages
при пуше в `master`. В настройках репозитория: Settings → Pages → Source →
**GitHub Actions**. Адрес: `https://<пользователь>.github.io/<репозиторий>/`.
Для своего домена задайте переменную репозитория `BASE_PATH=/` и добавьте
файл `public/CNAME`.
