import { describe, expect, it } from "vitest";
import { isPlausiblePrice } from "@/web/craft-advisor/value-drivers";

describe("isPlausiblePrice — отсев скам/плейсхолдер листингов", () => {
  it("отбрасывает абсурдные суммы (99999999 mirror и т.п.)", () => {
    expect(isPlausiblePrice(99999999, "mirror")).toBe(false);
    expect(isPlausiblePrice(100000, "divine")).toBe(false);
  });

  it("пропускает нормальные цены любой валюты", () => {
    expect(isPlausiblePrice(1, "transmute")).toBe(true);
    expect(isPlausiblePrice(50, "divine")).toBe(true);
    expect(isPlausiblePrice(3, "mirror")).toBe(true); // дорого, но не плейсхолдер
  });

  it("отбрасывает нулевые/отрицательные/пустые", () => {
    expect(isPlausiblePrice(0, "exalted")).toBe(false);
    expect(isPlausiblePrice(-1, "exalted")).toBe(false);
    expect(isPlausiblePrice(undefined as any, undefined as any)).toBe(false);
  });
});
