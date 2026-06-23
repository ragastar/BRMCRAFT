// Слой 3 (переосмысленный): «шаблон базы» из частоты модов + достижимого тира.
// БЕЗ опоры на цену листингов — в poe2-трейде цена шум (большинство выставлено
// по номиналу). Надёжный сигнал — какие моды и на каком тире реально бывают.

export type AffixType = "prefix" | "suffix";

export interface TemplateMod {
  shape: string;
  tier: number | null;
}
export interface RefItem {
  mods: TemplateMod[];
}

export interface TemplateEntry {
  shape: string;
  count: number;
  pct: number;
  bestTier: number | null;
}
export interface ItemTemplate {
  sampled: number;
  entries: TemplateEntry[];
}

export interface MyMod {
  shape: string;
  tier: number | null;
  affix: AffixType;
}

export interface TemplateRow extends TemplateEntry {
  mine: boolean;
  myTier: number | null;
}
export interface Recommendations {
  template: TemplateRow[];
  improve: Array<{ shape: string; myTier: number; bestTier: number; pct: number }>;
  add: TemplateEntry[];
}

// "P9" → 9, "S5" → 5, "P9 + S5" (гибрид) → 9 (первый тир). "" → null.
export function parseTier(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export function buildTemplate(refs: RefItem[]): ItemTemplate {
  const sampled = refs.length;
  const agg = new Map<string, { count: number; bestTier: number | null }>();
  for (const ref of refs) {
    const seen = new Set<string>();
    for (const m of ref.mods) {
      if (seen.has(m.shape)) {
        // тот же мод в листинге — обновим лучший тир, но не считаем повторно
        const cur = agg.get(m.shape)!;
        if (m.tier != null && (cur.bestTier == null || m.tier < cur.bestTier)) {
          cur.bestTier = m.tier;
        }
        continue;
      }
      seen.add(m.shape);
      const cur = agg.get(m.shape) ?? { count: 0, bestTier: null };
      cur.count++;
      if (m.tier != null && (cur.bestTier == null || m.tier < cur.bestTier)) {
        cur.bestTier = m.tier;
      }
      agg.set(m.shape, cur);
    }
  }
  const entries: TemplateEntry[] = [...agg.entries()]
    .map(([shape, v]) => ({
      shape,
      count: v.count,
      pct: sampled ? Math.round((v.count / sampled) * 100) : 0,
      bestTier: v.bestTier,
    }))
    .sort((a, b) => b.count - a.count);
  return { sampled, entries };
}

export function recommend(
  template: ItemTemplate,
  myMods: MyMod[],
): Recommendations {
  const myByShape = new Map(myMods.map((m) => [m.shape, m]));

  const rows: TemplateRow[] = template.entries.map((e) => {
    const mine = myByShape.get(e.shape);
    return { ...e, mine: !!mine, myTier: mine?.tier ?? null };
  });

  const improve = rows
    .filter(
      (r) =>
        r.mine &&
        r.myTier != null &&
        r.bestTier != null &&
        r.myTier > r.bestTier,
    )
    .map((r) => ({
      shape: r.shape,
      myTier: r.myTier as number,
      bestTier: r.bestTier as number,
      pct: r.pct,
    }));

  const add = template.entries.filter((e) => !myByShape.has(e.shape));

  return { template: rows, improve, add };
}
