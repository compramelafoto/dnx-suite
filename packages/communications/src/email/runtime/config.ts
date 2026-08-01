import { CommunicationError } from "../../shared/errors";
import { parseAllowedRecipients } from "./allowlist";
import { parseControlledFromAddress, type ControlledFromAddress } from "./from-address";

export type ResendEnvSource = Readonly<Record<string, string | undefined>>;

export type ResendEmailConfig = {
  apiKey: string;
  from: ControlledFromAddress;
  allowedRecipients: string[];
  /** true solo si COMMUNICATIONS_LIVE_SEND=true */
  liveSendEnabled: boolean;
  environment: string;
};

export type LoadResendEmailConfigResult =
  | { ok: true; config: ResendEmailConfig }
  | {
      ok: false;
      errorCode:
        | "RESEND_CONFIGURATION_MISSING"
        | "INVALID_FROM_ADDRESS"
        | "INVALID_ALLOWED_RECIPIENTS";
      errorMessage: string;
    };

function readFlag(raw: string | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "true";
}

/**
 * Carga configuración Resend desde un objeto env explícito.
 * No lee process.env por sí sola — el caller debe pasar el env.
 * No se ejecuta en import time.
 */
export function loadResendEmailConfig(
  env: ResendEnvSource,
): LoadResendEmailConfigResult {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();
  const fromName = env.RESEND_FROM_NAME?.trim();
  const allowedRaw = env.RESEND_ALLOWED_RECIPIENTS;
  const liveSendEnabled = readFlag(env.COMMUNICATIONS_LIVE_SEND);
  const environment =
    env.COMMUNICATIONS_ENVIRONMENT?.trim() ||
    env.NODE_ENV?.trim() ||
    "development";

  if (!apiKey) {
    return {
      ok: false,
      errorCode: "RESEND_CONFIGURATION_MISSING",
      errorMessage: "RESEND_API_KEY ausente.",
    };
  }

  try {
    const from = parseControlledFromAddress({
      email: fromEmail,
      name: fromName,
    });
    const allowedRecipients = parseAllowedRecipients(allowedRaw);
    return {
      ok: true,
      config: {
        apiKey,
        from,
        allowedRecipients,
        liveSendEnabled,
        environment,
      },
    };
  } catch (error) {
    if (error instanceof CommunicationError) {
      if (
        error.code === "INVALID_FROM_ADDRESS" ||
        error.code === "INVALID_ALLOWED_RECIPIENTS"
      ) {
        return {
          ok: false,
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
    }
    return {
      ok: false,
      errorCode: "RESEND_CONFIGURATION_MISSING",
      errorMessage: "Configuración Resend incompleta o inválida.",
    };
  }
}

/**
 * Evalúa si el runtime puede hacer live send (sin incluir allowlist de destinatario).
 */
export function evaluateLiveSendGates(input: {
  configLoaded: boolean;
  liveSendEnabled: boolean;
  confirmLiveSend: boolean;
}): {
  canLiveSend: boolean;
  dryRun: boolean;
  blockCode?:
    | "RESEND_CONFIGURATION_MISSING"
    | "LIVE_SEND_DISABLED"
    | "LIVE_SEND_CONFIRMATION_REQUIRED";
  blockMessage?: string;
} {
  if (!input.configLoaded) {
    return {
      canLiveSend: false,
      dryRun: true,
      blockCode: "RESEND_CONFIGURATION_MISSING",
      blockMessage: "Configuración Resend incompleta — modo dry-run.",
    };
  }
  if (!input.liveSendEnabled) {
    return {
      canLiveSend: false,
      dryRun: true,
      blockCode: "LIVE_SEND_DISABLED",
      blockMessage:
        "COMMUNICATIONS_LIVE_SEND no es true — envío real deshabilitado.",
    };
  }
  if (!input.confirmLiveSend) {
    return {
      canLiveSend: false,
      dryRun: true,
      blockCode: "LIVE_SEND_CONFIRMATION_REQUIRED",
      blockMessage:
        "Falta confirmación CLI (--confirm-live-send). No se envía.",
    };
  }
  return { canLiveSend: true, dryRun: false };
}
