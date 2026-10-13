export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }; // USD por millón

// Precios del 25/09/2026 (skill claude-api). Escritura de caché = 1,25 × entrada.
export const MODEL_PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};
const MOST_EXPENSIVE = MODEL_PRICES["claude-opus-5-5"]!;

/** Costo en millonésimas de dólar (entero). */
export function costMicroUsd(model: string, u: TokenUsage): number {
  const p = MODEL_PRICES[model] ?? MOST_EXPENSIVE;
  const usd =
    u.input_tokens * p.input +
    u.output_tokens * p.output +
    (u.cache_read_input_tokens ?? 0) * p.cacheRead +
    (u.cache_creation_input_tokens ?? 0) * p.cacheWrite;
  return Math.round(usd); // tokens × USD/M = micro-USD
}
