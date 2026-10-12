import { Anthropic, type BotStreamClient } from "@repo/dnx-bot";
import { readBotConfig } from "./config";

let client: Anthropic | null = null;
let clientKey: string | null = null;

export function getAnthropicClient(): BotStreamClient {
  const key = readBotConfig().anthropicApiKey;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY");
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 45_000 });
    clientKey = key;
  }
  return client as unknown as BotStreamClient;
}
