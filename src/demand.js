// График спроса из Яндекс Вордстата: простые столбцы, без осей и подписей внутри.
// Данные — src/data/wordstat.js. Пока их нет, блок остаётся скрытым.

const W = 480;
const H = 120;

export function renderDemand(root, data) {
  if (!root || !Array.isArray(data) || data.length < 2) return;
  const svg = root.querySelector(".demand__chart");
  const caption = root.querySelector(".demand__caption");
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const slot = W / data.length;
  const gap = Math.min(3, slot * 0.25);
  svg.innerHTML = data
    .map((d, i) => {
      const h = Math.max(1, (d.value / max) * H);
      return `<rect x="${(i * slot + gap / 2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(slot - gap).toFixed(1)}" height="${h.toFixed(1)}" fill="#DDE6F0"><title>${d.month}: ${d.value.toLocaleString("ru-RU")}</title></rect>`;
    })
    .join("");
  const first = data[0];
  const last = data[data.length - 1];
  const ratio = first.value > 0 ? last.value / first.value : null;
  caption.textContent = ratio
    ? `${first.month} — ${last.month}: рост в ${ratio.toFixed(0)} раз. Источник: Яндекс Вордстат.`
    : `${first.month} — ${last.month}. Источник: Яндекс Вордстат.`;
  root.hidden = false;
}
