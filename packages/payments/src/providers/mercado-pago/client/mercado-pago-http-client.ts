import { PaymentProviderTemporaryError } from "../../../errors/provider-errors";
import {
  assertSandboxToken,
  assertSandboxWriteAllowed,
  MP_API_BASE_URL,
  type MercadoPagoProviderConfig,
} from "./mercado-pago-environment";
import { isRetryableStatus, mapMercadoPagoHttpError } from "../errors/error-mapper";
import type { MercadoPagoRequestOptions } from "./mercado-pago-request";
import { parseRfc7807, type ParsedMpResponse } from "./mercado-pago-response";
import type { MercadoPagoErrorBody } from "../errors/mercado-pago-error";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const BASE_BACKOFF_MS = 100;

export type FetchImpl = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: MercadoPagoRequestOptions["query"],
): string {
  const base = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;
  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function sanitizeErrorContext(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower.includes("token")) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/TEST-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/APP_USR-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Authorization:\s*\S+/gi, "Authorization: [REDACTED]");
}

async function parseJsonBody(rawText: string): Promise<unknown> {
  if (!rawText.trim()) return null;
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MercadoPagoHttpClient {
  private readonly config: MercadoPagoProviderConfig;
  private readonly fetchImpl: FetchImpl;

  constructor(config: MercadoPagoProviderConfig, fetchImpl: FetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  getConfig(): MercadoPagoProviderConfig {
    return this.config;
  }

  async request<T>(opts: MercadoPagoRequestOptions): Promise<ParsedMpResponse<T>> {
    if (WRITE_METHODS.has(opts.method)) {
      assertSandboxWriteAllowed(this.config);
      assertSandboxToken(this.config);
    }

    let lastError: Error | null = null;
    const maxAttempts = this.config.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.executeOnce<T>(opts);
        if (result.status >= 200 && result.status < 300) {
          return result;
        }

        const body = isRecord(result.body) ? (result.body as MercadoPagoErrorBody) : null;
        const mapped = mapMercadoPagoHttpError(result.status, result.problem, body);

        if (!isRetryableStatus(result.status) || attempt >= maxAttempts - 1) {
          throw mapped;
        }
        lastError = mapped;
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
      } catch (err) {
        if (err instanceof PaymentProviderTemporaryError && attempt < maxAttempts - 1) {
          lastError = err;
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        if (err instanceof TypeError && attempt < maxAttempts - 1) {
          lastError = new PaymentProviderTemporaryError(
            sanitizeErrorMessage(`Network error: ${err.message}`),
          );
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          const timeoutErr = new PaymentProviderTemporaryError(
            `Mercado Pago request timed out after ${this.config.requestTimeoutMs}ms`,
            408,
          );
          if (attempt < maxAttempts - 1) {
            lastError = timeoutErr;
            await sleep(BASE_BACKOFF_MS * 2 ** attempt);
            continue;
          }
          throw timeoutErr;
        }
        throw err;
      }
    }

    throw lastError ?? new PaymentProviderTemporaryError("Mercado Pago request failed after retries");
  }

  private async executeOnce<T>(opts: MercadoPagoRequestOptions): Promise<ParsedMpResponse<T>> {
    const correlationId = opts.correlationId ?? crypto.randomUUID();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": `dnx-payments-mp/0.1${this.config.platformId ? ` (${this.config.platformId})` : ""}`,
      "X-Correlation-Id": correlationId,
      ...opts.headers,
    };

    if (this.config.environment === "sandbox") {
      headers["x-test-token"] = "true";
    }

    if (opts.idempotencyKey) {
      headers["X-Idempotency-Key"] = opts.idempotencyKey;
    }

    const url = buildUrl(this.config.baseUrl || MP_API_BASE_URL, opts.path, opts.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const init: RequestInit = {
        method: opts.method,
        headers,
        signal: controller.signal,
      };

      if (opts.body !== undefined && opts.method !== "GET") {
        init.body = JSON.stringify(opts.body);
      }

      const response = await this.fetchImpl(url, init);
      const rawText = await response.text();
      const parsed = await parseJsonBody(rawText);
      const problem = parseRfc7807(parsed);

      if (!response.ok) {
        void sanitizeErrorContext(headers);
      }

      return {
        status: response.status,
        headers: response.headers,
        body: parsed as T | null,
        rawText,
        problem,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
