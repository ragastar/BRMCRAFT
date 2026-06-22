import type { Widget } from "../overlay/widgets.js";

export interface CraftAdvisorWidget extends Widget {
  // Полный шорткат (напр. "Ctrl + E"). Вызывает панель Craft Advisor
  // на наведённом предмете.
  hotkey: string | null;
}
