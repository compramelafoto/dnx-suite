import type {
  TelegramInlineKeyboard,
  TelegramOutboundMessage,
} from "../domain/models.js";

export type TelegramApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; status?: number; description: string; retryAfterSeconds?: number };

export type TelegramGetUpdatesParams = {
  offset?: number;
  timeout?: number;
  limit?: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; is_bot?: boolean };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
    };
  };
};

export type TelegramApiClientOptions = {
  botToken: string;
  /** Tests: fetch inyectable. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

/**
 * Cliente mínimo Bot API vía HTTPS saliente (sin webhook, sin libs).
 */
export class TelegramApiClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: TelegramApiClientOptions) {
    this.token = options.botToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.telegram.org";
  }

  private url(method: string): string {
    return `${this.baseUrl}/bot${this.token}/${method}`;
  }

  async getMe(): Promise<TelegramApiResult<{ id: number; username?: string }>> {
    return this.call("getMe");
  }

  async getUpdates(
    params: TelegramGetUpdatesParams = {},
  ): Promise<TelegramApiResult<TelegramUpdate[]>> {
    return this.call("getUpdates", {
      offset: params.offset,
      timeout: params.timeout ?? 25,
      limit: params.limit ?? 50,
      allowed_updates: ["message", "callback_query"],
    });
  }

  async sendMessage(
    outbound: TelegramOutboundMessage,
  ): Promise<TelegramApiResult<{ message_id: number }>> {
    const body: Record<string, unknown> = {
      chat_id: outbound.chatId,
      text: outbound.text,
      disable_web_page_preview: true,
    };
    if (outbound.parseMode) body.parse_mode = outbound.parseMode;
    if (outbound.replyMarkup) {
      body.reply_markup = {
        inline_keyboard: outbound.replyMarkup.inlineKeyboard.map((row) =>
          row.map((b) => ({ text: b.text, callback_data: b.callbackData })),
        ),
      };
    }
    return this.call("sendMessage", body);
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<TelegramApiResult<true>> {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  private async call<T>(
    method: string,
    body?: Record<string, unknown>,
  ): Promise<TelegramApiResult<T>> {
    try {
      const res = await this.fetchImpl(this.url(method), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const retryAfterHeader = res.headers.get("retry-after");
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: T;
        description?: string;
        parameters?: { retry_after?: number };
      };

      if (res.status === 429 || json.parameters?.retry_after) {
        return {
          ok: false,
          status: 429,
          description: json.description ?? "Too Many Requests",
          retryAfterSeconds:
            json.parameters?.retry_after ??
            (retryAfterHeader ? Number(retryAfterHeader) : 5),
        };
      }

      if (!res.ok || json.ok === false) {
        return {
          ok: false,
          status: res.status,
          description: json.description ?? `HTTP ${res.status}`,
        };
      }

      return { ok: true, result: json.result as T };
    } catch (err) {
      const message = err instanceof Error ? err.message : "network_error";
      return { ok: false, description: message };
    }
  }
}

export function keyboardFromButtons(
  buttons: Array<{ text: string; callbackData: string }>,
  columns = 2,
): TelegramInlineKeyboard {
  const rows: TelegramInlineKeyboard["inlineKeyboard"] = [];
  for (let i = 0; i < buttons.length; i += columns) {
    rows.push(buttons.slice(i, i + columns));
  }
  return { inlineKeyboard: rows };
}
