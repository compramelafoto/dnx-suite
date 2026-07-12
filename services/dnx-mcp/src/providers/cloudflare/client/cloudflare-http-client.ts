import type { CloudflareConfig } from "../config.js";
import {
  CloudflareApiError,
  CloudflareAuthError,
  CloudflareNotFoundError,
  CloudflareRateLimitError,
} from "../errors.js";
import { RateLimiter } from "./rate-limiter.js";
import { RetryableRequestError, parseRetryAfterMs, withRetry, type RetryOptions } from "./retry.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Si true, no serializa body como JSON (raw body). */
  rawBody?: RequestInit["body"];
}

export interface CloudflareHttpClientOptions {
  config: CloudflareConfig;
  fetchImpl?: typeof fetch;
  rateLimiter?: RateLimiter;
  retry?: Partial<RetryOptions>;
}

interface CloudflareErrorBody {
  success?: boolean;
  errors?: Array<{ code?: number | string; message?: string }>;
  messages?: Array<{ code?: number | string; message?: string }>;
  error?: string;
  message?: string;
}

/**
 * Cliente HTTP para la API oficial de Cloudflare (Management API).
 * Nunca loguea el token ni secrets.
 */
export class CloudflareHttpClient {
  private readonly config: CloudflareConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly rateLimiter: RateLimiter;
  private readonly retryOptions: RetryOptions;

  constructor(options: CloudflareHttpClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.rateLimiter =
      options.rateLimiter ??
      new RateLimiter({ requestsPerMinute: options.config.requestsPerMinute });
    this.retryOptions = {
      maxRetries: options.config.maxRetries,
      baseDelayMs: options.config.retryBaseDelayMs,
      ...options.retry,
    };
  }

  get accountId(): string {
    return this.config.accountId;
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      return this.executeRequest<T>(method, path, options);
    }, this.retryOptions);
  }

  async get<T>(path: string, options?: Omit<RequestOptions, "body" | "rawBody">): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  async put<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", path, options);
  }

  async patch<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  private async executeRequest<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      ...options.headers,
    };

    const init: RequestInit = { method, headers };

    if (options.rawBody !== undefined) {
      init.body = options.rawBody;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url, init);

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    }

    throw await this.createError(response);
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): string {
    const url = new URL(path.startsWith("http") ? path : `${this.config.baseUrl}${path}`);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private async createError(response: Response): Promise<Error> {
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    let body: unknown;
    let code: number | string | undefined;
    let message = `Cloudflare API error (${String(response.status)})`;

    try {
      body = await response.json();
      const parsed = body as CloudflareErrorBody;
      const firstError = parsed.errors?.[0];
      code = firstError?.code;
      message = firstError?.message ?? parsed.message ?? parsed.error ?? message;
    } catch {
      body = undefined;
    }

    if (response.status === 401 || response.status === 403) {
      return new CloudflareAuthError(message);
    }

    if (response.status === 404) {
      return new CloudflareNotFoundError("Recurso", message);
    }

    if (response.status === 429) {
      if (retryAfterMs !== null) {
        return new RetryableRequestError(response.status, message, retryAfterMs);
      }
      return new CloudflareRateLimitError(60_000, message);
    }

    if (response.status >= 500) {
      return new RetryableRequestError(response.status, message, retryAfterMs ?? undefined);
    }

    return new CloudflareApiError(response.status, code, message, body);
  }
}
