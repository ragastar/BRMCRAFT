// Нормализация строки стата к «форме» без чисел, чтобы сравнивать моды из
// текста игры и из API trade2 как одно и то же. Чистит GGG-разметку [Ref|Display].

export function normalizeStatLine(line: string): string {
  return line
    .replace(/\[[^\]|]*\|([^\]]+)\]/g, "$1") // [Ref|Display] → Display
    .replace(/\[([^\]]+)\]/g, "$1") // [X] → X
    .replace(/[+-]?\d+(?:\.\d+)?/g, "#")
    .trim();
}
