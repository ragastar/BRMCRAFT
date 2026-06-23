import type { AffixType } from "./base-template";

// Слой 5 — промпт для Claude поверх ДЕТЕРМИНИРОВАННЫХ рекомендаций. Claude не
// придумывает «что докрутить» (это уже посчитано из шаблона базы), а объясняет
// КАК: метод крафта (эссенция/экзальт/омен/регал/алхимия/аннул) и приблизительную
// вероятность. Чистая функция — тестируется без сети.

export interface StrategyInput {
  base: string;
  itemLevel?: number;
  itemMods: Array<{ affix: AffixType; tier?: number; lines: string[] }>;
  improve: Array<{ shape: string; myTier: number; bestTier: number; pct: number }>;
  add: Array<{
    shape: string;
    pct: number;
    bestTier: number | null;
    affix: AffixType | null;
    slotFree?: boolean;
  }>;
  freeSlots: { prefix: number; suffix: number };
}

export interface StrategyPrompt {
  system: string;
  user: string;
}

const SYSTEM = `Ты — эксперт по крафту в Path of Exile 2 (механики версии 0.x).
Тебе дают предмет, его свойства и УЖЕ ПОСЧИТАННЫЕ рекомендации (что поднять по тиру,
что добавить, и есть ли свободный слot). Твоя задача — НЕ переоценивать что крафтить,
а объяснить КАК это сделать:
1. Метод для каждой рекомендации — эссенция / экзальт / регал / алхимия / омен / аннул / база.
2. Приблизительная вероятность на попытку — помечай как ОЦЕНОЧНУЮ (механики свежие, точных весов нет).
3. Порядок действий, если важен (например, сначала добить свободные префиксы, потом риск с аннулом).

Коротко, по-русски, по пунктам. Не выдумывай несуществующие моды и механики.
Если суффиксы заняты, а нужный мод суффиксный — честно скажи, что нужен своп (аннул/рекомб), и что это риск.`;

function affixRu(a: AffixType | null): string {
  return a === "prefix" ? "префикс" : a === "suffix" ? "суффикс" : "—";
}

export function buildStrategyPrompt(input: StrategyInput): StrategyPrompt {
  const lines: string[] = [];
  lines.push(`Предмет: ${input.base} (iLvl ${input.itemLevel ?? "?"})`);
  lines.push(
    `Свободно слотов: префиксы ${input.freeSlots.prefix}, суффиксы ${input.freeSlots.suffix}`,
  );

  lines.push("");
  lines.push("Свойства:");
  if (input.itemMods.length === 0) lines.push("  —");
  for (const m of input.itemMods) {
    const t = m.tier != null ? ` (T${m.tier})` : "";
    lines.push(`  [${affixRu(m.affix)}${t}] ${m.lines.join("; ")}`);
  }

  lines.push("");
  lines.push("Рекомендации (посчитаны детерминированно по рынку):");
  lines.push("Поднять тир:");
  if (input.improve.length === 0) lines.push("  — нет");
  for (const i of input.improve) {
    lines.push(`  - ${i.shape}: T${i.myTier} → T${i.bestTier} (носят ${i.pct}%)`);
  }
  lines.push("Добавить:");
  if (input.add.length === 0) lines.push("  — нет");
  for (const a of input.add.slice(0, 6)) {
    const tier = a.bestTier != null ? `, до T${a.bestTier}` : "";
    const slot =
      a.slotFree === false
        ? " — нет свободного слота, нужен своп"
        : a.slotFree === true
          ? " — слот свободен"
          : "";
    lines.push(`  - ${a.shape} (${affixRu(a.affix)}, носят ${a.pct}%${tier})${slot}`);
  }

  lines.push("");
  lines.push("Для каждой рекомендации дай метод и приблизительную вероятность.");

  return { system: SYSTEM, user: lines.join("\n") };
}
