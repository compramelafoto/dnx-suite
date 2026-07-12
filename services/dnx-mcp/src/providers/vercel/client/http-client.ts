import type { VercelConfig } from "../config.js";
import {
  VercelApiError,
  VercelAuthError,
  VercelNotFoundError,
  VercelRateLimitError,
} from "../errors.js";
import { RateLimiter } from "./rate-limiter.js";
import { RetryableRequestError, parseRetryAfterMs, withRetry, type RetryOptions } from "./retry.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface VercelHttpClientOptions {
  config: VercelConfig;
  fetchImpl?: typeof fetch;
  rateLimiter?: RateLimiter;
  retry?: Partial<RetryOptions>;
}

interface VercelErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export class VercelHttpClient {
  private readonly config: VercelConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly rateLimiter: RateLimiter;
  private readonly retryOptions: RetryOptions;

  constructor(options: VercelHttpClientOptions) {
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

  get teamId(): string | undefined {
    return this.config.teamId;
  }

  get teamSlug(): string | undefined {
    return this.config.teamSlug;
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    return withRetry(async () => {
      await this.rateLimiter.acquire();
      return this.executeRequest<T>(method, path, options);
    }, this.retryOptions);
  }

  async get<T>(path: string, options?: Omit<RequestOptions, "body">): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, options);
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
      Authorization: `Bearer ${this.config.token}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url, init);

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    }

    throw await this.createError(response);
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {},
  ): string {
    const url = new URL(path.startsWith("http") ? path : `${this.config.baseUrl}${path}`);

    const mergedQuery: Record<string, string | number | boolean | undefined> = {
      ...query,
    };

    if (this.config.teamId) {
      mergedQuery.teamId = this.config.teamId;
    } else if (this.config.teamSlug) {
      mergedQuery.slug = this.config.teamSlug;
    }

    for (const [key, value] of Object.entries(mergedQuery)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private async createError(response: Response): Promise<Error> {
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    let body: unknown;
    let code: string | undefined;
    let message = `Vercel API error (${String(response.status)})`;

    try {
      body = await response.json();
      const parsed = body as VercelErrorBody;
      code = parsed.error?.code;
      message = parsed.error?.message ?? parsed.message ?? message;
    } catch {
      body = undefined;
    }

    if (response.status === 401 || response.status === 403) {
      return new VercelAuthError(message);
    }

    if (response.status === 404) {
      return new VercelNotFoundError("Recurso", message);
    }

    if (response.status === 429) {
      if (retryAfterMs !== null) {
        return new RetryableRequestError(response.status, message, retryAfterMs);
      }
      return new VercelRateLimitError(60_000, message);
    }

    if (response.status >= 500) {
      return new RetryableRequestError(response.status, message, retryAfterMs ?? undefined);
    }

    return new VercelApiError(response.status, code, message, body);
  }
}
