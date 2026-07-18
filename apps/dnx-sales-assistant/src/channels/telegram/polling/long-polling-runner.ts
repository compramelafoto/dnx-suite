import type { TelegramApiClient } from "../bot/telegram-api-client.js";
import type { TelegramInboundMessage, TelegramOutboundMessage } from "../domain/models.js";
import { mapTelegramUpdate } from "../mapping/map-update.js";
import type { TelegramLocalStore } from "../persistence/telegram-local-store.js";
import type { TelegramChannelHandler } from "../session/telegram-channel-handler.js";
import {
  initialBackoff,
  nextBackoffMs,
  resetBackoff,
  type BackoffState,
} from "./backoff.js";

export type LongPollingRunnerOptions = {
  client: TelegramApiClient;
  handler: TelegramChannelHandler;
  localStore: TelegramLocalStore;
  /** Timeout long poll (segundos). */
  pollTimeoutSeconds?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  /** Tests: máximo ciclos. */
  maxCycles?: number;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Long polling local. Sin webhook, sin puerto entrante.
 */
export class LongPollingRunner {
  private stopped = false;
  private backoff: BackoffState = initialBackoff();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: (message: string) => void;

  constructor(private readonly options: LongPollingRunnerOptions) {
    this.sleep = options.sleep ?? defaultSleep;
    this.log = options.log ?? (() => undefined);
  }

  stop(): void {
    this.stopped = true;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  async run(): Promise<void> {
    this.stopped = false;
    let cycles = 0;
    while (!this.stopped) {
      if (
        this.options.maxCycles !== undefined &&
        cycles >= this.options.maxCycles
      ) {
        break;
      }
      cycles += 1;

      const offset = this.options.localStore.getLastUpdateId() + 1;
      const result = await this.options.client.getUpdates({
        offset,
        timeout: this.options.pollTimeoutSeconds ?? 25,
      });

      if (!result.ok) {
        if (result.status === 401 || result.status === 404) {
          this.log("Token inválido o bot inexistente. Deteniendo.");
          this.stopped = true;
          break;
        }
        const { delayMs, next } = nextBackoffMs(this.backoff, {
          retryAfterSeconds: result.retryAfterSeconds,
        });
        this.backoff = next;
        this.log(`Polling error transitorio; reintento en ${delayMs}ms`);
        await this.sleep(delayMs);
        continue;
      }

      this.backoff = resetBackoff();
      for (const update of result.result) {
        if (this.stopped) break;
        await this.processUpdate(update.update_id, update);
      }
    }
  }

  private async processUpdate(
    updateId: number,
    update: Parameters<typeof mapTelegramUpdate>[0],
  ): Promise<void> {
    if (this.options.localStore.isUpdateProcessed(updateId)) {
      return;
    }

    const inbound = mapTelegramUpdate(update);
    if (!inbound) {
      await this.options.localStore.markUpdateProcessed(updateId);
      return;
    }

    let outbound: TelegramOutboundMessage[] = [];
    try {
      outbound = await this.options.handler.handle(inbound);
    } catch {
      outbound = [
        {
          chatId: inbound.chatId,
          text: "No pude procesar ese mensaje. Probá nuevamente en unos segundos.",
        },
      ];
    }

    for (const message of outbound) {
      await this.options.client.sendMessage(message);
    }

    if (inbound.callbackQueryId) {
      await this.options.client.answerCallbackQuery(inbound.callbackQueryId);
    }

    await this.options.localStore.markUpdateProcessed(updateId);
  }

  /** Procesa un inbound ya mapeado (tests / fake adapter). */
  async processInboundForTest(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    if (this.options.localStore.isUpdateProcessed(inbound.updateId)) {
      return [];
    }
    const outbound = await this.options.handler.handle(inbound);
    await this.options.localStore.markUpdateProcessed(inbound.updateId);
    return outbound;
  }
}
