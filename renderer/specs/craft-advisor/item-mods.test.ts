import { describe, expect, it } from "vitest";
import { describeItemMods } from "@/web/craft-advisor/item-mods";

const RAW = `Item Class: Bows
Rarity: Rare
Oblivion Strike
Rider Bow
--------
Item Level: 80
--------
{ Prefix Modifier "Shocking" (Tier: 4) — Damage, Elemental, Lightning, Attack }
Adds 5(1-5) to 82(62-89) Lightning Damage
{ Prefix Modifier "Scorching" (Tier: 5) — Damage, Elemental, Fire, Attack }
Adds 27(20-30) to 36(31-46) Fire Damage
{ Prefix Modifier "Icy" (Tier: 8) — Damage, Elemental, Cold, Attack }
Adds 9(6-9) to 13(10-15) Cold Damage
{ Suffix Modifier "of Radiance" (Tier: 1) — Attack }
+57(41-60) to Accuracy Rating
15% increased Light Radius
`;

describe("describeItemMods — реальные строки свойств со значениями", () => {
  it("извлекает все аффиксы с типом, тиром и именем", () => {
    const mods = describeItemMods(RAW);
    expect(mods.length).toBe(4);
    expect(mods[0]).toMatchObject({ affix: "prefix", tier: 4, name: "Shocking" });
    expect(mods[3]).toMatchObject({ affix: "suffix", tier: 1, name: "of Radiance" });
  });

  it("показывает реальные значения, а не названия (диапазоны крафта вырезаны)", () => {
    const mods = describeItemMods(RAW);
    expect(mods[0].lines).toEqual(["Adds 5 to 82 Lightning Damage"]);
    expect(mods[3].lines).toEqual([
      "+57 to Accuracy Rating",
      "15% increased Light Radius",
    ]);
  });

  it("раскладывает по префиксам и суффиксам", () => {
    const mods = describeItemMods(RAW);
    expect(mods.filter((m) => m.affix === "prefix").length).toBe(3);
    expect(mods.filter((m) => m.affix === "suffix").length).toBe(1);
  });

  it("на тексте без advanced-формата возвращает пустой список", () => {
    expect(describeItemMods("Rarity: Rare\nRider Bow\n")).toEqual([]);
  });

  it("захватывает имплициты (affix: implicit)", () => {
    const RING = `Item Class: Rings
Rarity: Rare
Dire Twirl
Prismatic Ring
--------
{ Implicit Modifier — Elemental, Fire, Cold, Lightning, Resistance }
+8(7-10)% to all Elemental Resistances
--------
{ Suffix Modifier "of Exile" (Tier: 2) — Chaos, Resistance }
+23(20-23)% to Chaos Resistance
`;
    const mods = describeItemMods(RING);
    const impl = mods.find((m) => m.affix === "implicit");
    expect(impl).toBeTruthy();
    expect(impl!.lines).toEqual(["+8% to all Elemental Resistances"]);
    expect(mods.find((m) => m.affix === "suffix")!.name).toBe("of Exile");
  });
});
