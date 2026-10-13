import "server-only";
import { Anthropic, type BotStreamClient } from "@repo/dnx-bot";
import { leerConfigBot } from "./config";

/**
 * Cliente de Anthropic de DNX Bot en FOTOFFICE. El SDK viene del paquete (FOTOFFICE no depende de
 * `@anthropic-ai/sdk`). Un reintento y 45 s de espera, como CLF: el tope de gasto manda.
 */
let cliente: Anthropic | null = null;
let claveDelCliente: string | null = null;

export function clienteAnthropic(): BotStreamClient {
  const clave = leerConfigBot().anthropicApiKey;
  if (!clave) throw new Error("Falta ANTHROPIC_API_KEY");
  if (!cliente || claveDelCliente !== clave) {
    cliente = new Anthropic({ apiKey: clave, maxRetries: 1, timeout: 45_000 });
    claveDelCliente = clave;
  }
  return cliente as unknown as BotStreamClient;
}
