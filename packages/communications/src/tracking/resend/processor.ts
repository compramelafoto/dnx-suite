import {
  createCommunicationLogger,
  type CommunicationLogger,
} from "../../shared/logger";
import type {
  CommunicationTrackingEventHandler,
  CommunicationsWebhookMode,
  TrackingEventDeduplicator,
  WebhookProcessingResult,
  WebhookSignatureVerifier,
} from "../contracts";
import { admitTrackingEvent } from "../environment-policy";
import type { CommunicationWebhookEnvironmentPolicy } from "../environment-policy";
import type {
  CommunicationDeliveryPolicyHandler,
  CommunicationWebhookReceiptRepository,
} from "../persistence/contracts";
import {
  buildIgnoredReservation,
  buildReceiptReservationFromEvent,
} from "../persistence/map-event";
import { getHeader, maskProviderId } from "../sanitize";
import { parseResendWebhookPayload } from "./parser";
import { normalizeResendWebhookEvent } from "./normalize";
import { DEFAULT_WEBHOOK_MAX_BYTES } from "./types";

export type CreateResendWebhookProcessorOptions = {
  verifier: WebhookSignatureVerifier;
  handler?: CommunicationTrackingEventHandler;
  deduplicator?: TrackingEventDeduplicator;
  /** Preferido sobre deduplicator in-memory para serverless. */
  receiptRepository?: CommunicationWebhookReceiptRepository;
  deliveryPolicy?: CommunicationDeliveryPolicyHandler;
  /** Si se omite, se admiten todos los eventos soportados (compat tests). */
  environmentPolicy?: CommunicationWebhookEnvironmentPolicy;
  logger?: CommunicationLogger;
  mode?: CommunicationsWebhookMode;
  maxBytes?: number;
  allowHttpLinks?: boolean;
};

export type ProcessResendWebhookInput = {
  /** Body crudo (string) — obligatorio para firma. */
  rawBody: string;
  headers: Record<string, string | undefined>;
  receivedAt?: Date;
};

/**
 * Processor principal Resend webhook → tracking domain.
 * No lee env. No abre puertos.
 *
 * Flujo:
 *   modo → tamaño → firma → parse → normalize → reserve durable →
 *   verify_only | handler → mark
 *
 * Si el handler / persistencia falla tras reserve, se marca failed (retry).
 */
