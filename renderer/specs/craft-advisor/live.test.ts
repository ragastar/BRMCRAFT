import { describe, it, beforeAll, expect } from "vitest";
import { writeFileSync } from "fs";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";
import { buildReferenceOpts, fetchInBatches } from "@/web/craft-advisor/trade-reference";
import { normalizeStatLine } from "@/web/craft-advisor/diff";
import { buildTemplate, recommend, parseTier, type RefItem, type MyMod } from "@/web/craft-advisor/base-template";
import { describeItemMods } from "@/web/craft-advisor/item-mods";
import { LIVE_ITEMS } from "./live-items";

const realHttpFetch = globalThis.fetch.bind(globalThis);
const PROXY = "http://127.0.0.1:8584/proxy/www.pathofexile.com";
const OUT = "specs/craft-advisor/_live-out.json";
const LIVE = !!process.env.CRAFT_LIVE;
const pcDefaults = {
  collapseListings: "api" as const, activateStockFilter: false, searchStatRange: 10,
  defaultAllSelected: false, autoFillEmptyRuneSockets: false as const,
};

async function pickLeague(): Promise<string> {
  const r = await realHttpFetch(`${PROXY}/api/trade2/data/leagues`);
  const d = (await r.json()) as { result: Array<{ id: string }> };
  return d.result.find((l) => !/^HC|Hardcore/.test(l.id))?.id ?? d.result[0].id;
}

describe.skipIf(!LIVE)("LIVE harness — шаблон базы по сравнимым кольцам (CRAFT_LIVE=1)", () => {
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
        const mods = describeItemMods(rawText);
        const myMods: MyMod[] = mods.flatMap((m) =>
          m.lines.map((l) => ({ shape: normalizeStatLine(l), tier: m.tier ?? null, affix: m.affix })),
        );
        out.myMods = myMods;

        const { presets, active } = createPresets(item, buildReferenceOpts(
          { language: "en", realm: "pc-ggg", preferredTradeSite: "default" }, pcDefaults, report.league,
        ));
        const preset = presets.find((p) => p.id === active) ?? presets[0];
        const body: any = createTradeRequest(preset.filters, [], item);
        const statIds = (preset.stats ?? []).map((s: any) => s.tradeId?.[0]).filter((id: string) => id && /^(explicit|implicit|pseudo)\./.test(id));
        if (statIds.length >= 2) {
          body.query.stats = [{ type: "count", value: { min: 2 }, filters: statIds.map((id: string) => ({ id })) }];
        }
        out.statIds = statIds;

        const sres = await realHttpFetch(`${PROXY}/api/trade2/search/${encodeURIComponent(report.league)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const sjson: any = await sres.json();
        if (sjson.error) { out.searchError = sjson.error; writeFileSync(OUT, JSON.stringify(report, null, 1)); expect(sjson.error).toBeUndefined(); return; }
        out.total = sjson.total;

        const ids: string[] = (sjson.result ?? []).slice(0, 40);
        const raw: any[] = await fetchInBatches(ids, 10, async (chunk) => {
          const fr = await realHttpFetch(`${PROXY}/api/trade2/fetch/${chunk.join(",")}?query=${sjson.id}`);
          const fj: any = await fr.json();
          return (fj.result ?? []).filter(Boolean);
        });
        const refs: RefItem[] = raw.map((r) => ({
          mods: [...(r.item?.explicitMods ?? []), ...(r.item?.implicitMods ?? [])].map((m: any) => {
            const desc = typeof m === "string" ? m : m?.description ?? "";
            const tier = typeof m === "object" ? parseTier(m?.mods?.[0]?.tier) : null;
            return { shape: normalizeStatLine(desc), tier };
          }).filter((m: any) => m.shape),
        }));
        out.sampled = refs.length;
        out.recs = recommend(buildTemplate(refs), myMods);
      } catch (e) { out.exception = (e as Error).message; }
      writeFileSync(OUT, JSON.stringify(report, null, 1));
    });
  }
});
