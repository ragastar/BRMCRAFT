import { beforeEach, describe, expect, it } from "vitest";
import {
  PriceHistoryStore,
  type StorageBackend,
} from "@/web/craft-advisor/price-history";

function memoryBackend(): StorageBackend {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("PriceHistoryStore — персистентная история цен по сигнатуре", () => {
  let backend: StorageBackend;
  let store: PriceHistoryStore;

  beforeEach(() => {
    backend = memoryBackend();
    store = new PriceHistoryStore(backend);
  });

  it("записанное наблюдение возвращается в истории", () => {
    store.record("sig-a", { price: 5, currency: "divine", at: 100 });
    expect(store.history("sig-a")).toEqual([
      { price: 5, currency: "divine", at: 100 },
    ]);
  });

  it("несколько наблюдений накапливаются", () => {
    store.record("sig-a", { price: 5, currency: "divine", at: 100 });
    store.record("sig-a", { price: 7, currency: "divine", at: 200 });
    expect(store.history("sig-a").length).toBe(2);
  });

  it("latest возвращает наблюдение с наибольшим at", () => {
    store.record("sig-a", { price: 5, currency: "divine", at: 200 });
    store.record("sig-a", { price: 7, currency: "divine", at: 100 });
    expect(store.latest("sig-a")).toEqual({
      price: 5,
      currency: "divine",
      at: 200,
    });
  });

  it("неизвестная сигнатура → пустая история и undefined latest", () => {
    expect(store.history("nope")).toEqual([]);
    expect(store.latest("nope")).toBeUndefined();
  });

  it("данные переживают пересоздание стора на том же backend", () => {
    store.record("sig-a", { price: 5, currency: "divine", at: 100 });
    const store2 = new PriceHistoryStore(backend);
    expect(store2.history("sig-a").length).toBe(1);
  });

  it("история ограничена максимумом наблюдений", () => {
    for (let i = 0; i < 60; i++) {
      store.record("sig-a", { price: i, currency: "divine", at: i });
    }
    expect(store.history("sig-a").length).toBeLessThanOrEqual(50);
    // самые свежие сохраняются
    expect(store.latest("sig-a")!.at).toBe(59);
  });
});
