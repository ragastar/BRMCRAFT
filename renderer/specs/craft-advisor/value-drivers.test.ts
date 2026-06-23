import { describe, expect, it } from "vitest";
import { valueDrivers, sampleSpread } from "@/web/craft-advisor/value-drivers";

describe("sampleSpread — равномерная выборка по диапазону", () => {
  it("берёт n элементов, размазанных по массиву (вкл. концы)", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id${i}`);
    const s = sampleSpread(ids, 10);
    expect(s.length).toBe(10);
    expect(s[0]).toBe("id0"); // дешёвый конец
    expect(s[s.length - 1]).toBe("id99"); // дорогой конец
    // уникальны и по возрастанию исходного индекса
    expect(new Set(s).size).toBe(10);
  });

  it("если элементов меньше n — возвращает все", () => {
    expect(sampleSpread(["a", "b", "c"], 10)).toEqual(["a", "b", "c"]);
  });
});

describe("valueDrivers — какой мод коррелирует с ценой (по порядку дешёвые→дорогие)", () => {
  // refs упорядочены от дешёвых к дорогим (как выдаёт trade2 asc)
  const refs = [
    { price: 1, currency: "ex", modLines: ["+10 to maximum Mana"] },
    { price: 1, currency: "ex", modLines: ["+12 to maximum Mana"] },
    { price: 1, currency: "ex", modLines: ["+8 to Strength"] },
    { price: 1, currency: "ex", modLines: ["+9 to Strength"] },
    // дорогая половина — почти у всех Cast Speed
    { price: 1, currency: "ex", modLines: ["25% increased Cast Speed", "+11 to maximum Mana"] },
    { price: 1, currency: "ex", modLines: ["28% increased Cast Speed"] },
    { price: 1, currency: "ex", modLines: ["30% increased Cast Speed", "+7 to Strength"] },
    { price: 1, currency: "ex", modLines: ["27% increased Cast Speed"] },
  ];

  it("Cast Speed — драйвер цены (чаще у дорогой половины)", () => {
    const r = valueDrivers(refs, new Set<string>());
    expect(r.drivers[0].shape).toBe("#% increased Cast Speed");
    expect(r.drivers[0].lift).toBeGreaterThan(0);
  });

  it("missing — драйверы, которых у тебя нет; keep — которые есть", () => {
    const r = valueDrivers(refs, new Set(["#% increased Cast Speed"]));
    expect(r.missing.map((d) => d.shape)).not.toContain("#% increased Cast Speed");
    expect(r.keep.map((d) => d.shape)).toContain("#% increased Cast Speed");
  });

  it("мод, равномерный по цене, не считается драйвером (lift ~0)", () => {
    const flat = [
      { price: 1, currency: "ex", modLines: ["+5 to Dexterity"] },
      { price: 1, currency: "ex", modLines: ["+6 to Dexterity"] },
      { price: 1, currency: "ex", modLines: ["+5 to Dexterity"] },
      { price: 1, currency: "ex", modLines: ["+6 to Dexterity"] },
    ];
    const r = valueDrivers(flat, new Set<string>());
    expect(r.drivers.length).toBe(0);
  });

  it("пустой эталон → пусто", () => {
    const r = valueDrivers([], new Set<string>());
    expect(r.drivers).toEqual([]);
    expect(r.missing).toEqual([]);
  });
});
