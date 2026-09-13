// Устройство «Левин» в Three.js: скруглённая пластина 60×28×9 мм из матового
// чёрного металла, миндалевидный экран с глазом, одна кнопка на торце.
// 1 единица сцены = 10 мм.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import gsap from "gsap";
import { EYE_W, EYE_H, EYE_STATES, createEyeParams, drawEye } from "./eye.js";

const W = 6;
const H = 2.8;
const D = 0.9;
const R = 0.42;
const SCREEN_W = 4.5;
const SCREEN_H = 1.5; // миндаль ≈ 3:1

// Базовая поза и диапазон поворота по скроллу (≈ 26°).
const YAW0 = -0.22;
const YAW_RANGE = 0.46;
const PITCH0 = 0.14;
const PITCH1 = 0.04;

function almondShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(0, h * 0.96, w / 2, 0);
  s.quadraticCurveTo(0, -h * 0.96, -w / 2, 0);
  return s;
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createDevice(canvas, { reducedMotion = false } = {}) {
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

  const rig = new THREE.Group(); // поворот по скроллу
  const body = new THREE.Group(); // лёгкое покачивание
  rig.add(body);
  scene.add(rig);

  // --- корпус ---
  const metal = new THREE.MeshStandardMaterial({
    color: 0x101114,
    metalness: 0.7,
    roughness: 0.5,
    envMapIntensity: 1.0,
  });
  const plate = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, R), metal);
  body.add(plate);

  // --- экран: глянцевая рамка + сам экран с текстурой глаза ---
  const bezel = new THREE.Mesh(
    new THREE.ShapeGeometry(almondShape(SCREEN_W * 1.04, SCREEN_H * 1.07), 64),
    new THREE.MeshPhysicalMaterial({
      color: 0x050507,
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
  );
  bezel.position.z = D / 2 + 0.004;
  body.add(bezel);

  const eyeCanvas = document.createElement("canvas");
  eyeCanvas.width = EYE_W;
  eyeCanvas.height = EYE_H;
  const ectx = eyeCanvas.getContext("2d");
  const eyeTex = new THREE.CanvasTexture(eyeCanvas);
  eyeTex.colorSpace = THREE.SRGBColorSpace;
  eyeTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
    new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true, toneMapped: false }),
  );
  screen.position.z = D / 2 + 0.01;
  body.add(screen);

  // стекло поверх экрана: только блики окружения (аддитивно)
  const glass = new THREE.Mesh(
    new THREE.ShapeGeometry(almondShape(SCREEN_W * 1.04, SCREEN_H * 1.07), 64),
    new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      metalness: 0,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      envMapIntensity: 0.6,
    }),
  );
  glass.position.z = D / 2 + 0.014;
  body.add(glass);

  // свечение зрачка на корпус
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xff4d3d,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.set(5.2, 2.6, 1);
  glow.position.z = D / 2 + 0.05;
  body.add(glow);

  // --- кнопка на правом торце ---
  const button = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.72, 0.34, 3, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.85, roughness: 0.3 }),
  );
  button.position.set(W / 2 + 0.03, 0.5, 0);
  body.add(button);

  // --- микрофон: три отверстия внизу слева лицевой стороны ---
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0 });
  for (let i = 0; i < 3; i++) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), holeMat);
    hole.position.set(-W / 2 + 0.62 + i * 0.16, -H / 2 + 0.36, D / 2 + 0.002);
    body.add(hole);
  }

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
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const distH = (H * 2.1) / 2 / Math.tan(vfov / 2);
    const distW = (W * 1.25) / 2 / Math.tan(hfov / 2);
    camera.position.set(0, 0.25, Math.max(distH, distW));
    camera.lookAt(0, 0, 0);
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
  let targetYaw = YAW0;
  let targetPitch = PITCH0;
  rig.rotation.set(PITCH0, YAW0, 0);

  const glowColor = new THREE.Color();

  function setState(name, opts = {}) {
    if (!EYE_STATES[name]) return;
    const t = EYE_STATES[name];
    currentState = name;
    const duration = reducedMotion ? 0 : (opts.duration ?? 0.9);
    const ease = opts.ease ?? "power2.inOut";
    gsap.killTweensOf([eye, eye.ring, eye.pupil, glow.material]);
    gsap.to(eye, {
      open: t.open,
      ringA: t.ringA,
      pupilA: t.pupilA,
      glow: t.glow,
      spin: t.spin,
      text: t.text,
      letter: t.letter,
      duration,
      ease,
      onUpdate: () => (dirty = true),
    });
    gsap.to(eye.ring, { r: t.ring.r, g: t.ring.g, b: t.ring.b, duration, ease });
    gsap.to(eye.pupil, { r: t.pupil.r, g: t.pupil.g, b: t.pupil.b, duration, ease });
    glowColor.setRGB(t.pupil.r / 255, t.pupil.g / 255, t.pupil.b / 255, THREE.SRGBColorSpace);
    glow.material.color.copy(glowColor);
    gsap.to(glow.material, { opacity: t.glow * 0.55, duration, ease });
    dirty = true;
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

    if (eye.spin > 0.001) {
      angle += eye.spin * dt * 0.25;
      dirty = true;
    }
    if (dirty) {
      drawEye(ectx, eye, angle);
      eyeTex.needsUpdate = true;
      dirty = false;
    }

    rig.rotation.y += (targetYaw - rig.rotation.y) * 0.08;
    rig.rotation.x += (targetPitch - rig.rotation.x) * 0.08;
    if (!reducedMotion) {
      body.position.y = Math.sin(t * 0.9) * 0.05;
      body.rotation.z = Math.sin(t * 0.6) * 0.012;
      body.rotation.x = Math.sin(t * 0.7) * 0.01;
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
