// Коробка «Левин»: открытый лоток с крышкой на петле, ложемент с вырезами,
// в нём кулон лицом вверх, бухта шнура, магнитный держатель, кабель USB-C
// и карточка активации. Статичная сцена, рендер по необходимости.
// 1 единица = 10 мм. Мир: x вправо, y вверх, z к зрителю.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildPendant, almondShape, W, H, PIVOT_Y } from "./pendant.js";
import { EYE_STATES, createEyeParams, drawEye } from "./eye.js";

// Лоток и ложемент
const BOX_W = 17; // ширина (x)
const BOX_D = 12; // глубина (z)
const WALL = 0.3;
const TRAY_H = 2.4;
const FOAM_T = 1.2; // толщина ложемента
const FLOOR_Y = WALL; // верх дна лотка
const LID_H = 1.4;

// Раскладка вырезов в координатах ложемента: x вправо, y — к задней стенке.
const LAYOUT = {
  pendant: { x: -3.4, y: 0.6 },
  cord: { x: 4.3, y: 1.8, r: 2.0 },
  cable: { x: 4.6, y: -2.7, r: 1.6 },
  clip: { x: -5.6, y: -3.0, w: 2.6, h: 1.4 },
  card: { x: -0.8, y: -3.2, w: 6.2, h: 4.2 },
};

function rectPath(x, y, w, h) {
  const p = new THREE.Path();
  p.moveTo(x - w / 2, y - h / 2);
  p.lineTo(x + w / 2, y - h / 2);
  p.lineTo(x + w / 2, y + h / 2);
  p.lineTo(x - w / 2, y + h / 2);
  p.closePath();
  return p;
}

function circlePath(x, y, r) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, false);
  return p;
}

function almondPath(x, y, w, h) {
  const p = new THREE.Path();
  p.moveTo(x - w / 2, y);
  p.quadraticCurveTo(x, y + h * 0.96, x + w / 2, y);
  p.quadraticCurveTo(x, y - h * 0.96, x - w / 2, y);
  p.closePath();
  return p;
}

// Ложемент: прямоугольник с отверстиями, выдавленный на толщину.
function foamGeometry() {
  const w = BOX_W - 2 * WALL;
  const d = BOX_D - 2 * WALL;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2);
  shape.lineTo(w / 2, -d / 2);
  shape.lineTo(w / 2, d / 2);
  shape.lineTo(-w / 2, d / 2);
  shape.closePath();
  const L = LAYOUT;
  shape.holes.push(almondPath(L.pendant.x, L.pendant.y, W + 0.6, (H + 0.5) / 0.96));
  shape.holes.push(circlePath(L.cord.x, L.cord.y, L.cord.r));
  shape.holes.push(circlePath(L.cable.x, L.cable.y, L.cable.r));
  shape.holes.push(rectPath(L.clip.x, L.clip.y, L.clip.w, L.clip.h));
  shape.holes.push(rectPath(L.card.x, L.card.y, L.card.w, L.card.h));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: FOAM_T, bevelEnabled: false, curveSegments: 48 });
  return geo;
}

