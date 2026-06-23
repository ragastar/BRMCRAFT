import { describe, expect, it } from "vitest";
import { buildStrategyPrompt } from "@/web/craft-advisor/strategy-prompt";

const input = {
  base: "Prismatic Ring",
  itemLevel: 80,
  itemMods: [
    { affix: "suffix" as const, tier: 2, lines: ["+23% to Chaos Resistance"] },
    { affix: "implicit" as const, lines: ["+8% to all Elemental Resistances"] },
  ],
  improve: [
    { shape: "Gain # Mana per enemy killed", myTier: 2, bestTier: 1, pct: 23 },
  ],
  add: [
    { shape: "# to maximum Mana", pct: 15, bestTier: 5, affix: "prefix" as const, slotFree: true },
    { shape: "#% to Fire Resistance", pct: 15, bestTier: 4, affix: "suffix" as const, slotFree: false },
  ],
  freeSlots: { prefix: 2, suffix: 0 },
};

describe("buildStrategyPrompt — промпт метода крафта поверх рекомендаций", () => {
  it("user содержит базу и iLvl", () => {
    const { user } = buildStrategyPrompt(input);
    expect(user).toContain("Prismatic Ring");
    expect(user).toContain("80");
  });

  it("user перечисляет improve (тир→тир) и add (с affix/слотом)", () => {
    const { user } = buildStrategyPrompt(input);
    expect(user).toContain("Gain # Mana per enemy killed");
    expect(user).toMatch(/T2.*T1|T2 → T1/);
    expect(user).toContain("# to maximum Mana");
    expect(user).toMatch(/Fire Resistance/);
    expect(user).toMatch(/своб|нет слота|свап/i); // статус слота
  });

  it("user показывает свойства предмета", () => {
    const { user } = buildStrategyPrompt(input);
    expect(user).toContain("Chaos Resistance");
  });

  it("system требует PoE2, метод, приблизительную вероятность, русский", () => {
    const { system } = buildStrategyPrompt(input);
    expect(system.toLowerCase()).toContain("path of exile 2");
    expect(system).toMatch(/метод|эссенц|экзальт|омен/i);
    expect(system).toMatch(/вероятност/i);
    expect(system).toMatch(/приблиз|примерн|оценочн/i);
  });

  it("не падает без рекомендаций", () => {
    const empty = buildStrategyPrompt({
      base: "X", itemLevel: 1, itemMods: [], improve: [], add: [], freeSlots: { prefix: 0, suffix: 0 },
    });
    expect(empty.user.length).toBeGreaterThan(0);
  });
});
