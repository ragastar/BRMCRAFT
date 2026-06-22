import { describe, expect, it } from "vitest";
import { signatureFor } from "@/web/craft-advisor/signature";

describe("signatureFor — стабильная сигнатура предмета для кеша цен", () => {
  const base = {
    base: "Rider Bow",
    league: "Standard",
    mods: [
      { name: "Shocking", tier: 4 },
      { name: "of Radiance", tier: 1 },
    ],
  };

  it("производит непустую строку", () => {
    expect(signatureFor(base).length).toBeGreaterThan(0);
  });

  it("одинаковый ввод → одинаковая сигнатура", () => {
    expect(signatureFor(base)).toBe(signatureFor({ ...base }));
  });

  it("не зависит от порядка модов", () => {
    const reordered = {
      ...base,
      mods: [
        { name: "of Radiance", tier: 1 },
        { name: "Shocking", tier: 4 },
      ],
    };
    expect(signatureFor(reordered)).toBe(signatureFor(base));
  });

  it("разная база → разная сигнатура", () => {
    expect(signatureFor({ ...base, base: "Decimation Bow" })).not.toBe(
      signatureFor(base),
    );
  });

  it("разная лига → разная сигнатура", () => {
    expect(signatureFor({ ...base, league: "Hardcore" })).not.toBe(
      signatureFor(base),
    );
  });

  it("разный тир мода → разная сигнатура", () => {
    const t = {
      ...base,
      mods: [
        { name: "Shocking", tier: 5 },
        { name: "of Radiance", tier: 1 },
      ],
    };
    expect(signatureFor(t)).not.toBe(signatureFor(base));
  });
});