export function createResendWebhookProcessor(
  options: CreateResendWebhookProcessorOptions,
) {
  const mode = options.mode ?? "disabled";
  const maxBytes = options.maxBytes ?? DEFAULT_WEBHOOK_MAX_BYTES;
  const logger =
    options.logger ??
    createCommunicationLogger({ channel: "email", provider: "resend" });

  async function process(
    input: ProcessResendWebhookInput,
  ): Promise<WebhookProcessingResult> {
    const started = Date.now();
    const base = { provider: "resend" as const };
    const receivedAt = input.receivedAt ?? new Date();

    try {
      if (mode === "disabled") {
        return {
          ...base,
          ok: false,
          status: "rejected",
          errorCode: "WEBHOOK_DISABLED",
          errorMessage: "Webhook mode=disabled.",
          durationMs: Date.now() - started,
        };
      }

      if (
        input.rawBody === undefined ||
        input.rawBody === null ||
        input.rawBody.trim() === ""
      ) {
        return {
          ...base,
          ok: false,
          status: "rejected",
          errorCode: "WEBHOOK_PAYLOAD_EMPTY",
          errorMessage: "Payload webhook vacío.",
          durationMs: Date.now() - started,
        };
      }
      if (Buffer.byteLength(input.rawBody, "utf8") > maxBytes) {
        return {
          ...base,
          ok: false,
          status: "rejected",
          errorCode: "WEBHOOK_PAYLOAD_TOO_LARGE",
          errorMessage: `Payload excede el máximo de ${maxBytes} bytes.`,
          durationMs: Date.now() - started,
        };
      }

      const verification = await options.verifier.verify({
        payload: input.rawBody,
        headers: input.headers,
      });
      if (!verification.ok) {
        logger.warn("webhook signature rejected", {
          errorCode: verification.code,
        });
        return {
          ...base,
          ok: false,
          status: "rejected",
          errorCode: verification.code,
          errorMessage: verification.message,
          durationMs: Date.now() - started,
        };
      }

      const parsed = parseResendWebhookPayload(input.rawBody, { maxBytes });
      if (!parsed.ok) {
        return {
          ...base,
          ok: false,
          status: "rejected",
          errorCode: parsed.errorCode,
          errorMessage: parsed.errorMessage,
          durationMs: Date.now() - started,
        };
      }

      const svixId = getHeader(input.headers, "svix-id");
      const normalized = normalizeResendWebhookEvent({
        envelope: parsed.envelope,
        providerEventId: svixId,
        receivedAt,
        allowHttpLinks: options.allowHttpLinks,
      });

      if (!normalized.ok) {
        return {
          ...base,
          ok: false,
          status: "failed",
          errorCode: normalized.errorCode,
          errorMessage: normalized.errorMessage,
          durationMs: Date.now() - started,
        };
      }

      if (!normalized.supported) {
        const rawEventType = normalized.rawEventType;
        if (options.receiptRepository && svixId) {
          try {
            const reserved = await options.receiptRepository.reserve(
              buildIgnoredReservation({
                provider: "resend",
                providerEventId: svixId,
                rawEventType,
                receivedAt,
              }),
            );
            if (reserved.kind === "duplicate") {
              return {
                ...base,
                ok: true,
                status: "duplicate",
                providerEventId: svixId,
                errorCode: "WEBHOOK_EVENT_DUPLICATE",
                errorMessage: "Evento desconocido ya registrado.",
                durationMs: Date.now() - started,
              };
            }
            if (reserved.kind === "reserved" && reserved.record.status !== "ignored") {
              await options.receiptRepository.markProcessed({
                id: reserved.record.id,
                status: "ignored",
                processedAt: new Date(),
              });
            }
          } catch {
            return {
              ...base,
              ok: false,
              status: "failed",
              errorCode: "WEBHOOK_HANDLER_FAILED",
              errorMessage: "Fallo temporal de persistencia.",
              durationMs: Date.now() - started,
            };
          }
        }
        logger.info("webhook event ignored", { rawEventType });
        return {
          ...base,
          ok: true,
          status: "ignored",
          providerEventId: svixId,
          errorCode: "WEBHOOK_EVENT_UNSUPPORTED",
          errorMessage: `Evento no soportado: ${rawEventType}`,
          durationMs: Date.now() - started,
        };
      }

      const event = normalized.event;

      if (options.environmentPolicy) {
        const admission = admitTrackingEvent({
          policy: options.environmentPolicy,
          eventType: event.type,
        });
        if (!admission.admit) {
          // opened/clicked y allowlist: verificar OK, NO persistir comportamental.
          logger.info("webhook event not allowed in environment", {
            eventType: event.type,
            errorCode: admission.errorCode,
          });
          return {
            ...base,
            ok: true,
            status: "ignored",
            eventType: event.type,
            providerEventId: event.providerEventId,
            providerMessageId: event.providerMessageId,
            errorCode: admission.errorCode,
            errorMessage: admission.reason,
            durationMs: Date.now() - started,
          };
        }
      }

      const dedupeKey = event.providerEventId;
      if (!dedupeKey) {
        return {
          ...base,
          ok: false,
          status: "failed",
          errorCode: "WEBHOOK_PROVIDER_EVENT_ID_MISSING",
          errorMessage: "Sin providerEventId para deduplicación.",
          eventType: event.type,
          durationMs: Date.now() - started,
        };
      }

      let receiptId: string | undefined;

      if (options.receiptRepository) {
        try {
          const reserved = await options.receiptRepository.reserve(
            buildReceiptReservationFromEvent({ event }),
          );
          if (reserved.kind === "duplicate") {
            logger.info("webhook duplicate", {
              providerEventId: maskProviderId(dedupeKey) ?? null,
            });
            return {
              ...base,
              ok: true,
              status: "duplicate",
              eventType: event.type,
              providerEventId: dedupeKey,
              providerMessageId: event.providerMessageId,
              errorCode: "WEBHOOK_EVENT_DUPLICATE",
              errorMessage: "Evento ya procesado.",
              durationMs: Date.now() - started,
            };
          }
          receiptId = reserved.record.id;
        } catch {
          logger.error("webhook persistence reserve failed", {
            errorCode: "WEBHOOK_HANDLER_FAILED",
          });
          return {
            ...base,
            ok: false,
            status: "failed",
            errorCode: "WEBHOOK_HANDLER_FAILED",
            errorMessage: "Fallo temporal de persistencia.",
            eventType: event.type,
            providerEventId: dedupeKey,
            durationMs: Date.now() - started,
          };
        }
      } else if (
        options.deduplicator &&
        (await options.deduplicator.has(dedupeKey))
      ) {
        logger.info("webhook duplicate", {
          providerEventId: maskProviderId(dedupeKey) ?? null,
        });
        return {
          ...base,
          ok: true,
          status: "duplicate",
          eventType: event.type,
          providerEventId: dedupeKey,
          providerMessageId: event.providerMessageId,
          errorCode: "WEBHOOK_EVENT_DUPLICATE",
          errorMessage: "Evento ya procesado.",
          durationMs: Date.now() - started,
        };
      }

      if (mode === "verify_only") {
        if (options.receiptRepository && receiptId) {
          try {
            await options.receiptRepository.markProcessed({
              id: receiptId,
              status: "verified",
              processedAt: new Date(),
            });
          } catch {
            await options.receiptRepository
              .markFailed({
                id: receiptId,
                errorCode: "WEBHOOK_HANDLER_FAILED",
              })
              .catch(() => undefined);
            return {
              ...base,
              ok: false,
              status: "failed",
              errorCode: "WEBHOOK_HANDLER_FAILED",
              errorMessage: "Fallo temporal al marcar verified.",
              eventType: event.type,
              providerEventId: dedupeKey,
              durationMs: Date.now() - started,
            };
          }
        }
        if (options.deduplicator) {
          await options.deduplicator.mark(dedupeKey);
        }
        logger.info("webhook verify_only", {
          eventType: event.type,
          providerEventId: maskProviderId(dedupeKey) ?? null,
        });
        return {
          ...base,
          ok: true,
          status: "processed",
          eventType: event.type,
          providerEventId: dedupeKey,
          providerMessageId: event.providerMessageId,
          durationMs: Date.now() - started,
        };
      }

      // mode === process
      if (!options.handler) {
        if (options.receiptRepository && receiptId) {
          await options.receiptRepository
            .markFailed({
              id: receiptId,
              errorCode: "WEBHOOK_HANDLER_FAILED",
            })
            .catch(() => undefined);
        }
        return {
          ...base,
          ok: false,
          status: "failed",
          errorCode: "WEBHOOK_HANDLER_FAILED",
          errorMessage: "Modo process sin handler inyectado.",
          eventType: event.type,
          providerEventId: dedupeKey,
          durationMs: Date.now() - started,
        };
      }

      const handled = await options.handler.handle(event);
      if (!handled.ok) {
        if (options.receiptRepository && receiptId) {
          await options.receiptRepository
            .markFailed({
              id: receiptId,
              errorCode: handled.errorCode ?? "WEBHOOK_HANDLER_FAILED",
            })
            .catch(() => undefined);
        }
        logger.error("webhook handler failed", {
          errorCode: handled.errorCode ?? "WEBHOOK_HANDLER_FAILED",
        });
        return {
          ...base,
          ok: false,
          status: "failed",
          errorCode: handled.errorCode ?? "WEBHOOK_HANDLER_FAILED",
          errorMessage: handled.errorMessage,
          eventType: event.type,
          providerEventId: dedupeKey,
          providerMessageId: event.providerMessageId,
          durationMs: Date.now() - started,
        };
      }

      if (handled.duplicate) {
        return {
          ...base,
          ok: true,
          status: "duplicate",
          eventType: event.type,
          providerEventId: dedupeKey,
          providerMessageId: event.providerMessageId,
          errorCode: "WEBHOOK_EVENT_DUPLICATE",
          durationMs: Date.now() - started,
        };
      }

      // Extensión futura — no-op en Imp06.
      const policy = options.deliveryPolicy;
      if (policy) {
        if (event.type === "email.bounced") await policy.onBounced?.(event);
        if (event.type === "email.complained") await policy.onComplained?.(event);
        if (event.type === "email.failed") await policy.onFailed?.(event);
        if (event.type === "email.suppressed") await policy.onSuppressed?.(event);
      }

      if (options.receiptRepository && receiptId) {
        await options.receiptRepository.markProcessed({
          id: receiptId,
          status: "processed",
          processedAt: new Date(),
        });
      }
      if (options.deduplicator) {
        await options.deduplicator.mark(dedupeKey);
      }

      logger.info("webhook processed", {
        eventType: event.type,
        providerEventId: maskProviderId(dedupeKey) ?? null,
        providerMessageId: maskProviderId(event.providerMessageId) ?? null,
      });

      return {
        ...base,
        ok: true,
        status: "processed",
        eventType: event.type,
        providerEventId: dedupeKey,
        providerMessageId: event.providerMessageId,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message.slice(0, 160) : "Error interno";
      logger.error("webhook processor exception", {
        errorCode: "WEBHOOK_HANDLER_FAILED",
      });
      return {
        ...base,
        ok: false,
        status: "failed",
        errorCode: "WEBHOOK_HANDLER_FAILED",
        errorMessage,
        durationMs: Date.now() - started,
      };
    }
  }

  return { process, mode };
}

export type ResendWebhookProcessor = ReturnType<
  typeof createResendWebhookProcessor
>;
