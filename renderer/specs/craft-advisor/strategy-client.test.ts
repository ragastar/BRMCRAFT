import { describe, expect, it, vi } from "vitest";
import { requestStrategy } from "@/web/craft-advisor/strategy-client";

const prompt = { system: "SYS", user: "USR" };

type FetchFn = typeof window.fetch;

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

function fetchMock(impl: FetchFn) {
  return vi.fn(impl);
}

describe("requestStrategy — клиент OpenRouter (Claude)", () => {
  it("шлёт POST на openrouter с системным и пользовательским сообщениями", async () => {
    const fetchImpl = fetchMock(async () => okResponse("план крафта"));
    await requestStrategy(prompt, { apiKey: "sk-xxx", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("openrouter.ai");
    expect(init!.method).toBe("POST");
    const body = JSON.parse(init!.body as string);
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(body.messages[1]).toEqual({ role: "user", content: "USR" });
  });

  it("передаёт Authorization: Bearer с ключом", async () => {
    const fetchImpl = fetchMock(async () => okResponse("x"));
    await requestStrategy(prompt, { apiKey: "sk-secret", fetchImpl });
    const init = fetchImpl.mock.calls[0][1]!;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-secret");
  });

  it("использует модель Claude через OpenRouter по умолчанию", async () => {
    const fetchImpl = fetchMock(async () => okResponse("x"));
    await requestStrategy(prompt, { apiKey: "k", fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string);
    expect(body.model).toMatch(/claude/i);
  });

  it("позволяет переопределить модель", async () => {
    const fetchImpl = fetchMock(async () => okResponse("x"));
    await requestStrategy(prompt, {
      apiKey: "k",
      model: "anthropic/claude-opus-4",
      fetchImpl,
    });
    const body = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string);
    expect(body.model).toBe("anthropic/claude-opus-4");
  });

  it("возвращает текст из choices[0].message.content", async () => {
    const fetchImpl = fetchMock(async () => okResponse("докрути резист холода"));
    const out = await requestStrategy(prompt, { apiKey: "k", fetchImpl });
    expect(out).toBe("докрути резист холода");
  });

  it("кидает ошибку при не-ok ответе", async () => {
    const fetchImpl = fetchMock(
      async () =>
        ({ ok: false, status: 401, text: async () => "unauthorized" }) as unknown as Response,
    );
    await expect(
      requestStrategy(prompt, { apiKey: "bad", fetchImpl }),
    ).rejects.toThrow();
  });

  it("кидает ошибку, если ключ не задан", async () => {
    const fetchImpl = fetchMock(async () => okResponse("x"));
    await expect(
      requestStrategy(prompt, { apiKey: "", fetchImpl }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
