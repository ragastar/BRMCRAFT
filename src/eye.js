// Глаз на экране устройства. Рисуется на 2D-canvas, Three.js берёт его как
// текстуру. Все параметры (раскрытие, цвета, свечение) — числа, которые GSAP
// плавно тянет от состояния к состоянию. Для состояний со «временем» (точки
// копятся, строки плывут, вспышки) в drawEye передаётся phase — секунды с
// момента входа в состояние.

export const EYE_W = 1024;
export const EYE_H = 342;

const C = {
  red: { r: 200, g: 16, b: 46 }, // #C8102E
  glow: { r: 255, g: 77, b: 61 }, // #FF4D3D
  cold: { r: 221, g: 230, b: 240 }, // #DDE6F0
  grey: { r: 138, g: 148, b: 160 }, // #8A94A0
  dark: { r: 14, g: 5, b: 7 }, // зрачок в покое
  navy: { r: 16, g: 22, b: 32 }, // зрачок в состоянии «точки» — тёмный холодный
  text: { r: 242, g: 237, b: 228 }, // #F2EDE4
};
export const EYE_COLORS = C;

// База: всё выключено, глаз открыт. Каждое состояние переопределяет своё.
const BASE = {
  open: 1,
  ringA: 0,
  ring: C.red,
  pupil: C.dark,
  pupilA: 1,
  glow: 0,
  spin: 0,
  text: 0,
  labelA: 0,
  dotsA: 0,
  linesA: 0,
};

// Целевые параметры глаза по состояниям (панели ссылаются через data-eye).
// label / labelSize — не тянутся, ставятся при входе в состояние.
export const EYE_STATES = {
  open: { ...BASE, ringA: 0.85 },
  half: { ...BASE, open: 0.5, ringA: 0.5, ring: C.grey },
  record: { ...BASE, ringA: 1, pupil: C.glow, glow: 1, spin: 1 },
  text: { ...BASE, pupilA: 0, text: 1 },
  cold: { ...BASE, ringA: 0.8, ring: C.cold, pupil: C.cold, glow: 0.6 },
  letter: { ...BASE, ringA: 0.3, pupilA: 0, labelA: 1, label: "Л", labelSize: 150 },
  // v2: холодный, в зрачке медленно копятся точки (личный контекст)
  dots: { ...BASE, ringA: 0.75, ring: C.cold, pupil: C.navy, glow: 0.25, dotsA: 1 },
  // v2: короткая вспышка зрачка (отметить момент) — импульс считается по phase
  flash: { ...BASE, ringA: 0.85 },
  // v2: в радужке вместо колец — тонкие строки (словарь профессии)
  lines: { ...BASE, linesA: 1 },
  // v2: красный зрачок, потом плавно белый — «пауза». Цикл ведёт device.js
  pause: { ...BASE, ringA: 1, pupil: C.glow, glow: 1, spin: 1 },
  // v2: инициалы в зрачке, сменяются — цикл ведёт device.js
  initials: { ...BASE, ringA: 0.3, pupilA: 0, labelA: 1, label: "М.Л.", labelSize: 78 },
};

// «Пауза» внутри состояния pause: запись остановлена, зрачок белый.
export const PAUSED_PARAMS = { ...BASE, ringA: 0.45, ring: C.cold, pupil: C.cold, glow: 0.35 };

// Четыре строки на экране в состоянии «text» (панель «текст на почте»).
export const TEXT_LINES = ["Расшифровка готова", "Итоги — 5 пунктов", "Задачи — 3, срок пятница", "Письмо отправлено"];

export const DOTS_MAX = 48;
export const DOTS_PER_SEC = 3.2;

