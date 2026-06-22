import { describe, expect, it } from "vitest";
import { ItemRarity } from "@/parser";
import type { SlotAnalysis } from "@/web/craft-advisor/layer0";
import { narrowCandidates } from "@/web/craft-advisor/layer1";

function analysis(over: Partial<SlotAnalysis>): SlotAnalysis {
  return {
    rarity: ItemRarity.Rare,
    base: "Rider Bow",
    itemLevel: 80,
    modifiable: true,
    prefixes: { occupied: [], max: 3, free: 3 },
    suffixes: { occupied: [], max: 3, free: 3 },
    ...over,
  };
}

describe("narrowCandidates — Layer 1", () => {
  it("suggests filling each free affix slot", () => {
    const a = analysis({
      prefixes: { occupied: [{ tags: [] }], max: 3, free: 2 },
      suffixes: { occupied: [], max: 3, free: 3 },
    });
    const c = narrowCandidates(a);
    const fills = c.filter((x) => x.kind === "fill-slot");
    expect(fills.some((x) => x.affix === "prefix")).toBe(true);
    expect(fills.some((x) => x.affix === "suffix")).toBe(true);
  });

  it("suggests improving a weak (high-tier) existing mod", () => {
    const a = analysis({
      prefixes: {
        occupied: [{ name: "Icy", tier: 8, tags: ["Cold"] }],
        max: 3,
        free: 2,
      },
      suffixes: { occupied: [], max: 3, free: 3 },
    });
    const c = narrowCandidates(a);
    const improve = c.find((x) => x.kind === "improve-mod");
    expect(improve).toBeTruthy();
    expect(improve!.modName).toBe("Icy");
    expect(improve!.currentTier).toBe(8);
  });

  it("does not suggest improving an already top-tier (tier 1) mod", () => {
    const a = analysis({
      prefixes: {
        occupied: [{ name: "Flaring", tier: 1, tags: [] }],
        max: 3,
        free: 0,
      },
      suffixes: { occupied: [], max: 3, free: 0 },
    });
    const c = narrowCandidates(a);
    expect(c.length).toBe(0);
  });

  it("ranks empty-slot fills above weak-mod improvements", () => {
    const a = analysis({
      prefixes: {
        occupied: [{ name: "Icy", tier: 8, tags: [] }],
        max: 3,
        free: 2,
      },
      suffixes: { occupied: [], max: 3, free: 0 },
    });
    const c = narrowCandidates(a);
    expect(c[0].kind).toBe("fill-slot");
  });

  it("caps the candidate list (default 5)", () => {
    const a = analysis({
      prefixes: {
        occupied: [
          { name: "a", tier: 6, tags: [] },
          { name: "b", tier: 7, tags: [] },
          { name: "c", tier: 8, tags: [] },
        ],
        max: 3,
        free: 0,
      },
      suffixes: {
        occupied: [
          { name: "d", tier: 6, tags: [] },
          { name: "e", tier: 7, tags: [] },
          { name: "f", tier: 8, tags: [] },
        ],
        max: 3,
        free: 0,
      },
    });
    const c = narrowCandidates(a);
    expect(c.length).toBeLessThanOrEqual(5);
  });

  it("returns nothing for non-modifiable items", () => {
    const a = analysis({ modifiable: false, rarity: ItemRarity.Unique });
    expect(narrowCandidates(a)).toEqual([]);
  });
});
