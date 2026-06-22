import { describe, expect, it } from "vitest";
import { ItemRarity } from "@/parser";
import type { SlotAnalysis } from "@/web/craft-advisor/layer0";
import type { Candidate } from "@/web/craft-advisor/layer1";
import { buildStrategyPrompt } from "@/web/craft-advisor/strategy-prompt";

const analysis: SlotAnalysis = {
  rarity: ItemRarity.Rare,
  base: "Rider Bow",
  itemLevel: 80,
  modifiable: true,
  prefixes: {
    occupied: [{ name: "Shocking", tier: 4, tags: ["Lightning"] }],
    max: 3,
    free: 2,
  },
  suffixes: {
    occupied: [{ name: "of Radiance", tier: 1, tags: ["Attack"] }],
    max: 3,
    free: 2,
  },
};

const candidates: Candidate[] = [
  { kind: "fill-slot", affix: "prefix", reason: "Свободный префикс", priority: 102 },
  {
    kind: "improve-mod",
    affix: "prefix",
    modName: "Shocking",
    currentTier: 4,
    reason: "«Shocking» на тире 4",
    priority: 4,
  },
];

describe("buildStrategyPrompt — промпт для Claude (Слой 5)", () => {
  it("user-промпт содержит базу и iLvl", () => {
    const { user } = buildStrategyPrompt({ analysis, candidates });
    expect(user).toContain("Rider Bow");
    expect(user).toContain("80");
  });

  it("user-промпт перечисляет занятые моды с тирами", () => {
    const { user } = buildStrategyPrompt({ analysis, candidates });
    expect(user).toContain("Shocking");
    expect(user).toContain("of Radiance");
  });

  it("user-промпт указывает свободные слоты", () => {
    const { user } = buildStrategyPrompt({ analysis, candidates });
    expect(user).toMatch(/префикс/i);
    expect(user).toMatch(/суффикс/i);
  });

  it("user-промпт включает кандидатов", () => {
    const { user } = buildStrategyPrompt({ analysis, candidates });
    expect(user).toContain("Свободный префикс");
  });

  it("system-промпт требует русский, методы и приблизительные вероятности", () => {
    const { system } = buildStrategyPrompt({ analysis, candidates });
    expect(system.toLowerCase()).toContain("path of exile 2");
    expect(system).toMatch(/вероятност/i);
    expect(system).toMatch(/приблиз|примерн|оценочн/i);
  });

  it("включает цену, если передана, и не падает без неё", () => {
    const withPrice = buildStrategyPrompt({
      analysis,
      candidates,
      price: { value: 5, currency: "divine" },
    });
    expect(withPrice.user).toContain("5");
    expect(withPrice.user.toLowerCase()).toContain("divine");

    const without = buildStrategyPrompt({ analysis, candidates });
    expect(without.user.length).toBeGreaterThan(0);
  });
});
