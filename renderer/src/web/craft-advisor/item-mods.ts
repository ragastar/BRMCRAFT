// Реальные строки свойств предмета СО ЗНАЧЕНИЯМИ (а не названия аффиксов).
// Источник — advanced-формат буфера (rawText) с заголовками вида
// `{ Prefix Modifier "Name" (Tier: N) — tags }` и следующими за ними строками
// статов. Парсер EE2 для added-damage хранит только среднее, поэтому реальную
// пару значений берём из текста. Детерминированно.

export type AffixType = "prefix" | "suffix" | "implicit";

export interface ItemMod {
  affix: AffixType;
  tier?: number;
  name?: string;
  lines: string[]; // строки свойств с реальными значениями
}

const HEADER =
  /^\{ (Prefix|Suffix|Implicit) Modifier(?: "([^"]*)")?(?: \(Tier: (\d+)\))?/;

// "5(1-5)" -> "5", "+57(41-60)" -> "+57": вырезаем крафт-диапазон в скобках
function cleanValues(line: string): string {
  return line.replace(/\((?:\d[\d.]*)-(?:\d[\d.]*)\)/g, "").trim();
}

export function describeItemMods(rawText: string): ItemMod[] {
  const lines = rawText.split(/\r?\n/);
  const mods: ItemMod[] = [];
  let current: ItemMod | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const header = HEADER.exec(line);
    if (header) {
      current = {
        affix: header[1].toLowerCase() as AffixType,
        name: header[2],
        tier: header[3] !== undefined ? Number(header[3]) : undefined,
        lines: [],
      };
      mods.push(current);
      continue;
    }
    if (line.startsWith("{") || /^-{3,}$/.test(line)) {
      // заголовок другого блока или разделитель секции — закрываем текущий
      current = null;
      continue;
    }
    if (current && line.length > 0) {
      current.lines.push(cleanValues(line));
    }
  }

  return mods.filter((m) => m.lines.length > 0);
}
