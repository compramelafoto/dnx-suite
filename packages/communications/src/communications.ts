import {
  CommunicationProviderRegistry,
  createProviderRegistry,
} from "./providers/registry";
import type {
  CommunicationProvider,
  CommunicationProviderSendInput,
  RegisterProviderOptions,
} from "./providers/types";
import type { CommunicationChannel } from "./shared/channels";
import { CommunicationError } from "./shared/errors";
import {
  createCommunicationLogger,
  type CommunicationLogger,
} from "./shared/logger";
import { failedResult, skippedResult } from "./shared/result";
import type {
  CommunicationEvent,
  CommunicationRequest,
  CommunicationResult,
  CommunicationTemplate,
} from "./shared/types";
import {
  assertValidSendRequest,
  flattenMessageFields,
  resolveChannel,
} from "./shared/validate";
import {
  createEmailTemplateEngine,
  type EmailTemplateEngine,
  type EmailTemplateRenderInput,
  type TemplateRenderResult,
} from "./templates/index";
import { isCommunicationEventType } from "./events/catalog";
import type { ProviderChannelKey } from "./providers/types";

export type CommunicationsSendInput = CommunicationRequest;

export type CommunicationsScheduleInput = CommunicationRequest & {
  runAt: Date;
};

export type CommunicationsTriggerInput = {
  event: CommunicationEvent;
};

export type CommunicationsTriggerResult = {
  status: "skipped" | "failed";
  ok: false;
  eventType: string;
  validEvent: boolean;
  plannedActions: 0;
  errorCode?: string;
  errorMessage: string;
};

export type CommunicationsPreviewInput = EmailTemplateRenderInput;
export type CommunicationsRenderInput = EmailTemplateRenderInput;

export type CommunicationsFacadeOptions = {
  registry?: CommunicationProviderRegistry;
  templateEngine?: EmailTemplateEngine;
  logger?: CommunicationLogger;
  defaultChannel?: CommunicationChannel;
};

/**
 * Fachada pública única.
 * Render → message → send (sin sendTemplate duplicado).
 */
export type CommunicationsFacade = {
  readonly registry: CommunicationProviderRegistry;
  readonly templates: EmailTemplateEngine;

  registerProvider(
    channel: ProviderChannelKey,
    provider: CommunicationProvider,
    options?: RegisterProviderOptions,
  ): void;
  getProvider(channel: ProviderChannelKey): CommunicationProvider;
  hasProvider(channel: ProviderChannelKey): boolean;
  removeProvider(channel: ProviderChannelKey): boolean;
  clearProviders(): void;

  send(input: CommunicationsSendInput): Promise<CommunicationResult>;
  schedule(input: CommunicationsScheduleInput): Promise<CommunicationResult>;
  trigger(input: CommunicationsTriggerInput): Promise<CommunicationsTriggerResult>;
  preview(input: CommunicationsPreviewInput): Promise<TemplateRenderResult>;
  render(input: CommunicationsRenderInput): Promise<TemplateRenderResult>;
};

function toProviderInput(
  input: CommunicationRequest,
): CommunicationProviderSendInput {
  const flat = flattenMessageFields(input);
  return {
    to: input.to,
    from: input.from,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo,
    subject: flat.subject,
    text: flat.text,
    html: flat.html,
    attachments: flat.attachments.length > 0 ? flat.attachments : undefined,
    headers: flat.headers,
    tags: flat.tags,
    templateKey: input.templateKey,
    templateVariables: input.templateVariables,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
    dryRun: input.dryRun,
  };
}

