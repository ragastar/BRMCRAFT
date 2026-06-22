import { describe, expect, it } from "vitest";
import { normalizeStatLine, diffReference } from "@/web/craft-advisor/diff";

describe("normalizeStatLine — форма стата без чисел", () => {
  it("заменяет числа на #", () => {
    expect(normalizeStatLine("Adds 5 to 82 Lightning Damage")).toBe(
      "Adds # to # Lightning Damage",
    );
    expect(normalizeStatLine("+57 to Accuracy Rating")).toBe(
      "# to Accuracy Rating",
    );
    expect(normalizeStatLine("15% increased Light Radius")).toBe(
      "#% increased Light Radius",
    );
  });

  it("совпадает для разных значений одной формы", () => {
    expect(normalizeStatLine("Adds 5 to 82 Lightning Damage")).toBe(
      normalizeStatLine("Adds 9 to 13 Lightning Damage"),
    );
  });
});

describe("diffReference — diff против эталонных листингов", () => {
  const myMods = [
    { affix: "prefix" as const, lines: ["Adds 5 to 82 Lightning Damage"] },
    { affix: "suffix" as const, lines: ["+57 to Accuracy Rating"] },
  ];
  const references = [
    {
      price: 50,
      currency: "divine",
      modLines: [
        "Adds 40 to 90 Lightning Damage",
        "+80 to maximum Life",
        "25% increased Attack Speed",
      ],
    },
    {
      price: 45,
      currency: "divine",
      modLines: ["Adds 30 to 70 Lightning Damage", "+80 to maximum Life"],
    },
  ];

  it("keep: твои моды, которые есть и у дорогих (по форме)", () => {
    const d = diffReference(myMods, references);
    expect(d.keep).toContain("Adds # to # Lightning Damage");
    // Accuracy у эталонов нет → не в keep
    expect(d.keep).not.toContain("# to Accuracy Rating");
  });

  it("missing: частые у эталонов формы, которых у тебя нет (по убыванию частоты)", () => {
    const d = diffReference(myMods, references);
    const shapes = d.missing.map((m) => m.shape);
    expect(shapes).toContain("# to maximum Life"); // в обоих эталонах
    expect(shapes).toContain("#% increased Attack Speed"); // в одном
    // Life встречается чаще Attack Speed → выше в списке
    expect(shapes.indexOf("# to maximum Life")).toBeLessThan(
      shapes.indexOf("#% increased Attack Speed"),
    );
    // то, что уже есть у тебя, не попадает в missing
    expect(shapes).not.toContain("Adds # to # Lightning Damage");
  });

  it("пустой эталон → пустые keep/missing", () => {
    const d = diffReference(myMods, []);
    expect(d.keep).toEqual([]);
    expect(d.missing).toEqual([]);
  });
});
