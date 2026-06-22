import { describe, expect, it, vi } from "vitest";
import { requestStrategy } from "@/web/craft-advisor/strategy-client";

const prompt = { system: "SYS", user: "USR" };

type FetchFn = typeof window.fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function fetchMock(impl: FetchFn) {
  return vi.fn(impl);
}

describe("requestStrategy — локальный Claude CLI через подписку (POST /claude)", () => {
  it("POST на /claude с system, user и моделью", async () => {
    const postImpl = fetchMock(async () =>
      jsonResponse({ success: true, result: "план" }),
    );
    await requestStrategy(prompt, { model: "sonnet", postImpl });

    expect(postImpl).toHaveBeenCalledOnce();
    const [url, init] = postImpl.mock.calls[0];
    expect(String(url)).toBe("/claude");
    expect(init!.method).toBe("POST");
    const body = JSON.parse(init!.body as string);
    expect(body.system).toBe("SYS");
    expect(body.user).toBe("USR");
    expect(body.model).toBe("sonnet");
  });

  it("модель по умолчанию — sonnet (псевдоним подписки)", async () => {
    const postImpl = fetchMock(async () =>
      jsonResponse({ success: true, result: "x" }),
    );
    await requestStrategy(prompt, { postImpl });
    const body = JSON.parse(postImpl.mock.calls[0][1]!.body as string);
    expect(body.model).toBe("sonnet");
  });

  it("возвращает result из ответа", async () => {
    const postImpl = fetchMock(async () =>
      jsonResponse({ success: true, result: "докрути резист холода" }),
    );
    const out = await requestStrategy(prompt, { postImpl });
    expect(out).toBe("докрути резист холода");
  });

  it("кидает ошибку при success:false с текстом ошибки", async () => {
    const postImpl = fetchMock(async () =>
      jsonResponse({ success: false, error: "claude не найден" }),
    );
    await expect(requestStrategy(prompt, { postImpl })).rejects.toThrow(
      /claude не найден/,
    );
  });

  it("кидает ошибку при не-ok HTTP", async () => {
    const postImpl = fetchMock(async () =>
      jsonResponse({ success: false, error: "boom" }, false, 500),
    );
    await expect(requestStrategy(prompt, { postImpl })).rejects.toThrow();
  });

  it("НЕ требует API-ключа (работает на подписке)", async () => {
    const postImpl = fetchMock(async () =>
      jsonResponse({ success: true, result: "ok" }),
    );
    // вызывается вообще без apiKey
    await expect(
      requestStrategy(prompt, { postImpl }),
    ).resolves.toBe("ok");
  });
});
