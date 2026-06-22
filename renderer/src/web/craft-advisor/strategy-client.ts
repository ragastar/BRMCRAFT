import type { StrategyPrompt } from "./strategy-prompt";

// Слой 5 — вызов Claude через ЛОКАЛЬНЫЙ CLI (`claude -p`), используя подписку
// пользователя. Запрос идёт POST /claude на локальный сервер main, который
// спавнит CLI. Ключ API не нужен — авторизация по подписке (OAuth/keychain).
// postImpl инъектируется ради тестируемости; в проде — window.fetch (relative).

export interface StrategyClientOptions {
  model?: string;
  postImpl?: typeof window.fetch;
}

interface ClaudeResponse {
  success: boolean;
  result?: string;
  error?: string;
}

const DEFAULT_MODEL = "sonnet";

export async function requestStrategy(
  prompt: StrategyPrompt,
  options: StrategyClientOptions = {},
): Promise<string> {
  const post = options.postImpl ?? window.fetch.bind(window);

  const response = await post("/claude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: prompt.system,
      user: prompt.user,
      model: options.model ?? DEFAULT_MODEL,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Claude CLI HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  if (!data.success) {
    throw new Error(data.error || "Claude CLI вернул ошибку.");
  }
  if (!data.result) {
    throw new Error("Claude CLI вернул пустой ответ.");
  }
  return data.result;
}