export function createEyeParams() {
  return {
    open: 0, // 0 — веки закрыты, 1 — глаз открыт
    ringA: 0.85, // прозрачность колец
    ring: { ...C.red }, // цвет колец
    pupil: { ...C.dark }, // цвет зрачка
    pupilA: 1, // прозрачность зрачка
    glow: 0, // свечение зрачка 0..1
    spin: 0, // скорость вращения колец 0..1
    text: 0, // прозрачность четырёх строк
    labelA: 0, // прозрачность надписи в зрачке
    label: "Л", // надпись («Л», «М.Л.», …)
    labelSize: 150, // кегль надписи
    dotsA: 0, // точки в зрачке
    linesA: 0, // строки вместо колец
    pulse: 0, // вспышка зрачка 0..1 (ставится покадрово)
  };
}

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rgba = (c, a) => `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${clamp01(a)})`;
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
// детерминированный «шум» 0..1 по целому индексу
const hash = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Штрихи колец: почти сплошные, с небольшими разрывами, чтобы вращение было видно.
const DASHES = [
  [70, 7],
  [38, 5],
  [110, 9],
  [26, 4],
  [150, 8],
  [52, 6],
  [84, 8],
  [32, 5],
];

// Контур миндаля: две квадратичные дуги. bulge — выступ контрольной точки.
function almond(ctx, w, h, bulge) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.moveTo(0, cy);
  ctx.quadraticCurveTo(cx, cy - bulge, w, cy);
  ctx.quadraticCurveTo(cx, cy + bulge, 0, cy);
  ctx.closePath();
}

const BULGE = EYE_H * 0.96; // реальная высота миндаля ≈ 0.96·h (середина дуги = bulge/2)
const R_IN = EYE_H * 0.21; // внутренний радиус радужки
const R_OUT = EYE_H * 0.66; // внешний радиус радужки
const PUPIL_R = EYE_H * 0.16;

