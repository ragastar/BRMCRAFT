import "./styles.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { createDevice } from "./device.js";
import { initWaitlistForm } from "./form.js";

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- плавный скролл (Lenis), только если пользователь не просил меньше движения
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}

// якорные ссылки (#waitlist, #top) — через Lenis, чтобы не спорить с ним
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0 });
    else target.scrollIntoView();
  });
});

// --- устройство
const device = createDevice(document.getElementById("device"), { reducedMotion });
window.__device = device;

// Единственная анимация «сама по себе»: глаз открывается при загрузке.
// Ставим состояние до создания триггеров, чтобы триггер первой панели
// не перебил длинное открытие коротким.
device.setState("open", { duration: 1.4, ease: "power3.out" });

// --- состояния глаза по панелям: активна та панель, чей верх прошёл 62% высоты окна
document.querySelectorAll(".panel[data-eye]").forEach((panel) => {
  ScrollTrigger.create({
    trigger: panel,
    start: "top 62%",
    end: "bottom 62%",
    onToggle: (self) => {
      if (self.isActive) device.setState(panel.dataset.eye);
    },
  });
});

// --- поворот устройства на 20–30° по ходу всей страницы
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: (self) => device.setScroll(self.progress),
});

// --- форма листа ожидания
initWaitlistForm(document.getElementById("waitlist-form"));
