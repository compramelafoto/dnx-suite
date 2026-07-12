import { createHmac, createHash } from "node:crypto";
import { buildR2S3Endpoint, hasR2ObjectCredentials, type CloudflareConfig } from "../config.js";
import { CloudflareR2ObjectCredentialsError } from "../errors.js";
import { RetryableRequestError, parseRetryAfterMs, withRetry, type RetryOptions } from "./retry.js";
import { RateLimiter } from "./rate-limiter.js";

export type S3HttpMethod = "GET" | "PUT" | "HEAD" | "DELETE";

export interface R2S3ClientOptions {
  config: CloudflareConfig;
  fetchImpl?: typeof fetch;
  rateLimiter?: RateLimiter;
  retry?: Partial<RetryOptions>;
}

export interface S3RequestOptions {
  bucket: string;
  key?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Buffer | string | Uint8Array;
}

/**
 * Cliente S3-compatible para objetos R2 (API oficial de Cloudflare R2).
 * Requiere Access Key ID + Secret Access Key de R2.
 */
export class R2S3Client {
  private readonly config: CloudflareConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly rateLimiter: RateLimiter;
  private readonly retryOptions: RetryOptions;
  private readonly endpoint: string;

  constructor(options: R2S3ClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoint = buildR2S3Endpoint(options.config.accountId, options.config.r2Jurisdiction);
    this.rateLimiter =
      options.rateLimiter ??
      new RateLimiter({ requestsPerMinute: options.config.requestsPerMinute });
    this.retryOptions = {
      maxRetries: options.config.maxRetries,
      baseDelayMs: options.config.retryBaseDelayMs,
      ...options.retry,
    };
  }

  assertConfigured(): void {
    if (!hasR2ObjectCredentials(this.config)) {
      throw new CloudflareR2ObjectCredentialsError();
    }
  }

  isConfigured(): boolean {
    return hasR2ObjectCredentials(this.config);
  }

  async request(method: S3HttpMethod, options: S3RequestOptions): Promise<Response> {
    this.assertConfigured();

    return withRetry(async () => {
      await this.rateLimiter.acquire();
      return this.execute(method, options);
    }, this.retryOptions);
  }

  private async execute(method: S3HttpMethod, options: S3RequestOptions): Promise<Response> {
    const url = new URL(this.endpoint);
    url.pathname = `/${options.bucket}${options.key ? `/${options.key.split("/").map(encodeURIComponent).join("/")}` : ""}`;

    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const bodyBuffer =
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
          ? Buffer.from(options.body)
          : Buffer.from(options.body);

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(bodyBuffer ?? Buffer.alloc(0));

    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...options.headers,
    };

    if (bodyBuffer && !headers["content-type"]) {
      headers["content-type"] = "application/octet-stream";
    }

    const headerEntries = Object.entries(headers).map(
      ([key, value]) => [key.toLowerCase(), value.trim()] as const,
    );
    headerEntries.sort(([a], [b]) => a.localeCompare(b));

    const signedHeaders = headerEntries.map(([key]) => key).join(";");
    const canonicalHeaders = headerEntries.map(([key, value]) => `${key}:${value}\n`).join("");

    const canonicalQuery = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = getSignatureKey(this.config.r2SecretAccessKey, dateStamp, "auto", "s3");
    const signature = hmacHex(signingKey, stringToSign);

    headers.authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.config.r2AccessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ");

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers,
      ...(bodyBuffer ? { body: bodyBuffer } : {}),
    });

    if (response.status === 429 || response.status >= 500) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      throw new RetryableRequestError(
        response.status,
        `R2 S3 error (${String(response.status)})`,
        retryAfterMs ?? undefined,
      );
    }

    return response;
  }
}

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function hmacHex(key: Buffer, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
): Buffer {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}
