// Сигнатура предмета для ключа кеша/истории цен (PRD раздел 5):
// база + моды + лига. Стабильна и не зависит от порядка модов.

export interface SignatureMod {
  name?: string;
  tier?: number;
}

export interface SignatureInput {
  base: string;
  league: string;
  mods: SignatureMod[];
}

export function signatureFor(input: SignatureInput): string {
  const mods = input.mods
    .map((m) => `${m.name ?? "?"}:${m.tier ?? "?"}`)
    .sort()
    .join(",");
  return `${input.league}|${input.base}|${mods}`;
}
