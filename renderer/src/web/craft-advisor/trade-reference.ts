import type { ParsedItem } from "@/parser";
import {
  createTradeRequest,
  requestTradeResultList,
  requestResults,
  type PricingResult,
} from "@/web/price-check/trade/pathofexile-trade";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { getTradeEndpoint } from "@/web/price-check/trade/common";
import { useLeagues } from "@/web/background/Leagues";
import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/interfaces";
import { normalizeStatLine } from "./diff";
import { parseTier, parseAffix, type RefItem } from "./base-template";

// Слой 2 — эталонный поиск trade2. Чистый конвертер тестируется; сетевой
// fetchReference переиспользует пайплайн EE2 (createPresets → createTradeRequest
// → requestTradeResultList → requestResults), лимиты/кеш — внутри них.

type PresetOpts = Parameters<typeof createPresets>[1];

interface ConfigBits {
  language: string;
  realm: string;
  preferredTradeSite: string;
}
interface PcBits {
  collapseListings: PriceCheckWidget["collapseListings"];
  activateStockFilter: boolean;
  searchStatRange: number;
  defaultAllSelected: boolean;
  autoFillEmptyRuneSockets: PriceCheckWidget["autoFillEmptyRuneSockets"];
}

// Повторяет ровно формулу price-check (CheckedItem.vue). Расхождение в useEn
// строило query.type локализованным именем базы и ломало запрос на www-endpoint
// («Invalid query»). currency/listingType не форсим — как в price-check.
export function buildReferenceOpts(
  config: ConfigBits,
  pc: PcBits,
  league: string,
): PresetOpts {
  return {
    league,
    collapseListings: pc.collapseListings,
    activateStockFilter: pc.activateStockFilter,
    searchStatRange: pc.searchStatRange,
    useEn:
      (config.language === "cmn-Hant" && config.realm === "pc-ggg") ||
      config.preferredTradeSite === "www",
    currency: undefined,
    listingType: undefined,
    defaultAllSelected: pc.defaultAllSelected,
    autoFillEmptyAugmentSockets: pc.autoFillEmptyRuneSockets,
  };
}

// GGG trade2 fetch принимает максимум 10 id за запрос (иначе «Invalid query»).
// Штатный EE2 тоже батчит по 10 (trade-api.ts).
const FETCH_BATCH = 10;

export async function fetchInBatches<T>(
  ids: string[],
  size: number,
  fn: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    out.push(...(await fn(chunk)));
  }
  return out;
}

// Листинг → моды с тирами (для шаблона базы). Цену игнорируем — в poe2 шум.
export function pricingResultToRefItem(r: PricingResult): RefItem {
  const di = r.displayItem;
  const lines = [...(di?.explicitMods ?? []), ...(di?.implicitMods ?? [])];
  return {
    mods: lines
      .map((l) => ({
        shape: normalizeStatLine(l.text),
        tier: parseTier(l.tier),
        affix: parseAffix(l.tier),
      }))
      .filter((m) => m.shape.length > 0),
  };
}

const SAMPLE_SIZE = 40; // ~4 батча fetch

// Сравнимые кольца: те, что имеют ≥2 ИЗ ТВОИХ модов (релевантнее, чем все
// кольца базы). Цена не используется — берём выборку для частоты модов и тиров.
export async function fetchComparables(item: ParsedItem): Promise<RefItem[]> {
  const league = useLeagues().selectedId.value;
  if (!league) throw new Error("Лига не выбрана в настройках оверлея.");

  const pc = AppConfig<PriceCheckWidget>("price-check")!;
  const config = AppConfig();

  const { presets, active } = createPresets(
    item,
    buildReferenceOpts(config, pc, league),
  );
  const preset = presets.find((p) => p.id === active) ?? presets[0];
  if (!preset) throw new Error("Не удалось построить фильтры для предмета.");

  const body = createTradeRequest(preset.filters, [], item);
  // count-группа из твоих модов: «совпадает ≥2 из них». Берём только реальные
  // моды (explicit/implicit/pseudo) — спец-домены типа item.* GGG отвергает.
  const statIds = (preset.stats ?? [])
    .map((s) => s.tradeId?.[0])
    .filter((id): id is string => !!id && /^(explicit|implicit|pseudo)\./.test(id));
  if (statIds.length >= 2) {
    (body.query as { stats: unknown[] }).stats = [
      {
        type: "count",
        value: { min: Math.min(2, statIds.length) },
        filters: statIds.map((id) => ({ id })),
      },
    ];
  }

  let list;
  try {
    list = await requestTradeResultList(body, league);
  } catch (e) {
    throw new Error(
      `${(e as Error).message}\n\n— endpoint: ${getTradeEndpoint()} · лига: ${league}\n— preset: ${preset.id}\n— query: ${JSON.stringify(body.query)}`,
    );
  }

  const ids = (list.result ?? []).slice(0, SAMPLE_SIZE);
  if (ids.length === 0) return [];

  const results = await fetchInBatches(ids, FETCH_BATCH, (chunk) =>
    requestResults(list.id, chunk, { accountName: config.accountName }),
  );
  return results.map(pricingResultToRefItem);
}
