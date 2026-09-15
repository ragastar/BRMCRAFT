// Финмодель «Левин» под корпоративные продажи: цикл по 24 месяцам.
// Чистые функции без DOM — их же гоняем под Node для проверки.
//
// Как продаём: компаниям по счёту, 14 900 ₽ за устройство, в цене минимальный
// тариф (200 минут в месяц) на несколько месяцев. После включённого периода
// часть мест продлевается по цене минимального тарифа. Производство только
// под предоплату, поэтому компоненты под заказы в «нужно вложить» не сидят.

export const ASSUMPTIONS = {
  price: 14900, // цена устройства для компаний, не выше 14 900
  cogsEarly: 5200, // себестоимость, пока накопительно < 300 штук
  cogsLate: 3900,
  cogsThreshold: 300,
  tier: 490, // минимальный тариф после включённого периода, ₽ за место в месяц (ДОПУЩЕНИЕ)
  ppm: 0.6, // цена минуты распознавания, ₽
  userFixed: 40, // обслуживание одного места сверх минут, ₽ в месяц
  commission: 0.1, // комиссия продавца от выручки за устройства
  acqTax: 0.09, // эквайринг 3 % + налог 6 % от всей выручки
  fixed: 265000, // постоянные расходы в месяц: команда, цех, облако
  marketing: { from: 2, to: 6, perMonth: 60000 }, // реклама и аутбаунд на сезон гипотез
  oneOff: { 1: 150000, 2: 300000, 5: 120000 }, // прототип; демо-партия и материалы; декларация ЭМС и юрист
  firstSalesMonth: 3, // первые счета — с третьего месяца
  rampMonths: 3, // разгон продаж до плановых за три месяца
  months: 24,
};

// Три готовых сценария. Параметры — то, что крутят ползунками.
export const SCENARIOS = {
  careful: { deals: 2, devices: 25, growth: 0.03, included: 12, renewal: 0.4, churn: 0.06, minutes: 250 },
  base: { deals: 3, devices: 20, growth: 0.05, included: 6, renewal: 0.6, churn: 0.04, minutes: 200 },
  aggressive: { deals: 5, devices: 30, growth: 0.1, included: 3, renewal: 0.7, churn: 0.03, minutes: 200 },
};
export const DEFAULTS = SCENARIOS.base;

// Стоимость обслуживания одного места в месяц при заданных минутах.
export const seatCost = (minutes, a = ASSUMPTIONS) => minutes * a.ppm + a.userFixed;

export function simulate(p = DEFAULTS, a = ASSUMPTIONS) {
  const rows = [];
  const cohorts = [];
  let cum = 0;
  let unitsTotal = 0;
  const base = p.deals * p.devices;

  for (let m = 1; m <= a.months; m++) {
    // продажи устройств: разгон, потом рост на growth в месяц
    let units = 0;
    if (m >= a.firstSalesMonth) {
      const k = m - a.firstSalesMonth; // 0 в первый месяц продаж
      const ramp = Math.min(1, (k + 1) / a.rampMonths);
      const grown = k >= a.rampMonths ? Math.pow(1 + p.growth, k - a.rampMonths + 1) : 1;
      units = Math.round(base * ramp * grown);
    }
    const cogs = unitsTotal < a.cogsThreshold ? a.cogsEarly : a.cogsLate;
    unitsTotal += units;
    if (units > 0) cohorts.push({ units, sold: m, paid: 0 });

    // подписки по когортам: включённый период → продление → отток
    let included = 0;
    let paid = 0;
    for (const c of cohorts) {
      const age = m - c.sold;
      if (age < p.included) included += c.units;
      else if (age === p.included) {
        c.paid = c.units * p.renewal;
        paid += c.paid;
      } else {
        c.paid *= 1 - p.churn;
        paid += c.paid;
      }
    }

    const deviceRevenue = units * a.price;
    const subRevenue = paid * a.tier;
    const revenue = deviceRevenue + subRevenue;
    const service = (included + paid) * seatCost(p.minutes, a);
    const marketing = m >= a.marketing.from && m <= a.marketing.to ? a.marketing.perMonth : 0;
    const costs =
      units * cogs +
      service +
      revenue * a.acqTax +
      deviceRevenue * a.commission +
      a.fixed +
      marketing +
      (a.oneOff[m] || 0);
    const result = revenue - costs;
    cum += result;
    rows.push({ m, units, unitsTotal, included, paid: Math.round(paid), revenue, costs, result, cum });
  }

  const cumulative = rows.map((r) => r.cum);
  const minCum = Math.min(...cumulative);
  const be = cumulative.findIndex((c) => c >= 0);
  return {
    rows,
    cumulative,
    invest: Math.max(0, -minCum),
    breakevenMonth: be === -1 ? null : be + 1,
    total: cumulative[a.months - 1],
    unitsTotal,
  };
}

// Возврат инвестору: транши берутся по потребности, вся чистая прибыль после
// выхода в плюс идёт инвестору, пока не вернётся весь раунд.
export function payback(sim, round) {
  const need = Math.max(0, round - sim.invest); // часть раунда, которая не была потрачена
  const idx = sim.cumulative.findIndex((c) => c >= need);
  const month = idx === -1 ? null : idx + 1;
  return {
    month,
    units: month ? sim.rows[idx].unitsTotal : null,
    multiple: round > 0 ? sim.total / round : null,
  };
}

// Юнит-экономика при текущих параметрах.
export function unitEconomics(p = DEFAULTS, a = ASSUMPTIONS) {
  const sc = seatCost(p.minutes, a);
  const device = a.price * (1 - a.acqTax - a.commission) - a.cogsEarly - p.included * sc;
  const seat = a.tier * (1 - a.acqTax) - sc;
  return { device, seat, seatCost: sc, commission: a.price * a.commission };
}

// Чувствительность: как меняется результат за 24 месяца при сдвиге каждого
// параметра на один шаг ползунка.
export function sensitivity(p, steps, a = ASSUMPTIONS) {
  const baseTotal = simulate(p, a).total;
  return Object.entries(steps).map(([key, step]) => {
    const up = simulate({ ...p, [key]: p[key] + step }, a).total - baseTotal;
    return { key, delta: up };
  });
}

// Таблица «Что вернётся инвестору»: сколько устройств возвращают раунд
// в разных условиях продажи (без постоянных расходов).
export function paybackTable(round, a = ASSUMPTIONS) {
  const sc = seatCost(200, a);
  const rows = [];
  for (const [channel, commission] of [
    ["свой продавец, 10 %", 0.1],
    ["агентство, 25 %", 0.25],
  ]) {
    for (const included of [3, 12]) {
      const contribution = a.price * (1 - a.acqTax - commission) - a.cogsEarly - included * sc;
      rows.push({ channel, included, contribution, units: contribution > 0 ? Math.ceil(round / contribution) : null });
    }
  }
  return rows;
}
