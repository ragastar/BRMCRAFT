import type { ParsedItem } from "@/parser";
import { ItemRarity } from "@/parser";

// Слой 0 — локальный анализ предмета: база, iLvl, занятые/свободные слоты
// префиксов и суффиксов. Без сетевых запросов.

export interface AffixSlot {
  name?: string;
  tier?: number;
  tags: string[];
}

export interface SlotGroup {
  occupied: AffixSlot[];
  max: number;
  free: number;
}

export interface SlotAnalysis {
  rarity?: ItemRarity;
  base: string;
  itemLevel?: number;
  modifiable: boolean;
  prefixes: SlotGroup;
  suffixes: SlotGroup;
}

// Максимум аффиксов по редкости (PoE2). Уникалки — фиксированные моды, не крафтим.
const MAX_BY_RARITY: Record<string, { prefix: number; suffix: number }> = {
  [ItemRarity.Normal]: { prefix: 0, suffix: 0 },
  [ItemRarity.Magic]: { prefix: 1, suffix: 1 },
  [ItemRarity.Rare]: { prefix: 3, suffix: 3 },
  [ItemRarity.Unique]: { prefix: 0, suffix: 0 },
};

function toSlot(m: ParsedItem["newMods"][number]): AffixSlot {
  return {
    name: m.info.name,
    tier: m.info.tier,
    tags: m.info.tags ?? [],
  };
}

export function analyzeAffixSlots(item: ParsedItem): SlotAnalysis {
  const max = MAX_BY_RARITY[item.rarity ?? ItemRarity.Normal] ?? {
    prefix: 0,
    suffix: 0,
  };

  const prefixesOccupied = item.newMods
    .filter((m) => m.info.generation === "prefix")
    .map(toSlot);
  const suffixesOccupied = item.newMods
    .filter((m) => m.info.generation === "suffix")
    .map(toSlot);

  const modifiable =
    item.rarity === ItemRarity.Magic || item.rarity === ItemRarity.Rare;

  return {
    rarity: item.rarity,
    base: item.info.refName,
    itemLevel: item.itemLevel,
    modifiable,
    prefixes: {
      occupied: prefixesOccupied,
      max: max.prefix,
      free: Math.max(0, max.prefix - prefixesOccupied.length),
    },
    suffixes: {
      occupied: suffixesOccupied,
      max: max.suffix,
      free: Math.max(0, max.suffix - suffixesOccupied.length),
    },
  };
}
