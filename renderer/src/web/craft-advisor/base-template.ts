// Слой 3 (переосмысленный): «шаблон базы» из частоты модов + достижимого тира.
// БЕЗ опоры на цену листингов — в poe2-трейде цена шум (большинство выставлено
// по номиналу). Надёжный сигнал — какие моды и на каком тире реально бывают.

export type AffixType = "prefix" | "suffix" | "implicit";

export interface TemplateMod {
  shape: string;
  tier: number | null;
  affix?: AffixType | null;
}
export interface RefItem {
  mods: TemplateMod[];
}

export interface TemplateEntry {
  shape: string;
  count: number;
  pct: number;
  bestTier: number | null;
  affix: AffixType | null; // преф/суфф по большинству голосов из листингов
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
export interface AddEntry extends TemplateEntry {
  slotFree?: boolean; // есть ли свободный слот под этот affix (если переданы freeSlots)
}
export interface Recommendations {
  template: TemplateRow[];
  improve: Array<{ shape: string; myTier: number; bestTier: number; pct: number }>;
  add: AddEntry[];
}

// "P9" → 9, "S5" → 5, "P9 + S5" (гибрид) → 9 (первый тир). "" → null.
export function parseTier(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Буква тира API: "P…" → prefix, "S…" → suffix, иначе null.
export function parseAffix(s: string | undefined | null): AffixType | null {
  if (!s) return null;
  const c = String(s)[0];
  return c === "P" ? "prefix" : c === "S" ? "suffix" : null;
}

interface Agg {
  count: number;
  bestTier: number | null;
  prefix: number;
  suffix: number;
}

export function buildTemplate(refs: RefItem[]): ItemTemplate {
  const sampled = refs.length;
  const agg = new Map<string, Agg>();
  for (const ref of refs) {
    const seen = new Set<string>();
    for (const m of ref.mods) {
      const cur = agg.get(m.shape) ?? { count: 0, bestTier: null, prefix: 0, suffix: 0 };
      if (!seen.has(m.shape)) {
        seen.add(m.shape);
        cur.count++;
        if (m.affix === "prefix") cur.prefix++;
        else if (m.affix === "suffix") cur.suffix++;
      }
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
      affix:
        v.prefix === 0 && v.suffix === 0
          ? null
          : v.prefix >= v.suffix
            ? ("prefix" as AffixType)
            : ("suffix" as AffixType),
    }))
    .sort((a, b) => b.count - a.count);
  return { sampled, entries };
}

export function recommend(
  template: ItemTemplate,
  myMods: MyMod[],
  freeSlots?: { prefix: number; suffix: number },
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

  const add: AddEntry[] = template.entries
    .filter((e) => !myByShape.has(e.shape))
    .map((e) => {
      if (!freeSlots) return { ...e };
      const slotFree =
        e.affix === "prefix"
          ? freeSlots.prefix > 0
          : e.affix === "suffix"
            ? freeSlots.suffix > 0
            : undefined;
      return { ...e, slotFree };
    });

  return { template: rows, improve, add };
}
