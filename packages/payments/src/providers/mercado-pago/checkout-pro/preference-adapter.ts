/**
 * Adapter Mercado Pago Checkout Pro (Preferences) — solo sandbox/TEST.
 * Clickatón → DNX Payments → este adapter. No Orders/split.
 */
import type { CurrencyCode } from "../../../contracts/primitives";
import { MercadoPagoHttpClient } from "../client/mercado-pago-http-client";
import {
  assertSandboxToken,
  assertSandboxWriteAllowed,
  createMercadoPagoProviderConfig,
  type MercadoPagoProviderConfig,
} from "../client/mercado-pago-environment";
import { mapMercadoPagoPaymentStatusToNormalized } from "./map-status";
import {
  assertNoSecretLeak,
  sanitizeMercadoPagoPaymentResponse,
  sanitizeMercadoPagoPreferenceResponse,
} from "./sanitize";
import {
  validateMercadoPagoTestCredentials,
  type ValidateMercadoPagoTestCredentialsResult,
} from "./validate-credentials";
import type { NormalizedCheckoutStatus } from "../../../application/services/clickaton-checkout/types";

export type ClickatonMpCheckoutProviderMode = "manual" | "mercado_pago_test";

export type CreateCheckoutProPreferenceInput = {
  amountMinor: number;
  currency: CurrencyCode;
  description: string;
  externalReference: string;
  idempotencyKey: string;
  payerEmail?: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  notificationUrl: string;
  metadata?: Record<string, string>;
};

export type CreateCheckoutProPreferenceResult = {
  providerPreferenceId: string;
  checkoutUrl: string;
  status: NormalizedCheckoutStatus;
  rawSanitized: Record<string, unknown>;
};

export type GetCheckoutProPaymentResult = {
  providerPaymentId: string;
  status: NormalizedCheckoutStatus;
  amountMinor: number;
  currency: CurrencyCode;
  externalReference: string | null;
  liveMode: boolean;
  rawSanitized: Record<string, unknown>;
};

export type MercadoPagoCheckoutProTestAdapterOptions = {
  config: MercadoPagoProviderConfig;
  credentialsSource?: "credenciales_de_prueba" | "unknown" | "production_panel";
  httpClient?: MercadoPagoHttpClient;
  /** Skip live credential gate only in unit tests with mocks. */
  skipCredentialGate?: boolean;
};

function minorToUnitAmount(amountMinor: number, currency: CurrencyCode): number {
  if (currency === "CLP") return amountMinor;
  return Math.round(amountMinor) / 100;
}

function unitToMinor(amount: number, currency: CurrencyCode): number {
  if (currency === "CLP") return Math.round(amount);
  return Math.round(amount * 100);
}

function pickCheckoutUrl(body: Record<string, unknown>): string {
  // Official docs: with TEST credentials use init_point (not sandbox_init_point).
  const init = typeof body.init_point === "string" ? body.init_point : "";
  if (init.startsWith("https://")) return init;
  const sandbox =
    typeof body.sandbox_init_point === "string" ? body.sandbox_init_point : "";
  if (sandbox.startsWith("https://")) return sandbox;
  throw new Error("preference_missing_checkout_url");
}

export class MercadoPagoCheckoutProTestAdapter {
  readonly name = "mercadopago_preferences_legacy" as const;
  private readonly config: MercadoPagoProviderConfig;
  private readonly http: MercadoPagoHttpClient;
  private readonly credentialsSource: "credenciales_de_prueba" | "unknown" | "production_panel";
  private readonly skipCredentialGate: boolean;
  private lastCredentialResult: ValidateMercadoPagoTestCredentialsResult | null = null;

  constructor(opts: MercadoPagoCheckoutProTestAdapterOptions) {
    this.config = opts.config;
    this.http = opts.httpClient ?? new MercadoPagoHttpClient(opts.config);
    this.credentialsSource = opts.credentialsSource ?? "unknown";
    this.skipCredentialGate = Boolean(opts.skipCredentialGate);
  }

  getLastCredentialValidation(): ValidateMercadoPagoTestCredentialsResult | null {
    return this.lastCredentialResult;
  }

  async validateCredentials(): Promise<ValidateMercadoPagoTestCredentialsResult> {
    const result = await validateMercadoPagoTestCredentials({
      accessToken: this.config.accessToken,
      declaredEnvironment: this.config.environment,
      credentialsSource: this.credentialsSource,
      fetchUsersMe: async () => {
        const res = await this.http.request<Record<string, unknown>>({
          method: "GET",
          path: "/users/me",
        });
        return (res.body ?? {}) as Record<string, unknown>;
      },
    });
    this.lastCredentialResult = result;
    return result;
  }

  private async assertSafeToCreate(): Promise<void> {
    assertSandboxWriteAllowed(this.config);
    assertSandboxToken(this.config);
    if (this.skipCredentialGate) return;
    const result = await this.validateCredentials();
    if (!result.safeToExecute) {
      throw new Error(`mp_test_credentials_blocked:${result.reason}`);
    }
  }

