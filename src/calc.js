// Живой калькулятор финмодели (vanilla JS): сценарии, семь ползунков,
// юнит-экономика, три результата, график, блок инвестора, чувствительность,
// таблица по месяцам. Сама модель — в model.js.

import {
  ASSUMPTIONS as A,
  SCENARIOS,
  DEFAULTS,
  simulate,
  payback,
  unitEconomics,
  sensitivity,
  paybackTable,
} from "./model.js";

const SLIDERS = [
  { key: "deals", label: "Сделок в месяц", min: 1, max: 10, step: 1, fmt: (v) => String(v) },
  { key: "devices", label: "Устройств в сделке", min: 5, max: 100, step: 5, fmt: (v) => String(v) },
  { key: "growth", label: "Рост продаж в месяц после разгона", min: 0, max: 15, step: 1, scale: 0.01, fmt: (v) => `${v} %` },
  { key: "included", label: "Включено месяцев подписки", min: 3, max: 12, step: 1, fmt: (v) => `${v} мес.` },
  { key: "renewal", label: "Продлевают после включённого периода", min: 30, max: 90, step: 5, scale: 0.01, fmt: (v) => `${v} %` },
  { key: "churn", label: "Отток мест в месяц", min: 2, max: 8, step: 1, scale: 0.01, fmt: (v) => `${v} %` },
  { key: "minutes", label: "Минут на место в месяц", min: 100, max: 600, step: 50, fmt: (v) => String(v) },
];

const SCENARIO_LABELS = { careful: "Осторожный", base: "Базовый", aggressive: "Агрессивный" };
const ROUND = { min: 0.6, max: 2, step: 0.1, value: 1.5 }; // млн ₽

const CHART_W = 480;
const CHART_H = 160;
const nbsp = " ";

function money(v, signed = false) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(".", ",")}${nbsp}млн${nbsp}₽`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}${nbsp}тыс.${nbsp}₽`;
  return `${sign}${Math.round(abs)}${nbsp}₽`;
}
const rub = (v) => `${Math.round(v).toLocaleString("ru-RU")}${nbsp}₽`;
const int = (v) => Math.round(v).toLocaleString("ru-RU");

function sliderHtml(s, value) {
  return `
    <label class="slider">
      <span class="slider__head"><span>${s.label}</span><output data-out="${s.key}"></output></span>
      <input type="range" name="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${value}" />
    </label>`;
}

