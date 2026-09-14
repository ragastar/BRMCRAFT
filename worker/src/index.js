// Cloudflare Worker: принимает заявку из формы листа ожидания и пересылает её
// в Telegram через бота. Секреты (в репозиторий не кладём):
//   wrangler secret put TG_BOT_TOKEN   — токен бота от @BotFather
//   wrangler secret put TG_CHAT_ID     — id чата/канала, куда слать заявки
// Переменная ALLOWED_ORIGINS (wrangler.toml) — список origin'ов через запятую.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin || "*" : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    if (!originOk) return json({ error: "origin_not_allowed" }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400, cors);
    }

    // honeypot: боты заполняют скрытое поле — отвечаем «ок», но ничего не шлём
    if (body.company) return json({ ok: true }, 200, cors);

    const name = String(body.name || "")
      .trim()
      .slice(0, 120);
    const email = String(body.email || "")
      .trim()
      .slice(0, 200);
    const page = String(body.page || "")
      .trim()
      .slice(0, 300);
    if (!name || !EMAIL_RE.test(email)) return json({ error: "invalid" }, 400, cors);

    if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) {
      return json({ error: "not_configured" }, 503, cors);
    }

    const text = ["Лист ожидания «Левин»", `Имя: ${name}`, `Почта: ${email}`, page ? `Страница: ${page}` : null]
      .filter(Boolean)
      .join("\n");

    const tg = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!tg.ok) return json({ error: "telegram_failed" }, 502, cors);

    return json({ ok: true }, 200, cors);
  },
};
