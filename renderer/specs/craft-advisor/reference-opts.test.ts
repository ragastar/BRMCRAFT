import { describe, expect, it } from "vitest";
import { buildReferenceOpts } from "@/web/craft-advisor/trade-reference";

const pc = {
  collapseListings: "api" as const,
  activateStockFilter: false,
  searchStatRange: 10,
  defaultAllSelected: false,
  autoFillEmptyRuneSockets: false as const,
};

describe("buildReferenceOpts — повторяет формулу price-check (фикс Invalid query)", () => {
  it("useEn=true когда preferredTradeSite='www' даже при русском языке", () => {
    const o = buildReferenceOpts(
      { language: "ru", realm: "pc-ggg", preferredTradeSite: "www" },
      pc,
      "Standard",
    );
    expect(o.useEn).toBe(true);
  });

  it("useEn=true для cmn-Hant + pc-ggg", () => {
    const o = buildReferenceOpts(
      { language: "cmn-Hant", realm: "pc-ggg", preferredTradeSite: "default" },
      pc,
      "Standard",
    );
    expect(o.useEn).toBe(true);
  });

  it("useEn=false для ru + default (локальный реалм)", () => {
    const o = buildReferenceOpts(
      { language: "ru", realm: "pc-ggg", preferredTradeSite: "default" },
      pc,
      "Standard",
    );
    expect(o.useEn).toBe(false);
  });

  it("не форсит currency и listingType (как price-check)", () => {
    const o = buildReferenceOpts(
      { language: "en", realm: "pc-ggg", preferredTradeSite: "default" },
      pc,
      "Standard",
    );
    expect(o.currency).toBeUndefined();
    expect(o.listingType).toBeUndefined();
  });

  it("пробрасывает лигу и поля виджета", () => {
    const o = buildReferenceOpts(
      { language: "en", realm: "pc-ggg", preferredTradeSite: "default" },
      pc,
      "Runes of Aldur",
    );
    expect(o.league).toBe("Runes of Aldur");
    expect(o.searchStatRange).toBe(10);
    expect(o.collapseListings).toBe("api");
  });
});
