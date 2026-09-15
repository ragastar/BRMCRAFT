// Живой калькулятор финмодели: пять ползунков, три результата, столбчатый
// график накопленного результата по 24 месяцам. Vanilla JS, без библиотек.

import { DEFAULTS, simulate } from "./model.js";

const SLIDERS = [
  { key: "sales", label: "Продаж в месяц после первой партии", min: 10, max: 60, step: 5, value: DEFAULTS.sales, fmt: (v) => String(v) },
  { key: "share", label: "Доля покупателей, которые платят подписку", min: 30, max: 90, step: 5, value: DEFAULTS.share * 100, fmt: (v) => `${v} %`, scale: 0.01 },
  { key: "churn", label: "Отток подписчиков в месяц", min: 2, max: 8, step: 1, value: DEFAULTS.churn * 100, fmt: (v) => `${v} %`, scale: 0.01 },
  { key: "minutes", label: "Минут на пользователя в месяц", min: 100, max: 1200, step: 50, value: DEFAULTS.minutes, fmt: (v) => String(v) },
  { key: "ppm", label: "Цена минуты распознавания", min: 0.1, max: 1.5, step: 0.1, value: DEFAULTS.ppm, fmt: (v) => `${v.toFixed(1).replace(".", ",")} ₽` },
];

const RESULTS = [
  { key: "invest", label: "Нужно вложить" },
  { key: "month", label: "Месяц выхода в плюс" },
  { key: "total", label: "Результат за 24 месяца" },
];

const CHART_W = 480;
const CHART_H = 160;

const nbsp = " ";

function money(v) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(".", ",")}${nbsp}млн${nbsp}₽`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}${nbsp}тыс.${nbsp}₽`;
  return `${sign}${Math.round(abs)}${nbsp}₽`;
}

export function initCalculator(root) {
  if (!root) return;

  root.innerHTML = `
    <div class="calc__sliders">
      ${SLIDERS.map(
        (s) => `
        <label class="slider">
          <span class="slider__head"><span>${s.label}</span><output data-out="${s.key}"></output></span>
          <input type="range" name="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}" />
        </label>`,
      ).join("")}
    </div>
    <div class="calc__results">
      ${RESULTS.map((r) => `<div class="res"><b data-res="${r.key}"></b><span data-res-label="${r.key}">${r.label}</span></div>`).join("")}
    </div>
    <svg class="calc__chart" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none" aria-hidden="true"></svg>
  `;

  const inputs = Object.fromEntries(SLIDERS.map((s) => [s.key, root.querySelector(`input[name="${s.key}"]`)]));
  const outs = Object.fromEntries(SLIDERS.map((s) => [s.key, root.querySelector(`output[data-out="${s.key}"]`)]));
  const res = Object.fromEntries(RESULTS.map((r) => [r.key, root.querySelector(`[data-res="${r.key}"]`)]));
  const resLabel = Object.fromEntries(RESULTS.map((r) => [r.key, root.querySelector(`[data-res-label="${r.key}"]`)]));
  const chart = root.querySelector(".calc__chart");

  function read() {
    const p = {};
    for (const s of SLIDERS) {
      const raw = Number(inputs[s.key].value);
      outs[s.key].textContent = s.fmt(raw);
      p[s.key] = s.scale ? raw * s.scale : raw;
    }
    return p;
  }

  function drawChart(cumulative) {
    const maxPos = Math.max(0, ...cumulative);
    const maxNeg = Math.max(0, ...cumulative.map((v) => -v));
    const span = maxPos + maxNeg || 1;
    const baseline = (maxPos / span) * CHART_H;
    const slot = CHART_W / cumulative.length;
    const gap = 3;
    chart.innerHTML = cumulative
      .map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / span) * CHART_H);
        const y = v >= 0 ? baseline - h : baseline;
        const fill = v >= 0 ? "#DDE6F0" : "#C8102E";
        return `<rect x="${(i * slot + gap / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${(slot - gap).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" />`;
      })
      .join("");
  }

  function update() {
    const out = simulate(read());
    res.invest.textContent = money(out.invest);
    if (out.breakevenMonth) {
      res.month.textContent = `${out.breakevenMonth}-й`;
      resLabel.month.textContent = "Месяц выхода в плюс";
    } else {
      res.month.textContent = "—";
      resLabel.month.textContent = "Не выходит в плюс за 24 месяца";
    }
    res.total.textContent = money(out.total);
    drawChart(out.cumulative);
    root.dataset.invest = Math.round(out.invest);
    root.dataset.month = out.breakevenMonth ?? "";
    root.dataset.total = Math.round(out.total);
  }

  for (const input of Object.values(inputs)) input.addEventListener("input", update);
  update();
}
