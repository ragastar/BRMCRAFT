import { Host } from "@/web/background/IPC";
import type { StrategyPrompt } from "./strategy-prompt";

// Слой 5 — вызов Claude через OpenRouter (правило проекта: НЕ прямой Anthropic,
// он заблокирован из РФ). Ключ хранится у пользователя, не в коде.
// fetchImpl инъектируется ради тестируемости; в проде — Host.proxy.

export interface StrategyClientOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof window.fetch;
}

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const ENDPOINT = "openrouter.ai/api/v1/chat/completions";

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function requestStrategy(
  prompt: StrategyPrompt,
  options: StrategyClientOptions,
): Promise<string> {
  if (!options.apiKey) {
    throw new Error("Не задан API-ключ OpenRouter для Craft Advisor.");
  }

  const fetchImpl = options.fetchImpl ?? Host.proxy;
  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter вернул пустой ответ.");
  }
  return content;
}
