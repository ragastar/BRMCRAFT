import { describe, expect, it } from "vitest";
import type { ParsedItem } from "@/parser";
import { ItemRarity } from "@/parser";
import { analyzeAffixSlots } from "@/web/craft-advisor/layer0";

type Gen = "prefix" | "suffix";

function mod(generation: Gen, name: string, tier: number, tags: string[] = []) {
  return {
    info: { type: "explicit", generation, name, tier, tags },
    stats: [],
  };
}

function makeItem(over: Partial<ParsedItem>): ParsedItem {
  return {
    rarity: ItemRarity.Rare,
    itemLevel: 80,
    newMods: [],
    statsByType: [],
    unknownModifiers: [],
    info: { name: "", refName: "Rider Bow", namespace: "ITEM", icon: "" },
    rawText: "",
    ...over,
  } as unknown as ParsedItem;
}

describe("analyzeAffixSlots — Layer 0", () => {
  it("counts occupied and free slots for a rare item (3 prefix max)", () => {
    const item = makeItem({
      rarity: ItemRarity.Rare,
      newMods: [
        mod("prefix", "Shocking", 4),
        mod("prefix", "Scorching", 5),
        mod("prefix", "Icy", 8),
        mod("suffix", "of Radiance", 1),
      ] as ParsedItem["newMods"],
    });

    const a = analyzeAffixSlots(item);

    expect(a.prefixes.occupied.length).toBe(3);
    expect(a.prefixes.max).toBe(3);
    expect(a.prefixes.free).toBe(0);

    expect(a.suffixes.occupied.length).toBe(1);
    expect(a.suffixes.max).toBe(3);
    expect(a.suffixes.free).toBe(2);
  });

  it("exposes base, item level and modifiable flag", () => {
    const item = makeItem({ itemLevel: 75 });
    const a = analyzeAffixSlots(item);
    expect(a.base).toBe("Rider Bow");
    expect(a.itemLevel).toBe(75);
    expect(a.modifiable).toBe(true);
  });

  it("magic items have 1 prefix + 1 suffix max", () => {
    const item = makeItem({
      rarity: ItemRarity.Magic,
      newMods: [mod("prefix", "Sharp", 2)] as ParsedItem["newMods"],
    });
    const a = analyzeAffixSlots(item);
    expect(a.prefixes.max).toBe(1);
    expect(a.suffixes.max).toBe(1);
    expect(a.prefixes.free).toBe(0);
    expect(a.suffixes.free).toBe(1);
  });

  it("normal and unique items are not modifiable (no open affixes)", () => {
    const normal = analyzeAffixSlots(makeItem({ rarity: ItemRarity.Normal }));
    expect(normal.modifiable).toBe(false);
    expect(normal.prefixes.max).toBe(0);

    const unique = analyzeAffixSlots(makeItem({ rarity: ItemRarity.Unique }));
    expect(unique.modifiable).toBe(false);
  });

  it("ignores non-affix mods (corrupted/implicit) when counting slots", () => {
    const item = makeItem({
      newMods: [
        mod("prefix", "Shocking", 4),
        { info: { type: "implicit", tags: [] }, stats: [] },
        { info: { type: "explicit", generation: "corrupted", tags: [] }, stats: [] },
      ] as ParsedItem["newMods"],
    });
    const a = analyzeAffixSlots(item);
    expect(a.prefixes.occupied.length).toBe(1);
    expect(a.suffixes.occupied.length).toBe(0);
  });
});
