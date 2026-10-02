import { createHash } from "node:crypto";
import type { AffiliateSplit } from "@/lib/affiliates/domain/affiliate-split";
import { decideAffiliateSplit } from "@/lib/affiliates/domain/affiliate-split";
import { isAffiliateSplitActive } from "@/lib/affiliates/infrastructure/affiliate-split-flag";
import { DNX_COLLECTOR_PAYMENT_ACCOUNT_ID } from "@/lib/affiliates/infrastructure/split-consent";
import type { AffiliateSplitCheckoutPort } from "@/lib/affiliates/infrastructure/affiliate-split-checkout";
import { createCheckoutEligibilityUseCase } from "@/lib/public-registration/application/checkout-eligibility";
import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";
import { PublicRegistrationError } from "@/lib/public-registration/domain/errors";
import { resolveClickatonPaymentsProviderMode } from "@repo/payments/next";
import { buildCheckoutIdempotencyKey } from "../domain/idempotency";
import { assertSafeCheckoutUrl } from "../domain/checkout-url";
import { CheckoutError } from "../domain/errors";
import type { CheckoutLogSink } from "../domain/observability";
import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { CheckoutRedirectDto, CreatePaymentOrderInput } from "../domain/types";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";

function buildCheckoutDescription(code: string, isGift = false): string {
  // Quien regala ve este texto en el resumen de su tarjeta. Sin la palabra
  // "regalo" parece que se inscribió él, y a los 40 días no se acuerda.
  const base = isGift
    ? `Regalo de inscripción Clickatón — ${code}`
    : `Inscripción Clickatón — ${code}`;
  // Checkout Pro TEST adapter requires "TEST" in the preference title (sandbox safety).
  const mode = resolveClickatonPaymentsProviderMode(
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual",
  );
  if (mode === "mercado_pago_test" || mode === "mercado_pago_orders_test") {
    return `${base} TEST`;
  }
  return base;
}

export type CreateRegistrationCheckoutInput = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  publicBaseUrl: string;
  now?: Date;
  /**
   * Card Payment Brick submission. Commercial amounts are NEVER taken from here —
   * only token / device / payment method / payer email hints.
   */
  cardPayment?: import("@repo/payments/frontend").CardPaymentSubmission;
  /**
   * Optional amount from browser — compared for mismatch detection only.
   * Charging always uses server eligibility amount.
   */
  clientDisplayedAmountMinor?: number;
};

function mapEligibilityReason(reason: string | null): CheckoutError {
  switch (reason) {
    case "payment_already_approved":
      return new CheckoutError("PAYMENT_ALREADY_APPROVED", "El pago ya fue aprobado.");
    case "already_confirmed":
      return new CheckoutError("PAYMENT_ALREADY_APPROVED", "La inscripci?n ya est? confirmada.");
    case "registration_expired":
      return new CheckoutError("REGISTRATION_EXPIRED", "La reserva venci?.");
    case "cancelled":
      return new CheckoutError("REGISTRATION_NOT_PAYABLE", "La inscripci?n est? cancelada.");
    case "not_payable_status":
      return new CheckoutError("REGISTRATION_NOT_PAYABLE", "La inscripci?n no admite pago.");
    case "holds_missing":
      return new CheckoutError("HOLD_CONFLICT", "No hay holds activos para esta reserva.");
    case "invalid_amount":
      return new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Importe inv?lido.");
    default:
      return new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Checkout no disponible.");
  }
}

/**
 * Clave de idempotencia del cobro con reparto: una por token de tarjeta (el
 * token es de un solo uso). Así un reintento con otra tarjeta, tras un
 * rechazo, no reutiliza la orden rechazada, y un doble clic con el mismo token
 * sí reutiliza la orden en curso.
 */
export function splitCheckoutIdempotencyKey(baseKey: string, cardToken: string): string {
  const tokenHash = createHash("sha256").update(cardToken).digest("hex").slice(0, 16);
  return `${baseKey}:split:${tokenHash}`;
}

function sameOrigin(url: string, base: string): boolean {
  try {
    const a = new URL(url);
    return a.protocol === "https:" || a.hostname === "localhost"
      ? a.origin === new URL(base).origin
      : false;
  } catch {
    return false;
  }
}

/** Estados con los que el cobro con reparto sigue vivo (no rechazado). */
const SPLIT_ORDER_ALIVE = new Set(["CREATED", "PENDING", "PROCESSING", "APPROVED"]);

