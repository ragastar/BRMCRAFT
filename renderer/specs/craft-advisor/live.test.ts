import { describe, it, beforeAll, expect } from "vitest";
import { writeFileSync } from "fs";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";
import { buildReferenceOpts, pricingResultToReference, fetchInBatches } from "@/web/craft-advisor/trade-reference";
import { diffReference } from "@/web/craft-advisor/diff";
import { describeItemMods } from "@/web/craft-advisor/item-mods";
import { LIVE_ITEMS } from "./live-items";

// Настоящий node fetch (до того как setupTests подменит global.fetch на файловый мок)
const realHttpFetch = globalThis.fetch.bind(globalThis);
const PROXY = "http://127.0.0.1:8584/proxy/www.pathofexile.com";
const OUT = "specs/craft-advisor/_live-out.json";

const LIVE = !!process.env.CRAFT_LIVE;
const pcDefaults = {
  collapseListings: "api" as const,
  activateStockFilter: false,
  searchStatRange: 10,
  defaultAllSelected: false,
  autoFillEmptyRuneSockets: false as const,
};

async function pickLeague(): Promise<string> {
  const r = await realHttpFetch(`${PROXY}/api/trade2/data/leagues`);
  const d = (await r.json()) as { result: Array<{ id: string }> };
  // первая не-HC poe2 лига
  return d.result.find((l) => !/^HC|Hardcore/.test(l.id))?.id ?? d.result[0].id;
}

describe.skipIf(!LIVE)("LIVE harness — весь конвейер на живой сессии (CRAFT_LIVE=1)", () => {
  const report: any = { items: {} };

  beforeAll(async () => {
    setupTests({ language: "en", realm: "pc-ggg", preferredTradeSite: "default" });
    await init("en");
    report.league = await pickLeague();
  });

  for (const [name, rawText] of Object.entries(LIVE_ITEMS)) {
    it(`pipeline: ${name}`, async () => {
      const out: any = { name };
      report.items[name] = out;
      try {
        const item = parseClipboard(rawText)._unsafeUnwrap();
        out.base = item.info.refName;
        out.category = item.category;
        out.mods = describeItemMods(rawText);

        const opts = buildReferenceOpts(
          { language: "en", realm: "pc-ggg", preferredTradeSite: "default" },
          pcDefaults,
          report.league,
        );
        const { presets, active } = createPresets(item, opts);
        const preset = presets.find((p) => p.id === active) ?? presets[0];
        out.presetId = preset.id;

        const body = createTradeRequest(preset.filters, [], item);
        out.query = body.query;

        // РЕАЛЬНЫЙ поиск через прокси (живая сессия)
        const sres = await realHttpFetch(
          `${PROXY}/api/trade2/search/${encodeURIComponent(report.league)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body),
          },
        );
        const sjson: any = await sres.json();
        if (sjson.error) {
          out.searchError = sjson.error;
          writeFileSync(OUT, JSON.stringify(report, null, 2));
          expect(sjson.error, `GGG отверг запрос: ${JSON.stringify(sjson.error)}`).toBeUndefined();
          return;
        }
        out.total = sjson.total ?? sjson.result?.length;
        out.queryId = sjson.id;

        // сырой API mod → строка (объект {description} ИЛИ строка)
        const modText = (m: any): string =>
          typeof m === "string" ? m : (m?.description ?? "");

        const ids: string[] = (sjson.result ?? []).slice(0, 20);
        if (ids.length) {
          const results: any[] = await fetchInBatches(ids, 10, async (chunk) => {
            const fres = await realHttpFetch(
              `${PROXY}/api/trade2/fetch/${chunk.join(",")}?query=${sjson.id}`,
            );
            const fjson: any = await fres.json();
            if (fjson.error) {
              out.fetchError = fjson.error;
              return [];
            }
            return (fjson.result ?? []).filter(Boolean);
          });
          const refs = results.map((r: any) =>
            pricingResultToReference({
              priceAmount: r.listing?.price?.amount,
              priceCurrency: r.listing?.price?.currency,
              displayItem: {
                explicitMods: (r.item?.explicitMods ?? []).map((m: any) => ({ text: modText(m) })),
                implicitMods: (r.item?.implicitMods ?? []).map((m: any) => ({ text: modText(m) })),
              },
            } as any),
          );
          out.referenceCount = refs.length;
          out.sampleRefs = refs.slice(0, 3);
          out.diff = diffReference(out.mods, refs);
        }
      } catch (e) {
        out.exception = (e as Error).message;
      }
      writeFileSync(OUT, JSON.stringify(report, null, 2));
    });
  }
});
