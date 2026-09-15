// Устройство «Левин» в Three.js: кулон в форме глаза — миндалевидный корпус
// 60×28×9 мм из матового чёрного металла со скруглёнными кромками, внутри
// экран того же контура с радужкой и зрачком, одна кнопка на остром торце,
// ушко и шнур. 1 единица сцены = 10 мм.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import gsap from "gsap";
import { buildPendant, W, H, BODY_DEFAULT } from "./pendant.js";
import {
  EYE_W,
  EYE_H,
  EYE_STATES,
  EYE_COLORS,
  PAUSED_PARAMS,
  DOTS_MAX,
  DOTS_PER_SEC,
  createEyeParams,
  drawEye,
} from "./eye.js";

const BRANDS = {
  sber: { body: 0x0f5f3c },
  beeline: { body: 0xc49a00 },
};
BRANDS.brand = BRANDS.sber; // панель брендинга стартует со Сбера

// Базовая поза и диапазон поворота по скроллу (≈ 26°).
const YAW0 = -0.22;
const YAW_RANGE = 0.46;
const PITCH0 = 0.14;
const PITCH1 = 0.04;

export function createDevice(canvas, { reducedMotion = false, still = false, distanceScale = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  // Кулон: геометрия и материалы — в pendant.js
  const rig = new THREE.Group(); // поворот по скроллу
  const { hang, body, metal, eyeCanvas, ectx, eyeTex, glow } = buildPendant(renderer, { cord: true });
  rig.add(hang);
  scene.add(rig);

  // --- свет ---
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 5, 6);
  const rim = new THREE.DirectionalLight(0xdde6f0, 1.4);
  rim.position.set(5, 2, -4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(3, -2, 4);
  // холодная кромка снизу-слева, чтобы корпус не сливался с фоном
  const edge = new THREE.DirectionalLight(0xdde6f0, 1.6);
  edge.position.set(-5, -3, -2);
  scene.add(key, rim, fill, edge);

  // --- камера: вписываем устройство в сцену при любом соотношении сторон ---
  let stillIdle = 0; // still: сколько кадров подряд ничего не менялось
  function resize() {
    stillIdle = 0;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const distH = (H * 2.3) / 2 / Math.tan(vfov / 2);
    const distW = (W * 1.25) / 2 / Math.tan(hfov / 2);
    camera.position.set(0, 0.6, Math.max(distH, distW) * distanceScale);
    camera.lookAt(0, 0.28, 0); // пластина чуть ниже центра — сверху место шнуру
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // --- состояние глаза ---
  const eye = createEyeParams();
  if (reducedMotion) eye.open = 1;
  let angle = 0;
  let dirty = true;
  let currentState = null;
  let stateSince = performance.now(); // для phase: точки, строки, вспышки
  let program = null; // gsap.timeline для циклических состояний (pause, initials)
  let ticks = []; // отметки моментов в состоянии flash
  let flashCycle = -1;
  const glowState = { opacity: 0 }; // базовая яркость свечения на корпус (тянется GSAP)
  let targetYaw = YAW0;
  let targetPitch = PITCH0;
  rig.rotation.set(PITCH0, YAW0, 0);

  const glowColor = new THREE.Color();
  const setGlowColor = (c) => {
    glowColor.setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace);
    glow.material.color.copy(glowColor);
  };

  // Плавно привести параметры глаза к набору t (без смены состояния).
  function applyParams(t, duration, ease = "power2.inOut") {
    gsap.killTweensOf([eye, eye.ring, eye.pupil, glowState]);
    gsap.to(eye, {
      open: t.open,
      ringA: t.ringA,
      pupilA: t.pupilA,
      glow: t.glow,
      spin: t.spin,
      text: t.text,
      labelA: t.labelA,
      dotsA: t.dotsA,
      linesA: t.linesA,
      markA: t.markA,
      duration,
      ease,
      onUpdate: () => (dirty = true),
    });
    gsap.to(eye.ring, { r: t.ring.r, g: t.ring.g, b: t.ring.b, duration, ease });
    gsap.to(eye.pupil, { r: t.pupil.r, g: t.pupil.g, b: t.pupil.b, duration, ease });
    setGlowColor(t.glow > 0 ? t.pupil : EYE_COLORS.glow);
    gsap.to(glowState, { opacity: t.glow * 0.55, duration, ease });
    dirty = true;
  }

  const bodyTarget = new THREE.Color();
  function setBody(hex, duration) {
    bodyTarget.set(hex);
    gsap.killTweensOf(metal.color);
    gsap.to(metal.color, { r: bodyTarget.r, g: bodyTarget.g, b: bodyTarget.b, duration, ease: "power2.inOut" });
  }

  // Полностью применить состояние по имени: экран, надпись, знак, цвет корпуса.
  function applyState(name, duration, ease) {
    const t = EYE_STATES[name];
    if (t.label) {
      eye.label = t.label;
      eye.labelSize = t.labelSize;
    }
    eye.labelColor = t.labelColor ? { ...t.labelColor } : { ...EYE_COLORS.text };
    if (t.mark) eye.mark = t.mark;
    applyParams(t, duration, ease);
    setBody(BRANDS[name]?.body ?? BODY_DEFAULT, Math.max(duration, 0.001));
  }

  function setState(name, opts = {}) {
    if (!EYE_STATES[name]) return;
    if (name === currentState && !opts.force) return; // уже в этом состоянии — не дёргаем
    const t = EYE_STATES[name];
    currentState = name;
    stateSince = performance.now();
    ticks = [];
    flashCycle = -1;
    eye.pulse = 0;
    if (program) {
      program.kill();
      program = null;
    }
    const duration = reducedMotion ? 0 : (opts.duration ?? 0.9);
    applyState(name, duration, opts.ease ?? "power2.inOut");

    // --- циклические сценарии ---
    if (name === "pause") {
      if (reducedMotion) {
        applyParams(PAUSED_PARAMS, 0);
      } else {
        // красный (запись) 2.2 с → плавно белый («пауза») 2.6 с → снова красный
        program = gsap.timeline({ repeat: -1 });
        program.call(() => applyParams(PAUSED_PARAMS, 1.1), null, 2.2);
        program.call(() => applyParams(EYE_STATES.pause, 0.8), null, 5.9);
        program.to({}, { duration: 7.2 }, 0); // длина цикла
      }
    } else if (name === "initials" && !reducedMotion) {
      // «М.Л.» 2.4 с → гаснет → «А.С.» 2.4 с → гаснет → снова «М.Л.»
      const swap = (label) => () => {
        eye.label = label;
        dirty = true;
      };
      const fade = (to, at) => gsap.to(eye, { labelA: to, duration: 0.35, ease: "power1.inOut", onUpdate: () => (dirty = true) });
      program = gsap.timeline({ repeat: -1 });
      program.add(fade(0), 2.4);
      program.call(swap("А.С."), null, 2.8);
      program.add(fade(1), 2.8);
      program.add(fade(0), 5.6);
      program.call(swap("М.Л."), null, 6.0);
      program.add(fade(1), 6.0);
      program.to({}, { duration: 8.4 }, 0);
    } else if (name === "brand" && !reducedMotion) {
      // Сбер 3,2 с → Билайн 3,2 с → снова Сбер
      program = gsap.timeline({ repeat: -1 });
      program.call(() => applyState("beeline", 0.9), null, 3.2);
      program.call(() => applyState("sber", 0.9), null, 6.4);
      program.to({}, { duration: 6.4 }, 0);
    } else if (name === "flash" && reducedMotion) {
      ticks = [-1.2, 0.4]; // статичные отметки вместо вспышек
    } else if (name === "dots" && reducedMotion) {
      stateSince = performance.now() - ((DOTS_MAX / DOTS_PER_SEC) * 1000 + 1000); // все точки сразу
    }
  }

  function setScroll(progress) {
    const p = Math.max(0, Math.min(1, progress));
    targetYaw = YAW0 + YAW_RANGE * p;
    targetPitch = PITCH0 + (PITCH1 - PITCH0) * p;
  }

  // перерисовать текст на экране, когда подгрузятся шрифты
  if (document.fonts?.ready) document.fonts.ready.then(() => (dirty = true));

  // --- цикл ---
  let last = performance.now();
  let running = true;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    const phase = reducedMotion && currentState === "lines" ? 0 : (now - stateSince) / 1000;

    if (eye.spin > 0.001) {
      angle += eye.spin * dt * 0.25;
      dirty = true;
    }
    // состояния, живущие во времени
    if (currentState === "flash" && !reducedMotion) {
      // вспышка каждые 3 с: резко вверх за 0.1 с, затухание ~0.8 с; после каждой — отметка на кольце
      const cyc = Math.floor(phase / 3);
      const p = phase - cyc * 3;
      if (cyc !== flashCycle) {
        flashCycle = cyc;
        if (ticks.length < 6) ticks.push(-Math.PI / 2 + ticks.length * 1.9);
      }
      const pulse = p < 0.1 ? p / 0.1 : Math.exp(-(p - 0.1) * 5.5);
      if (pulse > 0.004 || eye.pulse > 0.004) {
        eye.pulse = pulse > 0.004 ? pulse : 0;
        dirty = true;
      }
    } else if (currentState === "dots" && phase < DOTS_MAX / DOTS_PER_SEC + 0.5) {
      dirty = true;
    } else if (currentState === "lines" && !reducedMotion) {
      dirty = true;
    }
    const changed = dirty;
    if (dirty) {
      drawEye(ectx, eye, angle, phase, ticks);
      eyeTex.needsUpdate = true;
      dirty = false;
    }
    glow.material.opacity = Math.max(glowState.opacity, eye.pulse * 0.6);

    rig.rotation.y += (targetYaw - rig.rotation.y) * 0.08;
    rig.rotation.x += (targetPitch - rig.rotation.x) * 0.08;
    if (!reducedMotion && !still) {
      // кулон едва качается на шнуре и чуть поворачивается на нём
      hang.rotation.z = Math.sin(t * 0.65) * 0.03;
      hang.rotation.y = Math.sin(t * 0.45) * 0.05;
      hang.rotation.x = Math.sin(t * 0.8) * 0.01;
    }
    if (still) {
      // статичная сцена: после того как всё устоялось, кадры не рендерим
      stillIdle = changed ? 0 : stillIdle + 1;
      if (stillIdle > 40) return;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  return { setState, setScroll, eye, get state() { return currentState; } };
}
