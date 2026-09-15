import { defineConfig } from "vite";

// BASE_PATH задаётся в GitHub Actions как "/<имя-репозитория>/".
// Для кастомного домена (projectlevin.ru) — "/" и файл public/CNAME.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: {
    target: "es2020",
    sourcemap: false,
    // index.html — вариант 1, v2.html — вариант 2 (расширенный: +5 панелей)
    rollupOptions: {
      input: { main: "index.html", v2: "v2.html", invest: "invest-7k2m9x/index.html" },
    },
  },
});