function textTexture(draw, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createBox(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const world = new THREE.Group(); // для лёгкого параллакса
  scene.add(world);

  // --- материалы ---
  const cardboard = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.92, metalness: 0.05, envMapIntensity: 0.5 });
  const cardboardIn = new THREE.MeshStandardMaterial({ color: 0x0e0f13, roughness: 0.95, metalness: 0, envMapIntensity: 0.4 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 1, metalness: 0, envMapIntensity: 0.3 });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.8, metalness: 0.15 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.75, metalness: 0.05 });
  const clipMetal = new THREE.MeshStandardMaterial({ color: 0x2a2c32, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.9, metalness: 0 });

  const box = (w, h, d, mat, x, y, z, receive = true, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = receive;
    m.castShadow = cast;
    world.add(m);
    return m;
  };

  // --- лоток ---
  box(BOX_W, WALL, BOX_D, cardboardIn, 0, WALL / 2, 0, true, false); // дно
  box(BOX_W, TRAY_H, WALL, cardboard, 0, TRAY_H / 2, -BOX_D / 2 + WALL / 2); // задняя стенка
  box(BOX_W, TRAY_H, WALL, cardboard, 0, TRAY_H / 2, BOX_D / 2 - WALL / 2); // передняя
  box(WALL, TRAY_H, BOX_D - 2 * WALL, cardboard, -BOX_W / 2 + WALL / 2, TRAY_H / 2, 0); // левая
  box(WALL, TRAY_H, BOX_D - 2 * WALL, cardboard, BOX_W / 2 - WALL / 2, TRAY_H / 2, 0); // правая

  // --- ложемент с вырезами ---
  const foam = new THREE.Mesh(foamGeometry(), foamMat);
  foam.rotation.x = -Math.PI / 2; // выдавливание вверх, ось y формы — к задней стенке
  foam.position.y = FLOOR_Y;
  foam.receiveShadow = true;
  foam.castShadow = true;
  world.add(foam);
  const toWorldZ = (y) => -y; // координата ложемента → мировая z

  // --- крышка на петле у задней кромки ---
  const lid = new THREE.Group();
  lid.position.set(0, TRAY_H, -BOX_D / 2);
  const LW = BOX_W + 0.2;
  const LD = BOX_D + 0.2;
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(LW, WALL, LD), cardboard);
  lidTop.position.set(0, LID_H + WALL / 2, LD / 2);
  lidTop.castShadow = true;
  lid.add(lidTop);
  for (const [w, d, x, z] of [
    [LW, WALL, 0, WALL / 2],
    [LW, WALL, 0, LD - WALL / 2],
    [WALL, LD - 2 * WALL, -LW / 2 + WALL / 2, LD / 2],
    [WALL, LD - 2 * WALL, LW / 2 - WALL / 2, LD / 2],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, LID_H, d), cardboard);
    wall.position.set(x, LID_H / 2, z);
    lid.add(wall);
  }
  // надпись на внутренней стороне крышки
  const lidTex = textTexture(
    (g, w, h) => {
      g.fillStyle = "#0e0f13";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#f2ede4";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = '800 96px "Unbounded", system-ui, sans-serif';
      g.fillText("ЛЕВИН.", w / 2, h / 2 - 28);
      g.font = '400 30px "Golos Text", system-ui, sans-serif';
      g.fillStyle = "#8a94a0";
      g.fillText("Диктофон с ИИ, который работает в России.", w / 2, h / 2 + 52);
    },
    1024,
    724,
  );
  const lidPrint = new THREE.Mesh(new THREE.PlaneGeometry(LW - 2 * WALL, LD - 2 * WALL), new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.95 }));
  lidPrint.rotation.x = Math.PI / 2; // смотрит вниз в закрытом положении
  lidPrint.position.set(0, LID_H - 0.002, LD / 2);
  lid.add(lidPrint);
  lid.rotation.x = THREE.MathUtils.degToRad(-108); // открыта
  world.add(lid);

  // --- кулон лицом вверх в миндалевидном вырезе ---
  const pend = buildPendant(renderer, { cord: false });
  const eye = createEyeParams();
  Object.assign(eye, { open: 1, ringA: 0.85, glow: 0, pupilA: 1 });
  eye.ring = { ...EYE_STATES.open.ring };
  eye.pupil = { ...EYE_STATES.open.pupil };
  drawEye(pend.ectx, eye, 0);
  pend.eyeTex.needsUpdate = true;
  pend.hang.rotation.x = -Math.PI / 2; // лицо вверх, ушко к задней стенке
  pend.hang.position.set(LAYOUT.pendant.x, FLOOR_Y + 0.45, toWorldZ(LAYOUT.pendant.y) - PIVOT_Y);
  pend.body.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  world.add(pend.hang);

  // --- бухта шнура: два витка ---
  for (const [r, y] of [
    [LAYOUT.cord.r - 0.35, 0.08],
    [LAYOUT.cord.r - 0.62, 0.2],
  ]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.065, 12, 64), cordMat);
    t.rotation.x = Math.PI / 2;
    t.position.set(LAYOUT.cord.x, FLOOR_Y + y, toWorldZ(LAYOUT.cord.y));
    t.castShadow = true;
    world.add(t);
  }

  // --- кабель USB-C: бухта и разъём ---
  const cable = new THREE.Mesh(new THREE.TorusGeometry(LAYOUT.cable.r - 0.4, 0.075, 12, 64), rubber);
  cable.rotation.x = Math.PI / 2;
  cable.position.set(LAYOUT.cable.x, FLOOR_Y + 0.09, toWorldZ(LAYOUT.cable.y));
  cable.castShadow = true;
  world.add(cable);
  const plug = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.26, 0.9, 2, 0.1), clipMetal);
  plug.position.set(LAYOUT.cable.x + 0.2, FLOOR_Y + 0.2, toWorldZ(LAYOUT.cable.y) + 0.3);
  plug.rotation.y = 0.5;
  world.add(plug);

  // --- магнитный держатель на лацкан ---
  const clip = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.5, 1.0, 3, 0.14), clipMetal);
  clip.position.set(LAYOUT.clip.x, FLOOR_Y + 0.25, toWorldZ(LAYOUT.clip.y));
  clip.castShadow = true;
  world.add(clip);

  // --- карточка активации ---
  const cardTex = textTexture(
    (g, w, h) => {
      g.fillStyle = "#e9e4da";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#05070c";
      g.textAlign = "left";
      g.textBaseline = "top";
      g.font = '800 64px "Unbounded", system-ui, sans-serif';
      g.fillText("Левин", 56, 56);
      g.font = '400 30px "Golos Text", system-ui, sans-serif';
      g.fillStyle = "#3a3f47";
      g.fillText("Наведите камеру на код —", 56, 170);
      g.fillText("устройство привяжется к почте за минуту.", 56, 212);
      // условный QR-код
      const s = 14;
      const ox = w - 56 - 12 * s;
      const oy = 56;
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
          const on = v - Math.floor(v) > 0.5 || (i < 3 && j < 3) || (i > 8 && j < 3) || (i < 3 && j > 8);
          if (on) {
            g.fillStyle = "#05070c";
            g.fillRect(ox + i * s, oy + j * s, s - 2, s - 2);
          }
        }
      }
    },
    1024,
    660,
  );
  const cardW = LAYOUT.card.w - 0.4;
  const cardH = LAYOUT.card.h - 0.4;
  const cardBody = new THREE.Mesh(new THREE.BoxGeometry(cardW, 0.08, cardH), paper);
  cardBody.position.set(LAYOUT.card.x, FLOOR_Y + 0.04, toWorldZ(LAYOUT.card.y));
  cardBody.castShadow = true;
  world.add(cardBody);
  const cardFace = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.9 }));
  cardFace.rotation.x = -Math.PI / 2;
  cardFace.position.set(LAYOUT.card.x, FLOOR_Y + 0.081, toWorldZ(LAYOUT.card.y));
  world.add(cardFace);

  // --- свет ---
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-7, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 50;
  key.shadow.bias = -0.0008;
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(8, 6, 10);
  const rim = new THREE.DirectionalLight(0xdde6f0, 1.2);
  rim.position.set(2, 8, -12);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.16));

  // --- камера: точное вписывание сцены при любом соотношении сторон ---
  // Считаем габариты всего, что в коробке (с открытой крышкой), и подбираем
  // расстояние так, чтобы все восемь углов попали в кадр с полями.
  world.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(world);
  const center = bounds.getCenter(new THREE.Vector3());
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const viewDir = new THREE.Vector3(0.15, 0.78, 0.62).normalize();
  const FILL = 0.94; // крайняя точка на 94 % полукадра — немного воздуха по краям

  function frame() {
    let dist = 40;
    for (let k = 0; k < 5; k++) {
      camera.position.copy(center).addScaledVector(viewDir, dist);
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      let m = 0;
      for (const c of corners) {
        const p = c.clone().project(camera);
        m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
      }
      dist *= m / FILL;
    }
    camera.position.copy(center).addScaledVector(viewDir, dist);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame();
    render();
  }

  let raf = 0;
  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => renderer.render(scene, camera));
  }

  // лёгкий параллакс от курсора (если пользователь не просил меньше движения)
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    window.addEventListener("pointermove", (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      world.rotation.y = nx * 0.06;
      world.rotation.x = ny * 0.03;
      render();
    });
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      lidTex.needsUpdate = true;
      cardTex.needsUpdate = true;
      render();
    });
  }

  return { render };
}
