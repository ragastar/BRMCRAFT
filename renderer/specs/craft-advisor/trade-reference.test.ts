import { describe, expect, it } from "vitest";
import { pricingResultToRefItem } from "@/web/craft-advisor/trade-reference";

describe("pricingResultToRefItem — листинг trade2 → моды с тирами (для шаблона)", () => {
  it("берёт explicit/implicit моды, нормализует форму и тир", () => {
    const ref = pricingResultToRefItem({
      displayItem: {
        explicitMods: [
          { text: "+50% to [Resistances|Chaos Resistance]", tier: "S2" },
          { text: "+80 to maximum Mana", tier: "P3" },
        ],
        implicitMods: [{ text: "+12% to all Elemental Resistances", tier: "" }],
      },
    } as any);

    expect(ref.mods).toEqual([
      { shape: "#% to Chaos Resistance", tier: 2, affix: "suffix" },
      { shape: "# to maximum Mana", tier: 3, affix: "prefix" },
      { shape: "#% to all Elemental Resistances", tier: null, affix: null },
    ]);
  });

  it("без displayItem — пустые моды", () => {
    expect(pricingResultToRefItem({} as any).mods).toEqual([]);
  });
});
