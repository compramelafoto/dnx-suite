import type {
  CommunicationProvider,
  CommunicationProviderSendInput,
} from "../../providers/types";
import type { CommunicationResult } from "../../shared/types";
import { skippedResult } from "../../shared/result";
import { createCommunicationLogger, type CommunicationLogger } from "../../shared/logger";
import { createResendProvider, type ResendProvider } from "../providers/resend-provider";
import { createResendSdkClientFromApiKey } from "../providers/resend-sdk-adapter";
import type { ResendClientLike } from "../providers/resend-client";
import {
  assertRecipientsAllowed,
  normalizeEmailAddress,
} from "./allowlist";
import {
  evaluateLiveSendGates,
  loadResendEmailConfig,
  type ResendEmailConfig,
  type ResendEnvSource,
} from "./config";
import { emailDomain, maskEmail } from "./mask";

export type CreateResendEmailRuntimeOptions = {
  /** Env explícito (default: process.env — solo al invocar, no en import). */
  env?: ResendEnvSource;
  /** Confirmación CLI (--confirm-live-send). */
  confirmLiveSend?: boolean;
  /** Inyectar client falso en tests (evita SDK). */
  client?: ResendClientLike;
  logger?: CommunicationLogger;
};

export type ResendEmailRuntime = {
  config: ResendEmailConfig | null;
  configError?: string;
  configErrorCode?: string;
  canLiveSend: boolean;
  dryRun: boolean;
  blockCode?: string;
  blockMessage?: string;
  from: { email: string; name: string } | null;
  provider: CommunicationProvider;
  resendProvider: ResendProvider;
  allowedRecipientCount: number;
  environment: string;
  /** Resumen sanitizado para CLI. */
  summarizeRecipient(email: string): {
    masked: string;
    domain?: string;
    allowed: boolean;
  };
};

function collectEmails(
  value: CommunicationProviderSendInput["to"],
): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((r) => r.email?.trim())
    .filter((e): e is string => Boolean(e))
    .map(normalizeEmailAddress);
}

/**
 * Runtime controlado Resend.
 * No se ejecuta al importar — solo al llamar esta factory.
 */
export function createResendEmailRuntime(
  options: CreateResendEmailRuntimeOptions = {},
): ResendEmailRuntime {
  const env = options.env ?? process.env;
  const confirmLiveSend = options.confirmLiveSend === true;
  const logger =
    options.logger ??
    createCommunicationLogger({ channel: "email", provider: "resend" });

  const loaded = loadResendEmailConfig(env);
  const gates = evaluateLiveSendGates({
    configLoaded: loaded.ok,
    liveSendEnabled: loaded.ok ? loaded.config.liveSendEnabled : false,
    confirmLiveSend,
  });

  const config = loaded.ok ? loaded.config : null;
  const from = config?.from ?? null;

  let client = options.client;
  if (gates.canLiveSend && config && !client) {
    client = createResendSdkClientFromApiKey(config.apiKey);
  }

  const resendProvider = createResendProvider({
    client,
    defaultFrom: from ?? undefined,
    dryRun: gates.dryRun,
    dryRunErrorCode: gates.blockCode ?? "DRY_RUN",
    dryRunErrorMessage: gates.blockMessage,
    logger,
  });

  const allowlist = config?.allowedRecipients ?? [];

  const provider: CommunicationProvider = {
    name: "resend",
    channel: "email",
    capabilities: resendProvider.capabilities,
    async send(input: CommunicationProviderSendInput): Promise<CommunicationResult> {
      if (!loaded.ok) {
        return skippedResult({
          channel: "email",
          provider: "resend",
          dryRun: true,
          errorCode: loaded.errorCode,
          errorMessage: loaded.errorMessage,
        });
      }

      if (!gates.canLiveSend) {
        return skippedResult({
          channel: "email",
          provider: "resend",
          dryRun: true,
          errorCode: gates.blockCode ?? "LIVE_SEND_DISABLED",
          errorMessage: gates.blockMessage ?? "Live send deshabilitado.",
        });
      }

      const to = collectEmails(input.to);
      const cc = input.cc
        ? input.cc.map((r) => r.email).filter((e): e is string => Boolean(e))
        : [];
      const bcc = input.bcc
        ? input.bcc.map((r) => r.email).filter((e): e is string => Boolean(e))
        : [];

      if (to.length !== 1) {
        return skippedResult({
          channel: "email",
          provider: "resend",
          dryRun: true,
          errorCode: "INVALID_RECIPIENT",
          errorMessage:
            "Esta etapa admite exactamente un destinatario principal (sin lista).",
        });
      }

      const allowed = assertRecipientsAllowed(allowlist, { to, cc, bcc });
      if (!allowed.ok) {
        logger.warn("Destinatario bloqueado por allowlist", {
          blockedCount: allowed.blockedCount,
          toDomain: emailDomain(to[0]!) ?? null,
        });
        return skippedResult({
          channel: "email",
          provider: "resend",
          dryRun: true,
          errorCode: allowed.errorCode,
          errorMessage: allowed.errorMessage,
        });
      }

      return resendProvider.send({
        ...input,
        from: {
          email: config!.from.email,
          name: config!.from.name,
        },
        dryRun: false,
      });
    },
  };

  return {
    config,
    configError: loaded.ok ? undefined : loaded.errorMessage,
    configErrorCode: loaded.ok ? undefined : loaded.errorCode,
    canLiveSend: gates.canLiveSend,
    dryRun: gates.dryRun,
    blockCode: gates.blockCode,
    blockMessage: gates.blockMessage,
    from,
    provider,
    resendProvider,
    allowedRecipientCount: allowlist.length,
    environment: config?.environment ?? "development",
    summarizeRecipient(email: string) {
      const normalized = normalizeEmailAddress(email);
      return {
        masked: maskEmail(normalized),
        domain: emailDomain(normalized),
        allowed: allowlist.includes(normalized),
      };
    },
  };
}

/** Alias pedido en el brief. */
export function createResendProviderFromEnvironment(
  options: CreateResendEmailRuntimeOptions = {},
): ResendEmailRuntime {
  return createResendEmailRuntime(options);
}
