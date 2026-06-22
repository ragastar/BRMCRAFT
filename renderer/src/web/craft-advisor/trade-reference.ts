import type { ParsedItem } from "@/parser";
import {
  createTradeRequest,
  requestTradeResultList,
  requestResults,
  type PricingResult,
} from "@/web/price-check/trade/pathofexile-trade";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { useLeagues } from "@/web/background/Leagues";
import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/interfaces";
import type { ReferenceListing } from "./diff";

// Слой 2 — эталонный поиск trade2. Чистый конвертер тестируется; сетевой
// fetchReference переиспользует пайплайн EE2 (createPresets → createTradeRequest
// → requestTradeResultList → requestResults), лимиты/кеш — внутри них.

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

  const { presets, active } = createPresets(item, {
    league,
    currency: pc.coreCurrency,
    listingType: "securable",
    collapseListings: pc.collapseListings,
    activateStockFilter: pc.activateStockFilter,
    searchStatRange: pc.searchStatRange,
    useEn: config.language === "en",
    defaultAllSelected: pc.defaultAllSelected,
    autoFillEmptyAugmentSockets: pc.autoFillEmptyRuneSockets,
  });
  const preset = presets.find((p) => p.id === active) ?? presets[0];
  if (!preset) throw new Error("Не удалось построить фильтры для предмета.");

  // «Часть твоих свойств»: ищем по базе (без жёстких стат-фильтров), затем
  // diff покажет общие/недостающие моды. Эталон по дорогому концу — тюним живьём.
  const body = createTradeRequest(preset.filters, [], item);
  const list = await requestTradeResultList(body, league);
  const ids = list.result.slice(0, limit);
  if (ids.length === 0) return [];

  const results = await requestResults(list.id, ids, {
    accountName: config.accountName,
  });
  return results.map(pricingResultToReference);
}