export function drawEye(ctx, p, angle, phase = 0, ticks = []) {
  const w = EYE_W;
  const h = EYE_H;
  const cx = w / 2;
  const cy = h / 2;
  const glow = Math.max(p.glow, p.pulse);
  const pupil = p.pulse > 0.001 ? mix(p.pupil, C.glow, p.pulse) : p.pupil;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  almond(ctx, w, h, BULGE);
  ctx.clip();

  // фон экрана
  ctx.fillStyle = "#07080b";
  ctx.fillRect(0, 0, w, h);

  // мягкое свечение по всему экрану
  if (glow > 0.01) {
    const g = ctx.createRadialGradient(cx, cy, h * 0.05, cx, cy, h * 0.85);
    g.addColorStop(0, rgba(pupil, 0.5 * glow));
    g.addColorStop(0.5, rgba(pupil, 0.12 * glow));
    g.addColorStop(1, rgba(pupil, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // радужка: тонкие концентрические кольца
  if (p.ringA > 0.01) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const n = DASHES.length;
    ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = R_IN + (R_OUT - R_IN) * t;
      ctx.strokeStyle = rgba(p.ring, p.ringA * (0.95 - 0.55 * t));
      ctx.setLineDash(DASHES[i]);
      ctx.lineDashOffset = i * 13;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // отметки моментов (состояние flash): короткие яркие дуги на внешнем кольце
    for (const a of ticks) {
      ctx.strokeStyle = rgba(C.glow, 0.95 * p.ringA);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, R_OUT + 4, a - 0.1, a + 0.1);
      ctx.stroke();
      ctx.strokeStyle = rgba(C.glow, 0.35 * p.ringA);
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(0, 0, R_OUT + 4, a - 0.12, a + 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  // радужка-словарь: тонкие строки вместо колец, медленно плывут вверх
  if (p.linesA > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R_OUT, 0, TAU);
    ctx.clip();
    const step = 9;
    const drift = (phase * 5) % step;
    const rowsHalf = Math.ceil(R_OUT / step) + 1;
    ctx.lineWidth = 2;
    for (let k = -rowsHalf; k <= rowsHalf; k++) {
      const y = k * step - drift;
      if (Math.abs(y) >= R_OUT) continue;
      const half = Math.sqrt(R_OUT * R_OUT - y * y);
      const row = k + Math.floor(phase * 5 / step); // стабильный индекс строки при дрейфе
      const len = half * (0.45 + 0.5 * hash(row));
      const a = p.linesA * (0.28 + 0.42 * hash(row + 1000));
      ctx.strokeStyle = rgba(C.red, a);
      const gap = PUPIL_R + 8;
      const x0 = cx - len;
      const x1 = cx + len;
      ctx.beginPath();
      if (Math.abs(y) < gap) {
        // строка обходит зрачок
        if (x0 < cx - gap) {
          ctx.moveTo(x0, cy + y);
          ctx.lineTo(cx - gap, cy + y);
        }
        if (x1 > cx + gap) {
          ctx.moveTo(cx + gap, cy + y);
          ctx.lineTo(x1, cy + y);
        }
      } else {
        ctx.moveTo(x0, cy + y);
        ctx.lineTo(x1, cy + y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // зрачок
  if (p.pupilA > 0.01) {
    const pr = PUPIL_R;
    if (glow > 0.01) {
      const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.9);
      g2.addColorStop(0, rgba(pupil, 0.95 * glow));
      g2.addColorStop(0.5, rgba(pupil, 0.5 * glow));
      g2.addColorStop(1, rgba(pupil, 0));
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(cx, cy, pr * 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba(pupil, p.pupilA);
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, TAU);
    ctx.fill();
    if (glow > 0.01) {
      // яркое ядро
      const g3 = ctx.createRadialGradient(cx - pr * 0.15, cy - pr * 0.15, 0, cx, cy, pr);
      g3.addColorStop(0, `rgba(255,236,226,${clamp01(0.55 * glow * p.pupilA)})`);
      g3.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g3;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, 0, TAU);
      ctx.fill();
    }
    // тонкий ободок, чтобы тёмный зрачок читался на тёмном экране
    const rim = p.linesA > 0.01 ? C.red : p.ring;
    ctx.strokeStyle = rgba(rim, 0.5 * p.pupilA * Math.max(p.ringA, p.linesA, 0.25));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, TAU);
    ctx.stroke();

    // точки копятся в зрачке (спираль подсолнуха: от центра наружу)
    if (p.dotsA > 0.01) {
      const n = Math.min(DOTS_MAX, Math.floor(phase * DOTS_PER_SEC));
      for (let i = 0; i < n; i++) {
        const r = Math.min(pr - 5, 6.6 * Math.sqrt(i + 0.6));
        const a = i * 2.39996;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const fresh = i === n - 1 ? 0.45 : 0;
        ctx.fillStyle = rgba(C.cold, p.dotsA * (0.5 + 0.35 * hash(i) + fresh));
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, TAU);
        ctx.fill();
      }
      if (n > 0) {
        const g4 = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.4);
        g4.addColorStop(0, rgba(C.cold, 0.16 * p.dotsA * (n / DOTS_MAX)));
        g4.addColorStop(1, rgba(C.cold, 0));
        ctx.fillStyle = g4;
        ctx.beginPath();
        ctx.arc(cx, cy, pr * 1.4, 0, TAU);
        ctx.fill();
      }
    }
  }

  // четыре строки текста вместо радужки
  if (p.text > 0.01) {
    ctx.fillStyle = rgba(C.text, p.text);
    ctx.font = '500 30px "Golos Text", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lh = 46;
    const x = cx - 205;
    const y0 = cy - lh * 1.5;
    TEXT_LINES.forEach((s, i) => ctx.fillText(s, x, y0 + i * lh));
  }

  // надпись вместо зрачка («Л», инициалы)
  if (p.labelA > 0.01 && p.label) {
    ctx.fillStyle = rgba(C.text, p.labelA);
    ctx.font = `800 ${p.labelSize}px "Unbounded", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.label, cx, cy + p.labelSize * 0.05);
  }

  // веки: тёмные области между краем миндаля и кривой века
  if (p.open < 0.995) {
    const lid = BULGE * p.open;
    ctx.fillStyle = "#07080b";
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(cx, cy - BULGE, w, cy);
    ctx.quadraticCurveTo(cx, cy - lid, 0, cy);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(cx, cy + BULGE, w, cy);
    ctx.quadraticCurveTo(cx, cy + lid, 0, cy);
    ctx.closePath();
    ctx.fill();
    // кромка века
    ctx.strokeStyle = rgba(p.ring, 0.35 * Math.max(p.ringA, 0.2));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(cx, cy - lid, w, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(cx, cy + lid, w, cy);
    ctx.stroke();
  }

  ctx.restore();
}
