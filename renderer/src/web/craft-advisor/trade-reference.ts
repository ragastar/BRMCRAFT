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
import type { ReferenceListing } from "./diff";

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

export function pricingResultToReference(r: PricingResult): ReferenceListing {
  const di = r.displayItem;
  const lines = [
    ...(di?.explicitMods ?? []),
    ...(di?.implicitMods ?? []),
  ].map((l) => l.text);
  return {
    price: r.priceAmount,
    currency: r.priceCurrency,
    modLines: lines,
  };
}

export async function fetchReference(
  item: ParsedItem,
  opts: { limit?: number } = {},
): Promise<ReferenceListing[]> {
  const limit = opts.limit ?? 20;
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

  // «Часть твоих свойств»: ищем по базе (без жёстких стат-фильтров), затем
  // diff покажет общие/недостающие моды. Эталон по дорогому концу — тюним живьём.
  const body = createTradeRequest(preset.filters, [], item);

  let list;
  try {
    list = await requestTradeResultList(body, league);
  } catch (e) {
    // Диагностика: прикладываем точное тело и endpoint для воспроизведения
    throw new Error(
      `${(e as Error).message}\n\n— endpoint: ${getTradeEndpoint()} · лига: ${league}\n— preset: ${preset.id}\n— query: ${JSON.stringify(body.query)}`,
    );
  }
  const ids = list.result.slice(0, limit);
  if (ids.length === 0) return [];

  // Батчим по 10 — лимит GGG fetch (иначе «Invalid query»).
  const results = await fetchInBatches(ids, FETCH_BATCH, (chunk) =>
    requestResults(list.id, chunk, { accountName: config.accountName }),
  );
  return results.map(pricingResultToReference);
}