export function createCommunicationsFacade(
  options: CommunicationsFacadeOptions = {},
): CommunicationsFacade {
  const logger =
    options.logger ?? createCommunicationLogger({ mirrorToConsole: false });
  const templateEngine = options.templateEngine ?? createEmailTemplateEngine();
  const registry = options.registry ?? createProviderRegistry();
  const defaultChannel = options.defaultChannel ?? "email";

  const facade: CommunicationsFacade = {
    registry,
    templates: templateEngine,

    registerProvider(channel, provider, registerOptions) {
      registry.registerProvider(channel, provider, registerOptions);
    },

    getProvider(channel) {
      return registry.getProvider(channel);
    },

    hasProvider(channel) {
      return registry.hasProvider(channel);
    },

    removeProvider(channel) {
      return registry.removeProvider(channel);
    },

    clearProviders() {
      registry.clearProviders();
    },

    async send(input: CommunicationsSendInput): Promise<CommunicationResult> {
      let channel: CommunicationChannel = defaultChannel;
      try {
        channel = resolveChannel(input, defaultChannel);
        assertValidSendRequest(input);
      } catch (error) {
        if (error instanceof CommunicationError) {
          logger.warn("communications.send solicitud inválida", {
            errorCode: error.code,
          });
          return failedResult({
            channel,
            errorCode: error.code,
            errorMessage: error.message,
            metadata: input.metadata,
          });
        }
        throw error;
      }

      const provider = registry.tryGetProvider(channel);
      if (!provider) {
        logger.warn("communications.send sin provider", { channel });
        return failedResult({
          channel,
          errorCode: "PROVIDER_NOT_REGISTERED",
          errorMessage: `No hay provider registrado para el canal "${channel}".`,
          metadata: input.metadata,
        });
      }

      logger.info("communications.send", {
        channel,
        provider: provider.name,
        hasTemplateKey: Boolean(input.templateKey),
        dryRun: input.dryRun ?? null,
      });

      try {
        const result = await provider.send(toProviderInput(input));
        return {
          ...result,
          channel: result.channel ?? channel,
          provider: result.provider ?? provider.name,
        };
      } catch (error) {
        if (error instanceof CommunicationError) {
          return failedResult({
            channel,
            provider: provider.name,
            errorCode: error.code,
            errorMessage: error.message,
            metadata: input.metadata,
          });
        }
        const errorMessage =
          error instanceof Error ? error.message : "Excepción desconocida en send()";
        logger.error("communications.send excepción", {
          channel,
          provider: provider.name,
          errorCode: "SEND_FAILED",
        });
        return failedResult({
          channel,
          provider: provider.name,
          errorCode: "SEND_FAILED",
          errorMessage,
          metadata: input.metadata,
        });
      }
    },

    async schedule(input: CommunicationsScheduleInput): Promise<CommunicationResult> {
      const channel = input.channel ?? defaultChannel;
      logger.info("communications.schedule no implementado", {
        channel,
        hasRunAt: Boolean(input.runAt),
      });
      return skippedResult({
        channel,
        errorCode: "SCHEDULE_NOT_IMPLEMENTED",
        errorMessage:
          "schedule() no está implementado (sin colas/workers). No se programó ningún envío.",
        metadata: {
          ...input.metadata,
          runAt: input.runAt?.toISOString() ?? null,
        },
      });
    },

    async trigger(
      input: CommunicationsTriggerInput,
    ): Promise<CommunicationsTriggerResult> {
      const eventType = input.event?.type ?? "";
      const validEvent = isCommunicationEventType(eventType);

      logger.info("communications.trigger", {
        eventType: eventType || "unknown",
        validEvent,
      });

      if (!validEvent) {
        return {
          status: "failed",
          ok: false,
          eventType,
          validEvent: false,
          plannedActions: 0,
          errorCode: "INVALID_EVENT",
          errorMessage: `Evento desconocido o no tipado: "${eventType}". Usá COMMUNICATION_EVENT_TYPES.`,
        };
      }

      return {
        status: "skipped",
        ok: false,
        eventType,
        validEvent: true,
        plannedActions: 0,
        errorCode: "TRIGGER_NOT_IMPLEMENTED",
        errorMessage:
          "trigger() validó el evento pero las automatizaciones no están implementadas.",
      };
    },

    async preview(input: CommunicationsPreviewInput): Promise<TemplateRenderResult> {
      logger.debug("communications.preview", {
        templateId: input.templateId,
        brandId: input.brandId,
        locale: input.locale ?? "es-AR",
      });
      return templateEngine.preview(input);
    },

    async render(input: CommunicationsRenderInput): Promise<TemplateRenderResult> {
      logger.debug("communications.render", {
        templateId: input.templateId,
        brandId: input.brandId,
        locale: input.locale ?? "es-AR",
      });
      return templateEngine.render(input);
    },
  };

  return facade;
}

export const communications = createCommunicationsFacade();

export function configureCommunications(
  options: CommunicationsFacadeOptions = {},
): CommunicationsFacade {
  return createCommunicationsFacade(options);
}

export function registerCommunicationProvider(
  channel: ProviderChannelKey,
  provider: CommunicationProvider,
  options?: RegisterProviderOptions,
): void {
  communications.registerProvider(channel, provider, options);
}

export const registerProvider = registerCommunicationProvider;

export function getCommunicationProvider(
  channel: ProviderChannelKey,
): CommunicationProvider {
  return communications.getProvider(channel);
}

export const getProvider = getCommunicationProvider;

export function hasCommunicationProvider(channel: ProviderChannelKey): boolean {
  return communications.hasProvider(channel);
}

export const hasProvider = hasCommunicationProvider;

export function removeCommunicationProvider(channel: ProviderChannelKey): boolean {
  return communications.removeProvider(channel);
}

export const removeProvider = removeCommunicationProvider;

export function clearCommunicationProviders(): void {
  communications.clearProviders();
}

export const clearProviders = clearCommunicationProviders;

export function assertEmailProviderRegistered(): void {
  if (!communications.hasProvider("email")) {
    throw new CommunicationError(
      "PROVIDER_NOT_REGISTERED",
      'Registrá un EmailProvider con registerCommunicationProvider("email", provider) antes de enviar.',
    );
  }
}

export type { CommunicationTemplate };
