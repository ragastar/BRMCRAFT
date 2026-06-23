import { describe, expect, it } from "vitest";
import {
  parseTier,
  parseAffix,
  buildTemplate,
  recommend,
  type RefItem,
} from "@/web/craft-advisor/base-template";

describe("parseTier — номер тира из строки API", () => {
  it("вытаскивает число из P9 / S5 / 9", () => {
    expect(parseTier("P9")).toBe(9);
    expect(parseTier("S5")).toBe(5);
    expect(parseTier("3")).toBe(3);
  });
  it("пусто/мусор → null", () => {
    expect(parseTier("")).toBeNull();
    expect(parseTier(undefined)).toBeNull();
  });
});

describe("parseAffix — преф/суфф из буквы тира API", () => {
  it("P → prefix, S → suffix, иначе null", () => {
    expect(parseAffix("P9")).toBe("prefix");
    expect(parseAffix("S5")).toBe("suffix");
    expect(parseAffix("9")).toBeNull();
    expect(parseAffix(undefined)).toBeNull();
  });
});

describe("buildTemplate — частота модов + лучший тир по выборке", () => {
  const refs: RefItem[] = [
    { mods: [{ shape: "#% to Chaos Resistance", tier: 3 }, { shape: "# to maximum Mana", tier: 5 }] },
    { mods: [{ shape: "#% to Chaos Resistance", tier: 1 }] },
    { mods: [{ shape: "#% to Chaos Resistance", tier: 2 }, { shape: "# to maximum Mana", tier: 2 }] },
    { mods: [{ shape: "# to Dexterity", tier: 4 }] },
  ];

  it("частота и процент по форме", () => {
    const t = buildTemplate(refs);
    const chaos = t.entries.find((e) => e.shape === "#% to Chaos Resistance")!;
    expect(chaos.count).toBe(3);
    expect(chaos.pct).toBe(75); // 3/4
  });

  it("лучший тир = минимальный из встреченных", () => {
    const t = buildTemplate(refs);
    expect(t.entries.find((e) => e.shape === "#% to Chaos Resistance")!.bestTier).toBe(1);
    expect(t.entries.find((e) => e.shape === "# to maximum Mana")!.bestTier).toBe(2);
  });

  it("отсортировано по частоте убыв.", () => {
    const t = buildTemplate(refs);
    expect(t.entries[0].shape).toBe("#% to Chaos Resistance");
  });

  it("affix по большинству голосов из листингов", () => {
    const t = buildTemplate([
      { mods: [{ shape: "X", tier: 2, affix: "suffix" }] },
      { mods: [{ shape: "X", tier: 1, affix: "suffix" }] },
      { mods: [{ shape: "X", tier: 3, affix: "prefix" }] },
    ]);
    expect(t.entries[0].affix).toBe("suffix"); // 2 suffix vs 1 prefix
  });

  it("дубль формы в одном листинге считается один раз", () => {
    const t = buildTemplate([
      { mods: [{ shape: "X", tier: 2 }, { shape: "X", tier: 1 }] },
    ]);
    expect(t.entries[0].count).toBe(1);
    expect(t.entries[0].bestTier).toBe(1);
  });
});

describe("recommend — рекомендации от шаблона", () => {
  const refs: RefItem[] = [
    { mods: [{ shape: "#% increased Rarity of Items found", tier: 1 }, { shape: "# to maximum Mana", tier: 2 }] },
    { mods: [{ shape: "#% increased Rarity of Items found", tier: 1 }, { shape: "# to Evasion Rating", tier: 2 }] },
    { mods: [{ shape: "# to maximum Mana", tier: 3 }] },
  ];
  const myMods = [
    { shape: "#% increased Rarity of Items found", tier: 3, affix: "suffix" as const },
  ];

  it("improve: твой мод ниже достижимого тира", () => {
    const r = recommend(buildTemplate(refs), myMods);
    const imp = r.improve.find((x) => x.shape === "#% increased Rarity of Items found");
    expect(imp).toBeTruthy();
    expect(imp!.myTier).toBe(3);
    expect(imp!.bestTier).toBe(1);
  });

  it("add: частые моды, которых у тебя нет", () => {
    const r = recommend(buildTemplate(refs), myMods);
    const shapes = r.add.map((x) => x.shape);
    expect(shapes).toContain("# to maximum Mana");
    expect(shapes).not.toContain("#% increased Rarity of Items found"); // он у тебя есть
  });

  it("template помечает твои моды", () => {
    const r = recommend(buildTemplate(refs), myMods);
    const rar = r.template.find((x) => x.shape === "#% increased Rarity of Items found")!;
    expect(rar.mine).toBe(true);
    expect(rar.myTier).toBe(3);
  });

  it("add: с freeSlots помечает, есть ли слот под affix", () => {
    const tpl = buildTemplate([
      { mods: [{ shape: "# to maximum Mana", tier: 2, affix: "prefix" }] },
      { mods: [{ shape: "#% to Fire Resistance", tier: 2, affix: "suffix" }] },
    ]);
    const r = recommend(tpl, [], { prefix: 1, suffix: 0 });
    const mana = r.add.find((x) => x.shape === "# to maximum Mana")!;
    const fire = r.add.find((x) => x.shape === "#% to Fire Resistance")!;
    expect(mana.slotFree).toBe(true); // префикс свободен
    expect(fire.slotFree).toBe(false); // суффиксов нет
  });
});
