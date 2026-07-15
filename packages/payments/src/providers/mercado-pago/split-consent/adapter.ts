import type { PaymentEnvironment } from "../../../contracts/primitives.js";
import type { SplitConsentStatus } from "../../../contracts/entities.js";
import type { SplitConsentProvider } from "../../types.js";
import { MercadoPagoHttpClient } from "../client/mercado-pago-http-client.js";
import type { MercadoPagoProviderConfig } from "../client/mercado-pago-environment.js";
import type {
  MpSplitConsentCreateResponse,
  MpSplitConsentListResponse,
  MpSplitConsentPatchResponse,
  MpSplitConsentSucceededItem,
} from "./contracts.js";
import { mapMpConsentReceiver, mapMpConsentStatusToDomain } from "./mapper.js";
import { assertNonEmptyEmails } from "./errors.js";
import { PaymentProviderValidationError } from "../../../errors/provider-errors.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MercadoPagoSplitConsentAdapterOptions {
  config: MercadoPagoProviderConfig;
  httpClient?: MercadoPagoHttpClient;
  /** Recommended batch max (guide: 100). */
  maxBatchSize?: number;
}

export class MercadoPagoSplitConsentAdapter implements SplitConsentProvider {
  private readonly http: MercadoPagoHttpClient;
  private readonly maxBatchSize: number;

  constructor(opts: MercadoPagoSplitConsentAdapterOptions) {
    this.http = opts.httpClient ?? new MercadoPagoHttpClient(opts.config);
    this.maxBatchSize = opts.maxBatchSize ?? 100;
  }

  async invite(input: {
    environment: PaymentEnvironment;
    sellerEmails: string[];
    idempotencyKey: string;
    forceStatus?: SplitConsentStatus;
  }): Promise<
    Array<{
      sellerEmail: string;
      receiverId: string;
      status: SplitConsentStatus;
      inviteUrl?: string;
    }>
  > {
    if (input.environment !== "sandbox") {
      throw new PaymentProviderValidationError("Split consent invites are sandbox-only in Etapa 03");
    }
    assertNonEmptyEmails(input.sellerEmails);
    if (input.sellerEmails.length > this.maxBatchSize) {
      throw new PaymentProviderValidationError(
        `Batch exceeds max ${this.maxBatchSize} invites`,
      );
    }
    if (!UUID_V4.test(input.idempotencyKey)) {
      throw new PaymentProviderValidationError("idempotencyKey must be a UUID v4");
    }

    const headers: Record<string, string> = {};
    if (input.forceStatus) {
      headers["x-test-status"] = input.forceStatus;
    }

    const response = await this.http.request<MpSplitConsentCreateResponse>({
      method: "POST",
      path: "/v1/split-consent",
      body: {
        invites: input.sellerEmails.map((seller_email) => ({ seller_email })),
      },
      headers,
      idempotencyKey: input.idempotencyKey,
    });

    const body = response.body;
    if (!body) {
      throw new PaymentProviderValidationError("Invalid split consent create response");
    }

    const succeeded = body.succeeded ?? [];
    // 207 partial: still return succeeded items; failed available on body.failed
    return succeeded.map((item: MpSplitConsentSucceededItem) => {
      const mapped = mapMpConsentReceiver(item);
      return {
        sellerEmail: mapped.sellerEmail,
        receiverId: mapped.receiverId,
        status: mapped.status,
        ...(mapped.inviteUrl ? { inviteUrl: mapped.inviteUrl } : {}),
      };
    });
  }

  async createInvitations(
    input: Parameters<SplitConsentProvider["invite"]>[0],
  ): ReturnType<SplitConsentProvider["invite"]> {
    return this.invite(input);
  }

  async list(input: {
    environment: PaymentEnvironment;
    status?: SplitConsentStatus;
  }): Promise<
    Array<{
      receiverId: string;
      sellerEmail: string;
      status: SplitConsentStatus;
    }>
  > {
    void input.environment;
    const query: Record<string, string | number> = { limit: 100, offset: 0 };
    if (input.status) {
      query.status = input.status;
    }

    const response = await this.http.request<MpSplitConsentListResponse>({
      method: "GET",
      path: "/v1/split-consent",
      query,
    });

    const results = response.body?.results ?? [];
    return results.map((r) => {
      const mapped = mapMpConsentReceiver({
        receiver_id: r.receiver_id,
        seller_email: r.seller_email,
        status: r.status,
        ...(r.invite_url ? { invite_url: r.invite_url } : {}),
      });
      return {
        receiverId: mapped.receiverId,
        sellerEmail: mapped.sellerEmail,
        status: mapped.status,
      };
    });
  }

  async listConsents(
    input: Parameters<SplitConsentProvider["list"]>[0],
  ): ReturnType<SplitConsentProvider["list"]> {
    return this.list(input);
  }

  async getConsent(receiverId: string): Promise<{
    receiverId: string;
    sellerEmail: string;
    status: SplitConsentStatus;
    inviteUrl?: string;
  } | null> {
    const response = await this.http.request<MpSplitConsentListResponse>({
      method: "GET",
      path: "/v1/split-consent",
      query: { receiver_id: receiverId, limit: 1, offset: 0 },
    });
    const first = response.body?.results?.[0];
    if (!first) return null;
    return mapMpConsentReceiver({
      receiver_id: first.receiver_id,
      seller_email: first.seller_email,
      status: first.status,
      ...(first.invite_url ? { invite_url: first.invite_url } : {}),
    });
  }

  async cancel(input: {
    environment: PaymentEnvironment;
    receiverId: string;
  }): Promise<{ status: SplitConsentStatus }> {
    if (input.environment !== "sandbox") {
      throw new PaymentProviderValidationError("Split consent cancel is sandbox-only in Etapa 03");
    }

    const response = await this.http.request<MpSplitConsentPatchResponse>({
      method: "PATCH",
      path: `/v1/split-consent/${input.receiverId}`,
      body: { status: "CANCELED" },
    });

    if (!response.body?.status) {
      throw new PaymentProviderValidationError("Invalid split consent cancel response");
    }

    return { status: mapMpConsentStatusToDomain(response.body.status) };
  }

  async cancelConsent(
    input: Parameters<SplitConsentProvider["cancel"]>[0],
  ): ReturnType<SplitConsentProvider["cancel"]> {
    return this.cancel(input);
  }
}
