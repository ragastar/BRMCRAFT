import "./styles.css";
import Lenis from "lenis";
import { createDevice } from "./device.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Плавный скролл — только если пользователь не просил меньше движения.
if (!reducedMotion) {
  const lenis = new Lenis({ lerp: 0.1 });
  window.__lenis = lenis;
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

// Устройство в сцене. Единственная анимация «сама по себе» — глаз
// открывается при загрузке.
const device = createDevice(document.getElementById("device"), { reducedMotion });
window.__device = device;
setTimeout(() => device.setState("open", { duration: 1.4, ease: "power3.out" }), 250);
