// Персистентная история цен по сигнатуре предмета (PRD раздел 5).
// Штатный кеш EE2 живёт в памяти и не копит историю — это наш слой.
// Backend инъектируется: localStorage в проде, Map в тестах.

import { signatureFor, type SignatureInput } from "./signature";

export interface PriceObservation {
  price: number;
  currency: string;
  at: number; // unix ms, передаёт вызывающий
}

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MAX_OBSERVATIONS = 50;

export class PriceHistoryStore {
  private readonly prefix: string;

  constructor(
    private readonly backend: StorageBackend,
    namespace = "craft-advisor:price-history",
  ) {
    this.prefix = `${namespace}:`;
  }

  private key(signature: string): string {
    return this.prefix + signature;
  }

  record(signature: string, obs: PriceObservation): void {
    const list = this.history(signature);
    list.push(obs);
    // оставляем последние MAX_OBSERVATIONS по времени
    list.sort((a, b) => a.at - b.at);
    const trimmed = list.slice(-MAX_OBSERVATIONS);
    this.backend.setItem(this.key(signature), JSON.stringify(trimmed));
  }

  recordFor(input: SignatureInput, obs: PriceObservation): void {
    this.record(signatureFor(input), obs);
  }

  history(signature: string): PriceObservation[] {
    const raw = this.backend.getItem(this.key(signature));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PriceObservation[]) : [];
    } catch {
      return [];
    }
  }

  latest(signature: string): PriceObservation | undefined {
    const list = this.history(signature);
    if (list.length === 0) return undefined;
    return list.reduce((a, b) => (b.at > a.at ? b : a));
  }
}

// Прод-обёртка: localStorage в renderer Electron персистентен на диске
// (userData), переживает перезапуск приложения.
export function createPriceHistoryStore(): PriceHistoryStore {
  return new PriceHistoryStore(window.localStorage);
}
