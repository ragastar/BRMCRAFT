// Финмодель «Левин»: цикл по 24 месяцам. Константы совпадают с таблицей
// levin-finmodel.xlsx (public/files). Чистая функция, без DOM — её же
// можно гонять под Node для проверки.

export const DEFAULTS = {
  sales: 30, // продаж в месяц после первой партии
  share: 0.65, // доля покупателей, которые платят подписку
  churn: 0.04, // отток подписчиков в месяц
  minutes: 400, // минут на пользователя в месяц
  ppm: 0.6, // цена минуты распознавания, ₽
};

const BATCH_PRICE = 14900; // первая партия, 100 штук
const PRICE = 17900; // цена после партии
const SUB = 990; // подписка в месяц
const COGS_EARLY = 5200; // себестоимость, пока накопительно < 300 штук
const COGS_LATE = 3900;
const COGS_THRESHOLD = 300;
const MINUTE_FIXED = 40; // обслуживание пользователя сверх минут, ₽/мес
const ACQUIRING = 0.03;
const TAX = 0.06;
const CAC = 3000; // привлечение за устройство с 4-го месяца
const FIXED = 265000; // постоянные в месяц
const ONE_OFF = { 1: 250000, 4: 300000 };
const MONTHS = 24;

export function simulate({ sales, share, churn, minutes, ppm } = DEFAULTS) {
  const cumulative = [];
  const monthly = [];
  let cum = 0;
  let unitsPrev = 0;
  let paid = 0;
  let unitsTotal = 0;

  for (let m = 1; m <= MONTHS; m++) {
    // продажи устройств
    let units;
    let price;
    if (m <= 3) {
      units = 33; // партия расходится по 33 в месяцы 1–3
      price = BATCH_PRICE;
    } else {
      units = Math.round(sales * Math.pow(1.1, m - 4)); // рост 10% в месяц
      price = PRICE;
    }
    const cogs = unitsTotal < COGS_THRESHOLD ? COGS_EARLY : COGS_LATE;
    unitsTotal += units;

    // подписчики: бесплатный год у партии, платные — из прошлых продаж
    const free = m <= 12 ? 100 : m === 13 ? 67 : m === 14 ? 33 : 0;
    let fresh = 0;
    if (m >= 4) fresh += unitsPrev * share;
    if (m >= 13 && m <= 15) fresh += 33 * share; // партия после бесплатного года
    paid = paid * (1 - churn) + fresh;

    const revenue = units * price + paid * SUB;
    const service = (paid + free) * (minutes * ppm + MINUTE_FIXED);
    const cac = m >= 4 ? units * CAC : 0;
    const result =
      revenue - units * cogs - service - revenue * (ACQUIRING + TAX) - cac - FIXED - (ONE_OFF[m] || 0);

    cum += result;
    monthly.push(result);
    cumulative.push(cum);
    unitsPrev = units;
  }

  const minCum = Math.min(...cumulative);
  const breakeven = cumulative.findIndex((c) => c >= 0); // -1, если не выходит
  return {
    cumulative,
    monthly,
    invest: Math.max(0, -minCum),
    breakevenMonth: breakeven === -1 ? null : breakeven + 1,
    total: cumulative[MONTHS - 1],
  };
}
