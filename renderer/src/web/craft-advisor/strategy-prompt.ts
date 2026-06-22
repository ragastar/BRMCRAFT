import type { SlotAnalysis, AffixSlot } from "./layer0";
import type { Candidate } from "./layer1";

// Слой 5 — построение промпта для Claude. Чистая функция, чтобы тестировать
// без сети. Сам вызов API — в strategy-client.ts.

export interface StrategyPromptInput {
  analysis: SlotAnalysis;
  candidates: Candidate[];
  price?: { value: number; currency: string };
}

export interface StrategyPrompt {
  system: string;
  user: string;
}

const SYSTEM = `Ты — эксперт по крафту в Path of Exile 2 (механики версии 0.x).
Игрок даёт распарсенный предмет: базу, iLvl, занятые и свободные слоты префиксов/суффиксов, моды с тирами и кандидатов на улучшение.

Дай короткий практичный план крафта на русском:
1. Что оставить (keep) — какие моды хорошие, не трогать.
2. Что докрутить — какой мод/слот даёт наибольший прирост ценности.
3. Каким методом — эссенция / экзальт / омен / алхимия / база и т.п.
4. С какой вероятностью на попытку — указывай ПРИБЛИЗИТЕЛЬНУЮ оценку (механики свежие, точных весов нет), помечай как ориентир.

Будь конкретным и кратким. Не выдумывай несуществующие моды. Если предмет не стоит крафтить — скажи прямо.`;

function fmtMods(mods: AffixSlot[]): string {
  if (mods.length === 0) return "—";
  return mods
    .map((m) => `${m.name ?? "?"} (T${m.tier ?? "?"})`)
    .join(", ");
}

export function buildStrategyPrompt(input: StrategyPromptInput): StrategyPrompt {
  const { analysis, candidates, price } = input;

  const lines: string[] = [];
  lines.push(`База: ${analysis.base}`);
  lines.push(`iLvl: ${analysis.itemLevel ?? "?"}`);
  lines.push(`Редкость: ${analysis.rarity ?? "?"}`);
  if (price) {
    lines.push(`Текущая цена: ${price.value} ${price.currency}`);
  }
  lines.push("");
  lines.push(
    `Префиксы: занято ${analysis.prefixes.occupied.length}/${analysis.prefixes.max} (свободно ${analysis.prefixes.free})`,
  );
  lines.push(`  ${fmtMods(analysis.prefixes.occupied)}`);
  lines.push(
    `Суффиксы: занято ${analysis.suffixes.occupied.length}/${analysis.suffixes.max} (свободно ${analysis.suffixes.free})`,
  );
  lines.push(`  ${fmtMods(analysis.suffixes.occupied)}`);
  lines.push("");
  lines.push("Кандидаты на проверку:");
  if (candidates.length === 0) {
    lines.push("  — нет");
  } else {
    for (const c of candidates) {
      lines.push(`  - ${c.reason}`);
    }
  }

  return { system: SYSTEM, user: lines.join("\n") };
}
