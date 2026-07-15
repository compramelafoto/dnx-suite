import type { MercadoPagoRequestOptions } from "../client/mercado-pago-request.js";
import type { ParsedMpResponse } from "../client/mercado-pago-response.js";
import {
  assertSandboxToken,
  assertSandboxWriteAllowed,
  type MercadoPagoProviderConfig,
} from "../client/mercado-pago-environment.js";
import { MercadoPagoHttpClient } from "../client/mercado-pago-http-client.js";

export interface RecordedMpRequest {
  options: MercadoPagoRequestOptions;
  attempt: number;
}

export interface FakeResponseRule {
  match: (opts: MercadoPagoRequestOptions) => boolean;
  response: ParsedMpResponse<unknown>;
  /** Throw on this attempt (1-based) to simulate network errors. */
  throwOnAttempt?: number;
}

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Fake HTTP client for unit tests — enforces the same sandbox write guards as the real client.
 */
export class FakeMercadoPagoHttpClient extends MercadoPagoHttpClient {
  readonly recordedRequests: RecordedMpRequest[] = [];
  private readonly rules: FakeResponseRule[] = [];
  private readonly defaultResponse: ParsedMpResponse<unknown> | null;
  private attemptCounts = new Map<string, number>();
  private readonly fakeConfig: MercadoPagoProviderConfig;

  constructor(
    config: MercadoPagoProviderConfig,
    opts?: {
      defaultResponse?: ParsedMpResponse<unknown> | null;
    },
  ) {
    super(config, async () => new Response("{}", { status: 500 }));
    this.fakeConfig = config;
    this.defaultResponse = opts?.defaultResponse ?? null;
  }

  addRule(rule: FakeResponseRule): void {
    this.rules.push(rule);
  }

  reset(): void {
    this.recordedRequests.length = 0;
    this.rules.length = 0;
    this.attemptCounts.clear();
  }

  override async request<T>(opts: MercadoPagoRequestOptions): Promise<ParsedMpResponse<T>> {
    if (WRITE_METHODS.has(opts.method)) {
      assertSandboxWriteAllowed(this.fakeConfig);
      assertSandboxToken(this.fakeConfig);
    }

    const key = `${opts.method}:${opts.path}`;
    const attempt = (this.attemptCounts.get(key) ?? 0) + 1;
    this.attemptCounts.set(key, attempt);
    this.recordedRequests.push({ options: { ...opts }, attempt });

    for (const rule of this.rules) {
      if (rule.match(opts)) {
        if (rule.throwOnAttempt === attempt) {
          throw new TypeError("Simulated network failure");
        }
        return rule.response as ParsedMpResponse<T>;
      }
    }

    if (this.defaultResponse) {
      return this.defaultResponse as ParsedMpResponse<T>;
    }

    return {
      status: 404,
      headers: new Headers(),
      body: null,
      rawText: "",
      problem: { status: 404, title: "Not Found" },
    } as ParsedMpResponse<T>;
  }
}