export type AffiliateSplitCheckoutDeps = {
  /** Interruptor + modo producción. */
  isActive: () => boolean;
  /** Se pide sólo si está activo (la implementación Prisma se carga perezosa). */
  getPort: () => Promise<AffiliateSplitCheckoutPort>;
  /**
   * Collector que debe cobrar (dueño del permiso). Por defecto la cuenta DNX;
   * `null` sólo en tests sin snapshot financiero.
   */
  expectedCollectorPaymentAccountId?: string | null;
};

const defaultAffiliateSplitDeps: AffiliateSplitCheckoutDeps = {
  isActive: () => isAffiliateSplitActive(),
  getPort: async () => {
    const { createPrismaAffiliateSplitCheckoutPort } = await import(
      "@/lib/affiliates/infrastructure/affiliate-split-checkout"
    );
    return createPrismaAffiliateSplitCheckoutPort();
  },
};

export function createRegistrationCheckoutUseCase(deps: {
  publicRepo: PublicRegistrationRepository;
  payments: DnxPaymentsClient;
  registrationPort: CheckoutRegistrationPort;
  log?: CheckoutLogSink;
  affiliateSplit?: AffiliateSplitCheckoutDeps;
}) {
  const splitDeps = deps.affiliateSplit ?? defaultAffiliateSplitDeps;
  const eligibility = createCheckoutEligibilityUseCase({ repo: deps.publicRepo });
  const log = deps.log;

  return {
    async execute(input: CreateRegistrationCheckoutInput): Promise<CheckoutRedirectDto> {
      log?.({
        event: "checkout_requested",
        registrationId: input.registrationId,
      });

      let eligible;
      try {
        eligible = await eligibility.getRegistrationCheckoutEligibility({
          registrationId: input.registrationId,
          editionSlug: input.editionSlug,
          accessToken: input.accessToken,
          now: input.now,
        });
      } catch (error) {
        if (error instanceof PublicRegistrationError) {
          throw new CheckoutError(
            error.code as CheckoutError["code"],
            error.message,
          );
        }
        throw error;
      }

      if (!eligible.eligible) {
        throw mapEligibilityReason(eligible.reason);
      }

      if (eligible.currency !== "ARS") {
        log?.({ event: "invalid_currency", registrationId: input.registrationId });
        throw new CheckoutError("PAYMENT_CURRENCY_MISMATCH", "Moneda no soportada.");
      }
      if (!Number.isInteger(eligible.amountMinor) || eligible.amountMinor <= 0) {
        log?.({ event: "invalid_amount", registrationId: input.registrationId });
        throw new CheckoutError("CHECKOUT_NOT_AVAILABLE", "Importe inv?lido para cobro.");
      }

      const registration = await deps.publicRepo.getRegistration(input.registrationId);
      if (!registration) {
        throw new CheckoutError("NOT_FOUND", "Inscripci?n no encontrada.");
      }

      const reservationKey = registration.paymentIdempotencyKey;
      if (!reservationKey || reservationKey.length < 8) {
        throw new CheckoutError(
          "IDEMPOTENCY_CONFLICT",
          "Falta clave de idempotencia de la reserva.",
        );
      }

      // Si ya hay orden pendiente reutilizable, el cliente la devolver?.
      const attempt =
        registration.paymentOrderId &&
        (registration.paymentStatus === "FAILED" ||
          registration.paymentStatus === "EXPIRED" ||
          registration.paymentStatus === "CANCELLED")
          ? 2
          : 1;

      const idempotencyKey = buildCheckoutIdempotencyKey({
        registrationId: registration.id,
        reservationIdempotencyKey: reservationKey,
        attempt,
      });

      // Etapa 6: snapshot financiero inmutable = fuente de verdad del checkout.
      const providerMode = (
        process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual"
      ).toLowerCase();
      const requiresEditionFinance =
        providerMode.includes("mercado_pago") || providerMode.includes("mp_");

      let editionFinance: CreatePaymentOrderInput["editionFinance"];
      try {
        const { attachFinanceSnapshotToRegistration } = await import(
          "@/lib/admin/edition-finance/infrastructure/prisma-edition-finance"
        );
        const { toEditionCheckoutFinanceSnapshot } = await import(
          "@/lib/admin/edition-finance/domain/snapshot"
        );
        const { resolveCollectorAccessTokenFromPaymentAccount } = await import(
          "@/lib/admin/edition-finance/infrastructure/resolve-collector-token"
        );

        const gross =
          registration.money.subtotalAmount + registration.money.discountAmount;
        const snap = await attachFinanceSnapshotToRegistration({
          editionId: registration.editionId,
          registrationId: registration.id,
          currency: registration.money.currency,
          grossAmount: gross > 0 ? gross : registration.money.totalAmount,
          discountAmount: registration.money.discountAmount,
          providerFee: 0,
          platformFee: 0,
        });
        const checkoutSnap = toEditionCheckoutFinanceSnapshot(snap);
        const collectorAccountId = checkoutSnap.allocations[0]?.paymentAccountId;
        if (!collectorAccountId) {
          throw new CheckoutError(
            "CHECKOUT_NOT_AVAILABLE",
            "Snapshot financiero sin payment account del beneficiario.",
          );
        }

        let collectorAccessToken: string | undefined;
        if (requiresEditionFinance) {
          const tokenRes =
            await resolveCollectorAccessTokenFromPaymentAccount(collectorAccountId);
          if (!tokenRes.ok) {
            throw new CheckoutError(
              "CHECKOUT_NOT_AVAILABLE",
              `Cuenta Mercado Pago del beneficiario no usable (${tokenRes.code}).`,
            );
          }
          collectorAccessToken = tokenRes.accessToken;
        }

        editionFinance = {
          snapshot: checkoutSnap,
          ...(collectorAccessToken ? { collectorAccessToken } : {}),
        };
      } catch (error) {
        if (error instanceof CheckoutError) throw error;
        if (requiresEditionFinance) {
          const financeCode =
            error &&
            typeof error === "object" &&
            "code" in error &&
            typeof (error as { code: unknown }).code === "string"
              ? (error as { code: string }).code
              : null;
          log?.({
            event: "finance_snapshot_failed",
            registrationId: registration.id,
            meta: {
              financeCode: financeCode ?? "unknown",
              reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
            },
          });
          throw new CheckoutError(
            "CHECKOUT_NOT_AVAILABLE",
            financeCode === "NO_ACTIVE_DISTRIBUTION"
              ? "Todavía no se pueden cobrar inscripciones para esta edición. Probá más tarde o contactá a la organización."
              : error instanceof Error
                ? error.message.slice(0, 160)
                : "No se pudo resolver la distribución financiera.",
            financeCode ? { financeCode } : undefined,
          );
        }
        log?.({
          event: "finance_snapshot_skipped",
          registrationId: registration.id,
          meta: {
            reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          },
        });
      }

      const base = input.publicBaseUrl.replace(/\/$/, "");
      const tokenQ = encodeURIComponent(input.accessToken);
      if (
        input.clientDisplayedAmountMinor != null &&
        input.clientDisplayedAmountMinor !== eligible.amountMinor
      ) {
        log?.({
          event: "price_tamper_ignored",
          registrationId: registration.id,
          meta: {
            clientAmount: input.clientDisplayedAmountMinor,
            serverAmount: eligible.amountMinor,
          },
        });
      }

      // Cobro con tarjeta que reparte al fotógrafo afiliado (Orders 1:N
      // productivo). Sólo con el interruptor encendido; si no, nada cambia.
      let affiliateSplit: AffiliateSplit | null = null;
      let splitPort: AffiliateSplitCheckoutPort | null = null;
      if (input.cardPayment && splitDeps.isActive()) {
        splitPort = await splitDeps.getPort();
        const commission = await splitPort.loadCommission(registration.id);
        const receiver =
          commission?.status === "PENDING"
            ? await splitPort.getActiveReceiver(commission.affiliateId)
            : null;
        const decision = decideAffiliateSplit({
          flagEnabled: true,
          hasCardPayment: true,
          commission,
          receiver,
          totalAmountMinor: eligible.amountMinor,
          ...(splitDeps.expectedCollectorPaymentAccountId === null
            ? {}
            : {
                collector: {
                  paymentAccountId:
                    editionFinance?.snapshot.allocations[0]?.paymentAccountId ?? null,
                  expectedPaymentAccountId:
                    splitDeps.expectedCollectorPaymentAccountId ??
                    DNX_COLLECTOR_PAYMENT_ACCOUNT_ID,
                },
              }),
        });
        if (!decision.split) {
          log?.({
            event: "affiliate_split_skipped",
            registrationId: registration.id,
            meta: { reason: decision.reason },
          });
          // En producción la tarjeta sólo existe para el cobro con reparto.
          throw new CheckoutError(
            "CHECKOUT_NOT_AVAILABLE",
            "El pago con tarjeta no está disponible para esta inscripción. Recargá la página para pagar con Mercado Pago.",
          );
        }
        affiliateSplit = decision.split;
      }

      const orderInput: CreatePaymentOrderInput = {
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: registration.id,
        idempotencyKey:
          affiliateSplit && input.cardPayment
            ? splitCheckoutIdempotencyKey(idempotencyKey, input.cardPayment.token)
            : idempotencyKey,
        amountMinor: eligible.amountMinor,
        currency: "ARS",
        description: buildCheckoutDescription(
          eligible.publicCode ?? registration.id.slice(0, 8),
          registration.isGift ?? false,
        ),
        payer: {
          email: registration.participant.email,
          firstName: registration.participant.firstName,
          lastName: registration.participant.lastName,
        },
        successUrl: `${base}/maratones/${input.editionSlug}/inscripcion/pago/exito?registrationId=${registration.id}&t=${tokenQ}`,
        pendingUrl: `${base}/maratones/${input.editionSlug}/inscripcion/pago/pendiente?registrationId=${registration.id}&t=${tokenQ}`,
        failureUrl: `${base}/maratones/${input.editionSlug}/inscripcion/pago/error?registrationId=${registration.id}&t=${tokenQ}`,
        webhookContext: {
          editionId: registration.editionId,
          ticketTypeId: registration.ticketTypeId,
          sourceApp: "CLICKATON",
        },
        ...(editionFinance ? { editionFinance } : {}),
        ...(input.cardPayment
          ? {
              cardPayment: {
                ...input.cardPayment,
                // Always charge with server participant email (never trust browser).
                payer: {
                  ...input.cardPayment.payer,
                  email: registration.participant.email,
                },
              },
            }
          : {}),
        ...(affiliateSplit ? { affiliateSplit } : {}),
      };

      const result = await deps.payments.createOrder(orderInput);
      if (result.outcome === "conflict") {
        log?.({
          event: "conflict",
          registrationId: registration.id,
          meta: { code: result.code },
        });
        throw new CheckoutError("IDEMPOTENCY_CONFLICT", result.message);
      }

      const order = result.order;

      // Antes de cualquier confirmación (que llega después, por refresh): la
      // comisión queda en modo SPLIT para que al pagar pase a PAID_BY_SPLIT y
      // no a OWED (que sería pagarle dos veces).
      if (
        affiliateSplit &&
        splitPort &&
        order.providerOrderId &&
        /^ord/i.test(order.providerOrderId) &&
        SPLIT_ORDER_ALIVE.has(order.status)
      ) {
        const marked = await splitPort.markSplit(registration.id, order.providerOrderId);
        log?.({
          event: marked ? "affiliate_split_marked" : "affiliate_split_mark_failed",
          registrationId: registration.id,
          orderId: order.id,
          meta: { partnerAmountMinor: affiliateSplit.partnerAmountMinor },
        });
      }

      if (!order.checkoutUrl) {
        throw new CheckoutError("PROVIDER_UNAVAILABLE", "No hay URL de checkout.");
      }
      // Cobro con reparto (tarjeta, Orders): la "URL de checkout" es nuestra
      // propia página de resultado (éxito/pendiente/error), no un host de MP.
      // El cobro ya ocurrió: rechazarla dejaría el pago sin vincular.
      const isOwnReturnUrl =
        affiliateSplit !== null && sameOrigin(order.checkoutUrl, input.publicBaseUrl);
      const urlCheck = isOwnReturnUrl
        ? ({ ok: true } as const)
        : assertSafeCheckoutUrl(order.checkoutUrl);
      if (!urlCheck.ok) {
        throw new CheckoutError(urlCheck.code, urlCheck.message);
      }

      const paymentStatus =
        order.status === "PROCESSING"
          ? "PROCESSING"
          : order.status === "APPROVED"
            ? "APPROVED"
            : "PENDING";

      await deps.registrationPort.attachPaymentRefs({
        registrationId: registration.id,
        paymentOrderId: order.id,
        paymentProvider: order.provider,
        paymentExternalReference: order.externalReference,
        paymentIdempotencyKey: reservationKey,
        paymentStatus,
      });

      log?.({
        event: result.outcome === "reused" ? "order_reused" : "order_created",
        registrationId: registration.id,
        orderId: order.id,
        meta: { attempt: order.attempt, status: order.status },
      });
      log?.({
        event: "redirect_issued",
        registrationId: registration.id,
        orderId: order.id,
      });

      return {
        registrationId: registration.id,
        paymentOrderId: order.id,
        checkoutUrl: order.checkoutUrl,
        amountMinor: order.amountMinor,
        currency: "ARS",
        provider: order.provider,
        status: order.status,
        reused: result.outcome === "reused",
        expiresAt: registration.holdExpiresAt ?? null,
        statusDetail: order.statusDetail ?? null,
      };
    },
  };
}

export type CreateRegistrationCheckoutUseCase = ReturnType<
  typeof createRegistrationCheckoutUseCase
>;
