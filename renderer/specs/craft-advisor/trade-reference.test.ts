import { describe, expect, it } from "vitest";
import { pricingResultToReference } from "@/web/craft-advisor/trade-reference";

describe("pricingResultToReference — листинг trade2 → эталон для diff", () => {
  it("берёт цену и строки explicit/implicit модов", () => {
    const ref = pricingResultToReference({
      priceAmount: 50,
      priceCurrency: "divine",
      displayItem: {
        explicitMods: [
          { text: "Adds 40 to 90 Lightning Damage", color: 0 },
          { text: "+80 to maximum Life", color: 0 },
        ],
        implicitMods: [{ text: "+12% to Lightning Resistance", color: 0 }],
      },
    } as any);

    expect(ref.price).toBe(50);
    expect(ref.currency).toBe("divine");
    expect(ref.modLines).toEqual([
      "Adds 40 to 90 Lightning Damage",
      "+80 to maximum Life",
      "+12% to Lightning Resistance",
    ]);
  });

  it("без displayItem/модов — пустые строки", () => {
    const ref = pricingResultToReference({
      priceAmount: 1,
      priceCurrency: "exalted",
    } as any);
    expect(ref.modLines).toEqual([]);
  });
});
