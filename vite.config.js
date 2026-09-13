import { defineConfig } from "vite";

// BASE_PATH задаётся в GitHub Actions как "/<имя-репозитория>/".
// Для кастомного домена (projectlevin.ru) — "/" и файл public/CNAME.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
