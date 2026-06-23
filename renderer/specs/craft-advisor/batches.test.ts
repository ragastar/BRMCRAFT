import { describe, expect, it, vi } from "vitest";
import { fetchInBatches } from "@/web/craft-advisor/trade-reference";

describe("fetchInBatches — fetch листингов пачками (GGG лимит 10/запрос)", () => {
  it("режет id на пачки не больше size и склеивает результаты по порядку", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id${i}`);
    const calls: string[][] = [];
    const fn = vi.fn(async (chunk: string[]) => {
      calls.push(chunk);
      return chunk.map((id) => ({ id }));
    });

    const out = await fetchInBatches(ids, 10, fn);

    expect(calls.map((c) => c.length)).toEqual([10, 10, 5]);
    expect(out.length).toBe(25);
    expect(out[0]).toEqual({ id: "id0" });
    expect(out[24]).toEqual({ id: "id24" });
  });

  it("никогда не передаёт в fn больше size id", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id${i}`);
    const fn = vi.fn(async (chunk: string[]) => {
      expect(chunk.length).toBeLessThanOrEqual(10);
      return [];
    });
    await fetchInBatches(ids, 10, fn);
  });

  it("пустой список — fn не вызывается", async () => {
    const fn = vi.fn(async () => []);
    const out = await fetchInBatches([], 10, fn);
    expect(out).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
