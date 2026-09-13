import "./styles.css";
import Lenis from "lenis";

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
