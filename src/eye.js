// Глаз на экране устройства. Рисуется на 2D-canvas, Three.js берёт его как
// текстуру. Все параметры (раскрытие, цвета, свечение) — числа, которые GSAP
// плавно тянет от состояния к состоянию.

export const EYE_W = 1024;
export const EYE_H = 342;

const C = {
  red: { r: 200, g: 16, b: 46 }, // #C8102E
  glow: { r: 255, g: 77, b: 61 }, // #FF4D3D
  cold: { r: 221, g: 230, b: 240 }, // #DDE6F0
  grey: { r: 138, g: 148, b: 160 }, // #8A94A0
  dark: { r: 14, g: 5, b: 7 }, // зрачок в покое
  text: { r: 242, g: 237, b: 228 }, // #F2EDE4
};

// Целевые параметры глаза по состояниям (см. панели в index.html: data-eye).
export const EYE_STATES = {
  open: { open: 1, ringA: 0.85, ring: C.red, pupil: C.dark, pupilA: 1, glow: 0, spin: 0, text: 0, letter: 0 },
  half: { open: 0.5, ringA: 0.5, ring: C.grey, pupil: C.dark, pupilA: 1, glow: 0, spin: 0, text: 0, letter: 0 },
  record: { open: 1, ringA: 1, ring: C.red, pupil: C.glow, pupilA: 1, glow: 1, spin: 1, text: 0, letter: 0 },
  text: { open: 1, ringA: 0, ring: C.red, pupil: C.dark, pupilA: 0, glow: 0, spin: 0, text: 1, letter: 0 },
  cold: { open: 1, ringA: 0.8, ring: C.cold, pupil: C.cold, pupilA: 1, glow: 0.6, spin: 0, text: 0, letter: 0 },
  letter: { open: 1, ringA: 0.3, ring: C.red, pupil: C.dark, pupilA: 0, glow: 0, spin: 0, text: 0, letter: 1 },
};

// Четыре строки на экране в состоянии «text» (панель «текст на почте»).
export const TEXT_LINES = ["Расшифровка готова", "Итоги — 5 пунктов", "Задачи — 3, срок пятница", "Письмо отправлено"];

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
    letter: 0, // прозрачность буквы «Л»
  };
}

const TAU = Math.PI * 2;
const rgba = (c, a) => `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${Math.max(0, Math.min(1, a))})`;

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

export function drawEye(ctx, p, angle) {
  const w = EYE_W;
  const h = EYE_H;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  almond(ctx, w, h, BULGE);
  ctx.clip();

  // фон экрана
  ctx.fillStyle = "#07080b";
  ctx.fillRect(0, 0, w, h);

  // мягкое свечение по всему экрану
  if (p.glow > 0.01) {
    const g = ctx.createRadialGradient(cx, cy, h * 0.05, cx, cy, h * 0.85);
    g.addColorStop(0, rgba(p.pupil, 0.5 * p.glow));
    g.addColorStop(0.5, rgba(p.pupil, 0.12 * p.glow));
    g.addColorStop(1, rgba(p.pupil, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // радужка: тонкие концентрические кольца
  if (p.ringA > 0.01) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const n = DASHES.length;
    const r0 = h * 0.21;
    const r1 = h * 0.66;
    ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = r0 + (r1 - r0) * t;
      ctx.strokeStyle = rgba(p.ring, p.ringA * (0.95 - 0.55 * t));
      ctx.setLineDash(DASHES[i]);
      ctx.lineDashOffset = i * 13;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // зрачок
  if (p.pupilA > 0.01) {
    const pr = h * 0.16;
    if (p.glow > 0.01) {
      const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.9);
      g2.addColorStop(0, rgba(p.pupil, 0.95 * p.glow));
      g2.addColorStop(0.5, rgba(p.pupil, 0.5 * p.glow));
      g2.addColorStop(1, rgba(p.pupil, 0));
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(cx, cy, pr * 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba(p.pupil, p.pupilA);
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, TAU);
    ctx.fill();
    if (p.glow > 0.01) {
      // яркое ядро
      const g3 = ctx.createRadialGradient(cx - pr * 0.15, cy - pr * 0.15, 0, cx, cy, pr);
      g3.addColorStop(0, `rgba(255,236,226,${0.55 * p.glow * p.pupilA})`);
      g3.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g3;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, 0, TAU);
      ctx.fill();
    }
    // тонкий ободок, чтобы тёмный зрачок читался на тёмном экране
    ctx.strokeStyle = rgba(p.ring, 0.5 * p.pupilA * Math.max(p.ringA, 0.25));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, TAU);
    ctx.stroke();
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

  // буква «Л» вместо зрачка
  if (p.letter > 0.01) {
    ctx.fillStyle = rgba(C.text, p.letter);
    ctx.font = '800 150px "Unbounded", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Л", cx, cy + 8);
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
