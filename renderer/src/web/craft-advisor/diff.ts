// Слой 3 — diff против эталонных листингов trade2. Детерминированно.
// «Форма» стата = строка без чисел, чтобы сравнивать «Adds 5 to 82 ...» и
// «Adds 40 to 90 ...» как один и тот же мод.

export interface ReferenceListing {
  price: number;
  currency: string;
  modLines: string[];
}

export interface MyMod {
  affix: "prefix" | "suffix";
  lines: string[];
}

export interface DiffResult {
  keep: string[]; // формы твоих модов, которые есть и у дорогих
  missing: Array<{ shape: string; count: number }>; // частые у эталонов, нет у тебя
}

export function normalizeStatLine(line: string): string {
  return line.replace(/[+-]?\d+(?:\.\d+)?/g, "#").trim();
}

export function diffReference(
  myMods: MyMod[],
  references: ReferenceListing[],
): DiffResult {
  const myShapes = new Set(
    myMods.flatMap((m) => m.lines).map(normalizeStatLine),
  );

  // частота форм по эталонам
  const refFreq = new Map<string, number>();
  for (const ref of references) {
    const seen = new Set(ref.modLines.map(normalizeStatLine));
    for (const shape of seen) {
      refFreq.set(shape, (refFreq.get(shape) ?? 0) + 1);
    }
  }

  const keep = [...myShapes].filter((s) => refFreq.has(s));

  const missing = [...refFreq.entries()]
    .filter(([shape]) => !myShapes.has(shape))
    .map(([shape, count]) => ({ shape, count }))
    .sort((a, b) => b.count - a.count);

  return { keep, missing };
}
