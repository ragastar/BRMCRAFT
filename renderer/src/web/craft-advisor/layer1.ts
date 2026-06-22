import type { SlotAnalysis } from "./layer0";

// Слой 1 — сужение гипотез. Без таблиц весов (их нет в данных EE2) используем
// доступные сигналы: свободные слоты (главный рычаг крафта) и слабые
// существующие моды (высокий тир = есть куда расти). Это эвристика —
// приоритеты приблизительные, уточняются на Слое 2 ценами trade2.

export type CandidateKind = "fill-slot" | "improve-mod";
export type AffixType = "prefix" | "suffix";

export interface Candidate {
  kind: CandidateKind;
  affix: AffixType;
  reason: string;
  modName?: string;
  currentTier?: number;
  priority: number;
}

const FILL_BASE_PRIORITY = 100;

export function narrowCandidates(
  analysis: SlotAnalysis,
  maxCandidates = 5,
): Candidate[] {
  if (!analysis.modifiable) return [];

  const candidates: Candidate[] = [];

  // Свободные слоты — самый большой рычаг: добавить недостающий мод.
  for (const affix of ["prefix", "suffix"] as const) {
    const group = affix === "prefix" ? analysis.prefixes : analysis.suffixes;
    if (group.free > 0) {
      candidates.push({
        kind: "fill-slot",
        affix,
        reason: `Свободный ${affix === "prefix" ? "префикс" : "суффикс"} (${group.free}) — можно добавить мод`,
        priority: FILL_BASE_PRIORITY + group.free,
      });
    }
  }

  // Слабые существующие моды — есть запас по тиру (тир 1 = лучший, не трогаем).
  for (const affix of ["prefix", "suffix"] as const) {
    const group = affix === "prefix" ? analysis.prefixes : analysis.suffixes;
    for (const slot of group.occupied) {
      if (slot.tier !== undefined && slot.tier > 1) {
        candidates.push({
          kind: "improve-mod",
          affix,
          modName: slot.name,
          currentTier: slot.tier,
          reason: `«${slot.name ?? "мод"}» на тире ${slot.tier} — есть куда улучшать`,
          priority: slot.tier,
        });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, maxCandidates);
}