  async createPreference(
    input: CreateCheckoutProPreferenceInput,
  ): Promise<CreateCheckoutProPreferenceResult> {
    await this.assertSafeToCreate();

    if (input.currency !== "ARS") {
      throw new Error("mp_test_currency_ars_only");
    }
    if (!input.description.toUpperCase().includes("TEST")) {
      throw new Error("mp_test_description_must_include_TEST");
    }
    if (!input.notificationUrl.startsWith("https://")) {
      throw new Error("mp_test_notification_https_required");
    }
    for (const u of [input.successUrl, input.pendingUrl, input.failureUrl]) {
      if (!u.startsWith("https://") && !u.startsWith("http://localhost")) {
        throw new Error("mp_test_back_url_invalid");
      }
    }

    const unit = minorToUnitAmount(input.amountMinor, input.currency);
    const body = {
      items: [
        {
          id: "clickaton-registration",
          title: input.description.slice(0, 120),
          description: input.description.slice(0, 250),
          quantity: 1,
          currency_id: input.currency,
          unit_price: unit,
        },
      ],
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      back_urls: {
        success: input.successUrl,
        pending: input.pendingUrl,
        failure: input.failureUrl,
      },
      auto_return: "approved" as const,
      metadata: {
        source_app: "CLICKATON",
        ...(input.metadata ?? {}),
      },
      ...(input.payerEmail
        ? { payer: { email: input.payerEmail } }
        : {}),
    };

    const response = await this.http.request<Record<string, unknown>>({
      method: "POST",
      path: "/checkout/preferences",
      body,
      idempotencyKey: input.idempotencyKey,
    });

    const raw = (response.body ?? {}) as Record<string, unknown>;
    const sanitized = sanitizeMercadoPagoPreferenceResponse(raw);
    assertNoSecretLeak(sanitized, this.config.accessToken);

    const id = String(raw.id ?? "");
    if (!id) throw new Error("preference_missing_id");
    const checkoutUrl = pickCheckoutUrl(raw);

    return {
      providerPreferenceId: id,
      checkoutUrl,
      status: "CREATED",
      rawSanitized: sanitized,
    };
  }

  async getPreference(preferenceId: string): Promise<{
    providerPreferenceId: string;
    checkoutUrl: string | null;
    externalReference: string | null;
    rawSanitized: Record<string, unknown>;
  }> {
    assertSandboxWriteAllowed(this.config);
    const response = await this.http.request<Record<string, unknown>>({
      method: "GET",
      path: `/checkout/preferences/${encodeURIComponent(preferenceId)}`,
    });
    const raw = (response.body ?? {}) as Record<string, unknown>;
    const sanitized = sanitizeMercadoPagoPreferenceResponse(raw);
    assertNoSecretLeak(sanitized, this.config.accessToken);
    let checkoutUrl: string | null = null;
    try {
      checkoutUrl = pickCheckoutUrl(raw);
    } catch {
      checkoutUrl = null;
    }
    return {
      providerPreferenceId: String(raw.id ?? preferenceId),
      checkoutUrl,
      externalReference:
        typeof raw.external_reference === "string" ? raw.external_reference : null,
      rawSanitized: sanitized,
    };
  }

  async getPayment(paymentId: string): Promise<GetCheckoutProPaymentResult> {
    assertSandboxWriteAllowed(this.config);
    const response = await this.http.request<Record<string, unknown>>({
      method: "GET",
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
    });
    const raw = (response.body ?? {}) as Record<string, unknown>;
    const sanitized = sanitizeMercadoPagoPaymentResponse(raw);
    assertNoSecretLeak(sanitized, this.config.accessToken);

    const currency = (String(raw.currency_id ?? "ARS") as CurrencyCode) || "ARS";
    const amount =
      typeof raw.transaction_amount === "number"
        ? unitToMinor(raw.transaction_amount, currency)
        : 0;

    return {
      providerPaymentId: String(raw.id ?? paymentId),
      status: mapMercadoPagoPaymentStatusToNormalized(String(raw.status ?? "")),
      amountMinor: amount,
      currency,
      externalReference:
        typeof raw.external_reference === "string" ? raw.external_reference : null,
      liveMode: raw.live_mode === true,
      rawSanitized: sanitized,
    };
  }
}

export function createMercadoPagoCheckoutProTestAdapter(input: {
  accessToken: string;
  publicKey?: string;
  credentialsSource?: "credenciales_de_prueba" | "unknown" | "production_panel";
  httpClient?: MercadoPagoHttpClient;
  skipCredentialGate?: boolean;
}): MercadoPagoCheckoutProTestAdapter {
  const config = createMercadoPagoProviderConfig({
    accessToken: input.accessToken,
    environment: "sandbox",
    ...(input.publicKey ? { publicKey: input.publicKey } : {}),
  });
  return new MercadoPagoCheckoutProTestAdapter({
    config,
    credentialsSource: input.credentialsSource ?? "unknown",
    ...(input.httpClient ? { httpClient: input.httpClient } : {}),
    skipCredentialGate: input.skipCredentialGate,
  });
}