export function initCalculator(root, opts = {}) {
  if (!root) return;
  const paybackRoot = opts.paybackRoot || null;

  root.innerHTML = `
    <div class="calc__scenarios" role="group" aria-label="Сценарии">
      ${Object.keys(SCENARIOS)
        .map((k) => `<button type="button" class="chip${k === "base" ? " is-active" : ""}" data-scn="${k}">${SCENARIO_LABELS[k]}</button>`)
        .join("")}
    </div>
    <div class="calc__grid">
      <div class="calc__sliders">
        ${SLIDERS.map((s) => sliderHtml(s, s.scale ? Math.round(DEFAULTS[s.key] / s.scale) : DEFAULTS[s.key])).join("")}
      </div>
      <div class="calc__unit">
        <p class="eyebrow">Юнит-экономика</p>
        <dl class="kv">
          <div><dt>Вклад одного устройства</dt><dd data-ue="device"></dd></div>
          <div><dt>Обслуживание места в месяц</dt><dd data-ue="seatCost"></dd></div>
          <div><dt>Вклад места в месяц после включённого периода</dt><dd data-ue="seat"></dd></div>
          <div><dt>Комиссия продавца с устройства</dt><dd data-ue="commission"></dd></div>
        </dl>
      </div>
    </div>
    <div class="calc__results">
      <div class="res"><b data-res="invest"></b><span data-res-label="invest">Нужно вложить</span></div>
      <div class="res"><b data-res="month"></b><span data-res-label="month">Месяц выхода в плюс</span></div>
      <div class="res"><b data-res="total"></b><span data-res-label="total">Результат за 24 месяца</span></div>
    </div>
    <div class="calc__chartwrap">
      <svg class="calc__chart" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="calc__marker" hidden></div>
      <p class="calc__hover muted small">Накопленный результат по месяцам. Наведите на столбец.</p>
    </div>
    <div class="calc__investor">
      <p class="eyebrow">Инвестору</p>
      <label class="slider">
        <span class="slider__head"><span>Сумма раунда</span><output data-out="round"></output></span>
        <input type="range" name="round" min="${ROUND.min}" max="${ROUND.max}" step="${ROUND.step}" value="${ROUND.value}" />
      </label>
      <div class="calc__results calc__results--investor">
        <div class="res"><b data-inv="month"></b><span data-inv-label="month">Месяц возврата раунда</span></div>
        <div class="res"><b data-inv="units"></b><span>Устройств продано к возврату</span></div>
        <div class="res"><b data-inv="multiple"></b><span>Прибыль за 24 месяца к раунду</span></div>
      </div>
      <p class="muted small">
        Транши берутся по потребности, а после выхода в плюс вся чистая прибыль идёт инвестору, пока
        не вернётся весь раунд.
      </p>
    </div>
    <div class="calc__sens">
      <p class="eyebrow">Что сильнее всего влияет</p>
      <table class="table table--tight"><tbody data-sens></tbody></table>
      <p class="muted small">Изменение результата за 24 месяца при сдвиге параметра на один шаг ползунка.</p>
    </div>
    <details class="calc__table">
      <summary>Таблица по месяцам</summary>
      <div class="table-scroll">
        <table class="table table--tight">
          <thead><tr><th>Мес.</th><th>Устройств</th><th>Мест включено</th><th>Мест платных</th><th>Выручка</th><th>Расходы</th><th>Результат</th><th>Накопленно</th></tr></thead>
          <tbody data-rows></tbody>
        </table>
      </div>
    </details>
    <p class="calc__assumptions muted small">
      Допущения: цена ${int(A.price)} ₽; себестоимость ${int(A.cogsEarly)} ₽, после ${A.cogsThreshold} штук — ${int(A.cogsLate)} ₽;
      минимальный тариф после включённого периода ${A.tier} ₽ за место в месяц; минута распознавания
      ${String(A.ppm).replace(".", ",")} ₽ плюс ${A.userFixed} ₽ на место; комиссия продавца ${A.commission * 100} %;
      эквайринг и налог ${A.acqTax * 100} %; постоянные ${int(A.fixed / 1000)} тыс. ₽ в месяц; реклама
      ${int(A.marketing.perMonth / 1000)} тыс. ₽ в месяцы ${A.marketing.from}–${A.marketing.to}; разовые: прототип 150 тыс.
      в 1-м месяце, демо-партия и материалы 300 тыс. во 2-м, декларация ЭМС и юрист 120 тыс. в 5-м;
      первые счета с ${A.firstSalesMonth}-го месяца, разгон ${A.rampMonths} месяца. Компоненты под заказы —
      из предоплаты клиентов.
    </p>
  `;

  const q = (sel) => root.querySelector(sel);
  const inputs = Object.fromEntries(SLIDERS.map((s) => [s.key, q(`input[name="${s.key}"]`)]));
  const outs = Object.fromEntries(SLIDERS.map((s) => [s.key, q(`output[data-out="${s.key}"]`)]));
  const roundInput = q('input[name="round"]');
  const roundOut = q('output[data-out="round"]');
  const chart = q(".calc__chart");
  const marker = q(".calc__marker");
  const hover = q(".calc__hover");
  const chips = [...root.querySelectorAll("[data-scn]")];

  function readParams() {
    const p = {};
    for (const s of SLIDERS) {
      const raw = Number(inputs[s.key].value);
      outs[s.key].textContent = s.fmt(raw);
      p[s.key] = s.scale ? raw * s.scale : raw;
    }
    return p;
  }
  function readRound() {
    const v = Number(roundInput.value);
    roundOut.textContent = `${v.toFixed(1).replace(".", ",")}${nbsp}млн${nbsp}₽`;
    return Math.round(v * 1e6);
  }

  let lastSim = null;

  function drawChart(sim) {
    const cum = sim.cumulative;
    const maxPos = Math.max(0, ...cum);
    const maxNeg = Math.max(0, ...cum.map((v) => -v));
    const span = maxPos + maxNeg || 1;
    const baseline = (maxPos / span) * CHART_H;
    const slot = CHART_W / cum.length;
    const gap = 3;
    chart.innerHTML = cum
      .map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / span) * CHART_H);
        const y = v >= 0 ? baseline - h : baseline;
        const fill = v >= 0 ? "#DDE6F0" : "#C8102E";
        return `<rect data-m="${i + 1}" x="${(i * slot + gap / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${(slot - gap).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"><title>Месяц ${i + 1}: ${money(v, true)}</title></rect>`;
      })
      .join("");
    if (sim.breakevenMonth) {
      marker.hidden = false;
      marker.style.left = `${((sim.breakevenMonth - 0.5) / cum.length) * 100}%`;
      marker.textContent = `выход в плюс, ${sim.breakevenMonth}-й месяц`;
    } else {
      marker.hidden = true;
    }
  }

  function renderSens(p) {
    const steps = Object.fromEntries(SLIDERS.map((s) => [s.key, s.scale ? s.step * s.scale : s.step]));
    const rows = sensitivity(p, steps).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    q("[data-sens]").innerHTML = rows
      .map((r) => {
        const s = SLIDERS.find((x) => x.key === r.key);
        const stepText = s.scale ? `+${s.step}${s.key === "growth" ? " п.п." : " п.п."}` : `+${s.step}`;
        const cls = r.delta < 0 ? "is-neg" : "is-pos";
        return `<tr><td>${s.label}</td><td class="muted">${stepText}</td><td class="num ${cls}">${money(r.delta, true)}</td></tr>`;
      })
      .join("");
  }

  function renderRows(sim) {
    q("[data-rows]").innerHTML = sim.rows
      .map(
        (r) =>
          `<tr><td>${r.m}</td><td class="num">${int(r.units)}</td><td class="num">${int(r.included)}</td><td class="num">${int(r.paid)}</td><td class="num">${money(r.revenue)}</td><td class="num">${money(r.costs)}</td><td class="num ${r.result < 0 ? "is-neg" : ""}">${money(r.result, true)}</td><td class="num ${r.cum < 0 ? "is-neg" : ""}">${money(r.cum, true)}</td></tr>`,
      )
      .join("");
  }

  function renderInvestor(sim, round) {
    const pb = payback(sim, round);
    q('[data-inv="month"]').textContent = pb.month ? `${pb.month}-й` : "—";
    q('[data-inv-label="month"]').textContent = pb.month ? "Месяц возврата раунда" : "Раунд не возвращается за 24 месяца";
    q('[data-inv="units"]').textContent = pb.units ? int(pb.units) : "—";
    q('[data-inv="multiple"]').textContent =
      pb.multiple != null && pb.multiple > 0 ? `×${pb.multiple.toFixed(1).replace(".", ",")}` : "—";
    if (paybackRoot) renderPayback(paybackRoot, round, sim, pb);
  }

  function update() {
    const p = readParams();
    const round = readRound();
    const sim = simulate(p);
    lastSim = sim;
    const ue = unitEconomics(p);
    q('[data-ue="device"]').textContent = rub(ue.device);
    q('[data-ue="seatCost"]').textContent = rub(ue.seatCost);
    q('[data-ue="seat"]').textContent = rub(ue.seat);
    q('[data-ue="commission"]').textContent = rub(ue.commission);

    q('[data-res="invest"]').textContent = money(sim.invest);
    if (sim.breakevenMonth) {
      q('[data-res="month"]').textContent = `${sim.breakevenMonth}-й`;
      q('[data-res-label="month"]').textContent = "Месяц выхода в плюс";
    } else {
      q('[data-res="month"]').textContent = "—";
      q('[data-res-label="month"]').textContent = "Не выходит в плюс за 24 месяца";
    }
    q('[data-res="total"]').textContent = money(sim.total, true);
    drawChart(sim);
    renderSens(p);
    renderRows(sim);
    renderInvestor(sim, round);

    root.dataset.invest = Math.round(sim.invest);
    root.dataset.month = sim.breakevenMonth ?? "";
    root.dataset.total = Math.round(sim.total);
    root.dataset.units = sim.unitsTotal;
  }

  function applyScenario(name) {
    const p = SCENARIOS[name];
    for (const s of SLIDERS) inputs[s.key].value = s.scale ? Math.round(p[s.key] / s.scale) : p[s.key];
    chips.forEach((c) => c.classList.toggle("is-active", c.dataset.scn === name));
    update();
  }

  chips.forEach((c) => c.addEventListener("click", () => applyScenario(c.dataset.scn)));
  for (const input of Object.values(inputs)) {
    input.addEventListener("input", () => {
      chips.forEach((c) => c.classList.remove("is-active"));
      update();
    });
  }
  roundInput.addEventListener("input", () => {
    readRound();
    if (lastSim) renderInvestor(lastSim, readRound());
  });
  chart.addEventListener("mousemove", (e) => {
    const t = e.target.closest("rect");
    if (!t || !lastSim) return;
    const m = Number(t.dataset.m);
    hover.textContent = `Месяц ${m}: ${money(lastSim.cumulative[m - 1], true)} накопленно, за месяц ${money(lastSim.rows[m - 1].result, true)}`;
  });
  chart.addEventListener("mouseleave", () => {
    hover.textContent = "Накопленный результат по месяцам. Наведите на столбец.";
  });

  update();
  root.__applyScenario = applyScenario;
}

// Блок «Что вернётся инвестору»: таблица условий продажи и итог по модели.
export function renderPayback(el, round, sim, pb) {
  const rows = paybackTable(round);
  const roundText = `${(round / 1e6).toFixed(1).replace(".", ",")}${nbsp}млн`;
  const modelLine = pb.month
    ? `По текущим параметрам модели с учётом постоянных расходов раунд ${roundText} возвращается на ${pb.month}-й месяц, примерно к ${int(pb.units)} проданным устройствам.`
    : `По текущим параметрам модели раунд ${roundText} за 24 месяца не возвращается.`;
  el.innerHTML = `
    <p>${modelLine}</p>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>Как продаём</th><th>Включено подписки</th><th>Вклад одного устройства</th><th>Устройств до возврата ${roundText}</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr><td>${r.channel}</td><td class="num">${r.included} мес.</td><td class="num">${rub(r.contribution)}</td><td class="num">${r.units ? int(r.units) : "—"}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="muted small">Вклад устройства без постоянных расходов: цена минус себестоимость, эквайринг и налог, комиссия канала и обслуживание включённых месяцев при 200 минутах.</p>
  `;
}
