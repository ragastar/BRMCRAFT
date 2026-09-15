import "./styles.css";
import "./invest.css";
import { createDevice } from "./device.js";
import { initCalculator } from "./calc.js";

// Глаз сверху — статичный, холодное состояние, без покачивания и без поворота
// по скроллу. Сцена не sticky, просто блок над текстом.
const device = createDevice(document.getElementById("device"), {
  reducedMotion: true,
  still: true,
  distanceScale: 1.12,
});
device.setState("cold");
window.__device = device;

initCalculator(document.getElementById("calc"));
