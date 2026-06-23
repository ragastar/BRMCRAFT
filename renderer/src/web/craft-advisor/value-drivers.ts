import { normalizeStatLine, type ReferenceListing } from "./diff";

// Слой 3 (value-driver): какой мод коррелирует с ценой. Эталонные листинги
// приходят упорядоченными дешёвые→дорогие (trade2 сорт по нормализованной
// цене), поэтому позиция = прокси цены — конвертация валют не нужна.
// Драйвер = мод, который заметно чаще встречается у дорогой половины.

export interface ValueDriver {
  shape: string;
  lift: number; // (частота у дорогих) − (частота у дешёвых)
  expCount: number;
  cheapCount: number;
  mine: boolean;
}

export interface ValueDriversResult {
  drivers: ValueDriver[];
  missing: ValueDriver[]; // драйверы, которых у тебя нет → что докрутить
  keep: ValueDriver[]; // драйверы, которые у тебя есть → ценные, не трогать
}

// Отсев скам/плейсхолдер листингов (напр. «99999999 mirror»). Валюто-агностично:
// ни один настоящий листинг не стоит 10000+ единиц любой валюты.
const PLACEHOLDER_THRESHOLD = 10000;
export function isPlausiblePrice(amount: number, _currency: string): boolean {
  return typeof amount === "number" && amount > 0 && amount < PLACEHOLDER_THRESHOLD;
}

// Равномерная выборка n элементов по всему диапазону (с концами).
export function sampleSpread<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (arr.length - 1)) / (n - 1));
    out.push(arr[idx]);
  }
  return out;
}

function shapesOf(ref: ReferenceListing): Set<string> {
  return new Set(ref.modLines.map(normalizeStatLine).filter((s) => s.length > 0));
}

export function valueDrivers(
  refs: ReferenceListing[],
  myShapes: Set<string>,
): ValueDriversResult {
  if (refs.length === 0) return { drivers: [], missing: [], keep: [] };

  const mid = Math.floor(refs.length / 2);
  const cheap = refs.slice(0, mid).map(shapesOf);
  const expensive = refs.slice(mid).map(shapesOf);

  const allShapes = new Set<string>();
  for (const s of [...cheap, ...expensive]) s.forEach((x) => allShapes.add(x));

  const countIn = (sets: Set<string>[], shape: string) =>
    sets.reduce((n, s) => n + (s.has(shape) ? 1 : 0), 0);

  const drivers: ValueDriver[] = [];
  for (const shape of allShapes) {
    const expCount = countIn(expensive, shape);
    const cheapCount = countIn(cheap, shape);
    const lift = expCount - cheapCount;
    if (lift > 0) {
      drivers.push({ shape, lift, expCount, cheapCount, mine: myShapes.has(shape) });
    }
  }
  drivers.sort((a, b) => b.lift - a.lift || b.expCount - a.expCount);

  return {
    drivers,
    missing: drivers.filter((d) => !d.mine),
    keep: drivers.filter((d) => d.mine),
  };
}
