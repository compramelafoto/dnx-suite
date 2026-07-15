/**
 * Type shim for MCP typecheck only.
 * Runtime resolves `@repo/payments` via workspace package.
 */
declare module "@repo/payments" {
  export type RecipientRole = string;
  export type SplitConsentStatus =
    | "PENDING"
    | "ACTIVE"
    | "REJECTED"
    | "CANCELED"
    | "EXPIRED";
  export type PaymentEnvironment = "sandbox" | "production";

  export interface Money {
    currency: string;
    amountMinor: bigint;
  }

  export function money(currency: string, amountMinor: string | number | bigint): Money;
  export function calculateDistribution(input: unknown): {
    entries: Array<{ recipientId: string; amount: Money; role: string }>;
  };

  export class MercadoPagoProductionWriteBlockedError extends Error {}
  export function isTestAccessToken(token: string): boolean;
  export function createMercadoPagoProviderConfig(partial: {
    environment?: PaymentEnvironment;
    accessToken: string;
  }): unknown;

  export class MercadoPagoHttpClient {
    constructor(config: unknown, fetchImpl?: typeof fetch);
  }

  export class MercadoPagoSplitConsentAdapter {
    constructor(opts: { config: unknown; httpClient?: MercadoPagoHttpClient });
    invite(input: {
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
    >;
    list(input: {
      environment: PaymentEnvironment;
      status?: SplitConsentStatus;
    }): Promise<Array<{ receiverId: string; sellerEmail: string; status: SplitConsentStatus }>>;
    getConsent(receiverId: string): Promise<{
      receiverId: string;
      sellerEmail: string;
      status: SplitConsentStatus;
      inviteUrl?: string;
    } | null>;
    cancel(input: {
      environment: PaymentEnvironment;
      receiverId: string;
    }): Promise<{ status: SplitConsentStatus }>;
  }

  export class MercadoPagoOrdersAdapter {
    constructor(opts: {
      config: unknown;
      ownerUserId: string;
      httpClient?: MercadoPagoHttpClient;
      verifyAfterCreate?: boolean;
    });
    getOrder(
      providerOrderId: string,
      environment: PaymentEnvironment,
    ): Promise<{
      providerOrderId: string;
      status: string;
      statusDetail?: string;
      payments: unknown[];
    }>;
    createSplitOrder(input: unknown): Promise<{ providerOrderId: string; status: string }>;
  }

  export function validateSplitOrderForMercadoPago(input: unknown): void;
  export function buildMercadoPagoSplitOrderRequest(input: unknown): {
    body: { splits: unknown[] };
    headers: Record<string, string>;
    payloadHash: string;
  };

  export type SandboxPreflightStatus =
    | "READY"
    | "MISSING_TEST_TOKEN"
    | "INVALID_TEST_OWNER"
    | "INVALID_TEST_PARTNER"
    | "PRODUCTION_TOKEN_REJECTED"
    | "CONFIRMATION_REQUIRED"
    | "BLOCKED_BY_SANDBOX_CREDENTIALS";

  export function runSandboxPreflight(input: unknown): {
    status: SandboxPreflightStatus;
    checks: Record<string, boolean>;
    hints: string[];
  };

  export interface DnxPaymentsPersistence {
    providerOrders: {
      findByProviderOrderId(
        provider: string,
        environment: PaymentEnvironment,
        providerOrderId: string,
      ): Promise<{ id: string; mappedStatus?: string } | null>;
    };
    providerSplits: {
      listByProviderOrderId(
        providerOrderId: string,
      ): Promise<Array<{ receiverType: string }>>;
    };
    audit: {
      list(filter?: {
        aggregateType?: string;
        aggregateId?: string;
      }): Promise<unknown[]>;
    };
  }

  export function createInMemoryDnxPaymentsPersistence(): DnxPaymentsPersistence;
}
