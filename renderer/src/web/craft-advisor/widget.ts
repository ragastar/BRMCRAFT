import type { Widget } from "../overlay/widgets.js";

export interface CraftAdvisorWidget extends Widget {
  // Полный шорткат (напр. "Ctrl + E"). Вызывает панель Craft Advisor
  // на наведённом предмете.
  hotkey: string | null;
  // Не используется (легаси): стратегия теперь идёт через локальный claude CLI
  // на подписке пользователя, API-ключ не нужен. Оставлено для совместимости
  // со старыми конфигами.
  openRouterKey: string;
  // Модель для claude CLI: псевдоним подписки (sonnet / opus / haiku) или
  // полный id. Значения с недопустимыми символами санируются до sonnet.
  strategyModel: string;
}
