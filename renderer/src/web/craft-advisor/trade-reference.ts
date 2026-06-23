import type { ParsedItem } from "@/parser";
import {
  createTradeRequest,
  requestTradeResultList,
  requestResults,
  type PricingResult,
} from "@/web/price-check/trade/pathofexile-trade";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { sampleSpread, isPlausiblePrice } from "./value-drivers";
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
): Promise<ReferenceListing[]> {
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

  // Поиск по базе без жёстких стат-фильтров. trade2 отдаёт максимум 100 ids,
  // отсортированных по нормализованной цене, и обрезает выдачу. Поэтому:
  //  - asc → дешёвый конец (реальные дешёвые предметы),
  //  - desc → дорогой конец (но сверху скам «99999999 mirror» — отсеиваем).
  // Объединяем дёшево→дорого: для value-driver нужен контраст цен.
  const bodyAsc = createTradeRequest(preset.filters, [], item);
  // trade2 принимает price:"desc" (тип EE2 сужен до "asc" — каст безопасен)
  const bodyDesc = {
    ...bodyAsc,
    sort: { price: "desc" },
  } as unknown as typeof bodyAsc;

  let listAsc, listDesc;
  try {
    listAsc = await requestTradeResultList(bodyAsc, league);
    listDesc = await requestTradeResultList(bodyDesc, league);
  } catch (e) {
    throw new Error(
      `${(e as Error).message}\n\n— endpoint: ${getTradeEndpoint()} · лига: ${league}\n— preset: ${preset.id}\n— query: ${JSON.stringify(bodyAsc.query)}`,
    );
  }

  const CHEAP_N = 10;
  const EXP_FETCH = 20;
  const EXP_KEEP = 10;

  // дешёвый конец
  const cheapIds = sampleSpread(listAsc.result, CHEAP_N);
  const cheapResults = await fetchInBatches(cheapIds, FETCH_BATCH, (chunk) =>
    requestResults(listAsc.id, chunk, { accountName: config.accountName }),
  );

  // дорогой конец (отсев скама по сумме)
  const expIds = (listDesc.result ?? []).slice(0, EXP_FETCH);
  const expResultsRaw = await fetchInBatches(expIds, FETCH_BATCH, (chunk) =>
    requestResults(listDesc.id, chunk, { accountName: config.accountName }),
  );
  const expResults = expResultsRaw
    .filter((r) => isPlausiblePrice(r.priceAmount, r.priceCurrency))
    .slice(0, EXP_KEEP);

  // дёшево→дорого: cheap (asc) + expensive (desc развёрнут: дешёвые→дорогие)
  return [
    ...cheapResults.map(pricingResultToReference),
    ...expResults.reverse().map(pricingResultToReference),
  ];
}
