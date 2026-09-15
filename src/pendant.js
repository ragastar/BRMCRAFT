// Геометрия и материалы кулона «Левин»: миндалевидный корпус 60×28×9 мм,
// экран-миндаль с текстурой глаза, кнопка на торце, микрофон, ушко и шнур.
// 1 единица сцены = 10 мм. Используется на главной (device.js) и в коробке (box.js).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { EYE_W, EYE_H } from "./eye.js";

export const W = 6;
export const H = 2.8;
export const D = 0.9;
const EDGE = 0.32; // радиус скругления кромок корпуса
const SCREEN_W = 4.7;
const SCREEN_H = 1.57; // экран-миндаль ≈ 3:1, повторяет контур корпуса
export const PIVOT_Y = H / 2 + 0.44; // верх ушка — точка подвеса
export const BODY_DEFAULT = 0x101114;

export function almondShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(0, h * 0.96, w / 2, 0);
  s.quadraticCurveTo(0, -h * 0.96, -w / 2, 0);
  return s;
}

// Корпус: миндаль, выдавленный на толщину D, кромки скруглены фаской-четвертью.
// Фаска расширяет контур на EDGE с каждой стороны, поэтому исходная форма меньше.
function almondBody() {
  const depth = D - 2 * EDGE;
  const shape = almondShape(W - 2 * EDGE, (H / 2 - EDGE) / 0.48);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: EDGE,
    bevelSize: EDGE,
    bevelOffset: 0,
    bevelSegments: 10,
    curveSegments: 72,
  });
  geo.translate(0, 0, -depth / 2);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const smooth = mergeVertices(geo);
  smooth.computeVertexNormals();
  return smooth;
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

// Возвращает группу hang (точка подвеса в начале координат), внутри — body
// с корпусом; плюс материалы и холст экрана для отрисовки глаза.
export function buildPendant(renderer, { cord = true } = {}) {
  // Это кулон: пластина висит на шнуре за ушко. Точка подвеса — верх ушка;
  // покачивание идёт вокруг неё, а не вокруг центра пластины.
  const hang = new THREE.Group(); // качание на шнуре (ось — точка подвеса)
  const body = new THREE.Group(); // сама пластина с экраном
  hang.position.y = PIVOT_Y;
  body.position.y = -PIVOT_Y;
  hang.add(body);

  // --- корпус ---
  const metal = new THREE.MeshStandardMaterial({
    color: 0x101114,
    metalness: 0.7,
    roughness: 0.5,
    envMapIntensity: 1.0,
  });
  const plate = new THREE.Mesh(almondBody(), metal);
  body.add(plate);

  // --- экран: глянцевая рамка + сам экран с текстурой глаза ---
  const bezel = new THREE.Mesh(
    new THREE.ShapeGeometry(almondShape(SCREEN_W * 1.03, SCREEN_H * 1.07), 64),
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
    new THREE.ShapeGeometry(almondShape(SCREEN_W * 1.03, SCREEN_H * 1.07), 64),
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

  // --- кнопка на правом (остром) торце ---
  const button = new THREE.Mesh(
    new RoundedBoxGeometry(0.18, 0.44, 0.3, 3, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.85, roughness: 0.3 }),
  );
  button.position.set(W / 2 - 0.02, 0, 0);
  body.add(button);

  // --- микрофон: три отверстия вдоль нижней левой кромки лицевой стороны ---
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0 });
  for (const [x, y] of [
    [-1.92, -0.38],
    [-1.74, -0.46],
    [-1.56, -0.53],
  ]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), holeMat);
    hole.position.set(x, y, D / 2 + 0.002);
    body.add(hole);
  }

  // --- подвес: ушко на верхней кромке и шнур двумя нитями вверх ---
  const bailMetal = new THREE.MeshStandardMaterial({
    color: 0x2a2c32,
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 1.2,
  });
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 40), bailMetal);
  bail.position.set(0, H / 2 + 0.22, 0);
  body.add(bail);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 16), bailMetal);
  neck.position.set(0, H / 2 + 0.03, 0);
  body.add(neck);

  const cordMat = new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.8, metalness: 0.15 });
  const CORD_LEN = 8;
  for (const dir of cord ? [-1, 1] : []) {
    const ang = dir * 0.26; // ≈ 15° от вертикали
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, CORD_LEN, 10), cordMat);
    cord.position.set(Math.sin(ang) * (CORD_LEN / 2), (Math.cos(ang) * CORD_LEN) / 2, 0);
    cord.rotation.z = -ang;
    hang.add(cord); // шнур выходит из точки подвеса (начало координат hang)
  }


  return { hang, body, metal, eyeCanvas, ectx, eyeTex, glow };
}
