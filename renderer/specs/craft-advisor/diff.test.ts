import { describe, expect, it } from "vitest";
import { normalizeStatLine } from "@/web/craft-advisor/diff";

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

  it("вычищает GGG-разметку [Display|Ref] и [X]", () => {
    expect(normalizeStatLine("+23% to [Resistances|Chaos Resistance]")).toBe(
      "#% to Chaos Resistance",
    );
    expect(normalizeStatLine("+57 to [Accuracy|Accuracy] Rating")).toBe(
      "# to Accuracy Rating",
    );
  });

  it("мод из текста игры матчится с модом из API (после нормализации)", () => {
    expect(normalizeStatLine("+23% to Chaos Resistance")).toBe(
      normalizeStatLine("+15% to [Resistances|Chaos Resistance]"),
    );
  });
});
