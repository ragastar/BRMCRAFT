# Воркер листа ожидания → Telegram

Серверлесс-функция на Cloudflare Workers. Принимает `POST` с JSON
`{ name, email, page }` от формы на лендинге и отправляет сообщение в Telegram
через бота. Токен и chat_id живут в секретах Cloudflare, не в репозитории.

## Разворот

```sh
cd worker
npx wrangler login
npx wrangler secret put TG_BOT_TOKEN    # токен от @BotFather
npx wrangler secret put TG_CHAT_ID      # id чата: напишите боту и посмотрите
                                        # https://api.telegram.org/bot<TOKEN>/getUpdates
npx wrangler deploy
```

После деплоя wrangler покажет адрес вида `https://levin-waitlist.<аккаунт>.workers.dev`.

## Подключить к лендингу

Адрес воркера передаётся в сборку переменной `VITE_WAITLIST_ENDPOINT`:

- локально — файл `.env` (см. `.env.example`);
- на GitHub Pages — переменная репозитория `WAITLIST_ENDPOINT`
  (Settings → Secrets and variables → Actions → Variables), её читает
  `.github/workflows/pages.yml`.

Пока переменной нет, форма работает в режиме «записали»: показывает
подтверждение, но никуда не отправляет и пишет заявку в консоль браузера.

## Разрешённые источники

`ALLOWED_ORIGINS` в `wrangler.toml` — список origin'ов, с которых воркер
принимает запросы. Добавьте свой домен, если он не `ragastar.github.io`
и не `projectlevin.ru`.
