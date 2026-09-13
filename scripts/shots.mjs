// Скриншоты лендинга через Playwright: 390×844 (мобильный) и 1440×900.
// Запуск: npm run build && npm run preview  (в другом терминале)  →  npm run shots
// Переменные: SHOT_URL (по умолчанию http://localhost:4173/), SHOT_DIR (shots),
// PW_CHROMIUM — путь к бинарнику Chromium, если версия playwright не совпадает
// с установленным браузером.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.SHOT_URL || "http://localhost:4173/";
const out = process.env.SHOT_DIR || "shots";
mkdirSync(out, { recursive: true });

const sizes = [
  { name: "mobile", width: 390, height: 844, dsf: 2, mobile: true },
  { name: "desktop", width: 1440, height: 900, dsf: 1, mobile: false },
];

// В песочнице наружу пускает только прокси из HTTPS_PROXY — отдаём его Chromium,
// иначе Google Fonts не загрузятся и скриншоты покажут запасной шрифт.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
});
const onlyTop = !!process.env.SHOT_ONLY_TOP;

for (const s of sizes) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: s.dsf,
    isMobile: s.mobile,
    hasTouch: s.mobile,
    reducedMotion: process.env.SHOT_REDUCED ? "reduce" : "no-preference",
    ignoreHTTPSErrors: !!proxy,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[${s.name}] pageerror:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`[${s.name}] console.${m.type()}:`, m.text());
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/${s.name}-top.png` });
  if (onlyTop) {
    await ctx.close();
    continue;
  }

  // Каждая панель: прокручиваем так, чтобы её верх встал на 55% высоты окна
  // (нижняя половина под устройством), ждём анимации, снимаем.
  const count = await page.locator(".panel").count();
  for (let i = 0; i < count; i++) {
    await page.evaluate((i) => {
      const el = document.querySelectorAll(".panel")[i];
      const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.55 + 2;
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo({ top: y, behavior: "instant" });
    }, i);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${out}/${s.name}-panel${i + 1}.png` });
  }
  await page.evaluate(() => {
    const y = document.body.scrollHeight;
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: "instant" });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${s.name}-bottom.png` });
  await ctx.close();
}
await browser.close();
console.log(`ok → ${out}/`);
