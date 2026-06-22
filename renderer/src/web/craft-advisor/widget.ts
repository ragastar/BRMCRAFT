import type { Widget } from "../overlay/widgets.js";

export interface CraftAdvisorWidget extends Widget {
  // Полный шорткат (напр. "Ctrl + E"). Вызывает панель Craft Advisor
  // на наведённом предмете.
  hotkey: string | null;
  // OpenRouter API-ключ (Слой 5 — стратегия через Claude). Хранится в конфиге
  // пользователя, не в коде.
  openRouterKey: string;
  // Модель OpenRouter (по умолчанию anthropic/claude-sonnet-4).
  strategyModel: string;
}
