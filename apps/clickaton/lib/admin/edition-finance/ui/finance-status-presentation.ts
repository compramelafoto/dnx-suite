/**
 * Presentación administrativa de finanzas / Mercado Pago (Etapa 02 Imp. 03).
 * Solo deriva etiquetas y descripciones; no decide cobros ni muta estado.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";

export type FinanceAttention = "ok" | "watch" | "action" | "blocked";

export type FinanceStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: FinanceAttention;
  nextAction?: string;
  isReadyForPayments?: boolean;
};

export type EditionFinanceReadinessInput = {
  distributionStatus: "ACTIVE" | "DRAFT_OR_NONE" | string;
  sumOk: boolean;
  beneficiaryLabel: string;
  paymentAccountConnected: boolean;
  oauthLikelyValid: boolean;
  accountMode: string;
  checkoutAllocationsReady: boolean;
  webhookReady: boolean;
  refundsBlocked?: boolean;
  ledgerCompletePending?: boolean;
  checkoutProvider?: string;
  lastError?: string | null;
};

export type EditionFinanceGateInput = {
  ok: boolean;
  mode: "TEST" | "LIVE" | string;
  blockers: string[];
  warnings: string[];
};

const SENSITIVE_PATTERNS = [
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /client[_-]?secret/i,
  /webhook[_-]?secret/i,
  /authorization[_-]?code/i,
  /pkce[_-]?verifier/i,
  /bearer\s+[a-z0-9._-]+/i,
];

export function looksLikeSensitiveFinanceText(value: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(value));
}

export function sanitizeFinanceErrorText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 240);
  if (!trimmed) return null;
  if (looksLikeSensitiveFinanceText(trimmed)) {
    return "Hay un detalle técnico disponible para soporte (sin secretos en pantalla).";
  }
  return trimmed;
}

export function presentMpConnectionStatus(
  status: string | null | undefined,
): FinanceStatusPresentation {
  switch (status) {
    case "ACTIVE":
    case "VERIFIED":
      return {
        key: "connected",
        label: "Cuenta conectada",
        description: "La cuenta de Mercado Pago está autorizada para operar.",
        tone: "success",
        attention: "ok",
      };
    case "CONNECTED_UNVERIFIED":
      return {
        key: "connected_unverified",
        label: "Conectada · pendiente de verificación",
        description: "La cuenta está vinculada, pero todavía falta completar la verificación.",
        tone: "warning",
        attention: "watch",
        nextAction: "Revisá la conexión antes de habilitar cobros reales.",
      };
    case "OAUTH_PENDING":
      return {
        key: "connecting",
        label: "Conexión en curso",
        description: "La autorización con Mercado Pago todavía no terminó.",
        tone: "info",
        attention: "watch",
        nextAction: "Completá el proceso en Mercado Pago o volvé a conectar.",
      };
    case "EXPIRED":
    case "NEEDS_REAUTH":
      return {
        key: "needs_reauth",
        label: "La conexión necesita actualizarse",
        description:
          "La cuenta sigue identificada, pero Clickatón ya no puede utilizarla para procesar nuevos pagos.",
        tone: "danger",
        attention: "action",
        nextAction: "Volver a conectar",
      };
    case "REVOKED":
      return {
        key: "revoked",
        label: "Cuenta desconectada",
        description: "La autorización fue revocada. No se pueden iniciar nuevos cobros con esta cuenta.",
        tone: "warning",
        attention: "blocked",
        nextAction: "Conectar Mercado Pago",
      };
    case "ERROR":
      return {
        key: "error",
        label: "Error de conexión",
        description: "No pudimos comprobar la conexión con Mercado Pago.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá la conexión o contactá a soporte.",
      };
    case "NOT_CONNECTED":
    case "NONE":
    case null:
    case undefined:
      return {
        key: "not_connected",
        label: "Sin conectar",
        description: "Todavía no hay una cuenta de Mercado Pago autorizada.",
        tone: "warning",
        attention: "action",
        nextAction: "Conectar Mercado Pago",
      };
    default:
      return {
        key: "unknown",
        label: "Estado de conexión",
        description: "Revisá el detalle de la cuenta antes de operar.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export function presentPaymentEnvironment(
  environment: string | null | undefined,
): FinanceStatusPresentation {
  const env = String(environment ?? "").toUpperCase();
  if (env === "LIVE" || env === "PROD" || env === "PRODUCTION") {
    return {
      key: "live",
      label: "Pagos reales",
      description:
        "Los pagos de esta configuración utilizarán una cuenta real de Mercado Pago.",
      tone: "info",
      attention: "watch",
    };
  }
  if (env === "TEST" || env === "SANDBOX" || env === "DEV") {
    return {
      key: "test",
      label: "Entorno de prueba",
      description:
        "Esta configuración solo sirve para pruebas. No habilites inscripciones reales con esta cuenta.",
      tone: "warning",
      attention: "action",
    };
  }
  return {
    key: "unknown_env",
    label: "Entorno no indicado",
    description: "No pudimos determinar si la cuenta es de prueba o de pagos reales.",
    tone: "neutral",
    attention: "watch",
  };
}

export function presentDistributionVersionStatus(
  status: string | null | undefined,
): FinanceStatusPresentation {
  switch (status) {
    case "ACTIVE":
      return {
        key: "published",
        label: "Distribución publicada",
        description: "Esta versión define cómo se envían los pagos confirmados.",
        tone: "success",
        attention: "ok",
      };
    case "DRAFT":
      return {
        key: "draft",
        label: "Borrador",
        description: "Hay una distribución en borrador que todavía no está publicada.",
        tone: "warning",
        attention: "action",
        nextAction: "Completá los porcentajes y publicá la distribución.",
      };
    default:
      return {
        key: "none",
        label: "Sin distribución publicada",
        description: "Todavía no hay una distribución activa para esta edición.",
        tone: "warning",
        attention: "action",
        nextAction: "Creá y publicá una distribución.",
      };
  }
}

/**
 * Síntesis operativa de la edición (no se persiste).
 * Criterios: docs/clickaton/ux-improvements/finance-status-map.md
 */
export function presentEditionFinanceOverall(input: {
  readiness: EditionFinanceReadinessInput;
  gate: EditionFinanceGateInput;
}): FinanceStatusPresentation {
  const { readiness, gate } = input;
  const env = presentPaymentEnvironment(readiness.accountMode);

  if (!readiness.paymentAccountConnected) {
    return {
      key: "needs_mp",
      label: "Falta conectar Mercado Pago",
      description:
        "Todavía no hay una cuenta autorizada para recibir los pagos de esta edición.",
      tone: "warning",
      attention: "action",
      nextAction: "Conectá la cuenta receptora y volvé a validar la configuración.",
      isReadyForPayments: false,
    };
  }

  if (!readiness.oauthLikelyValid) {
    return {
      key: "needs_attention_auth",
      label: "Requiere atención",
      description:
        "La cuenta está identificada, pero la autorización no permite iniciar nuevos pagos con seguridad.",
      tone: "danger",
      attention: "action",
      nextAction: "Volvé a conectar la cuenta de Mercado Pago.",
      isReadyForPayments: false,
    };
  }

  if (readiness.distributionStatus !== "ACTIVE" || !readiness.sumOk) {
    return {
      key: "incomplete",
      label: "Configuración incompleta",
      description:
        "La cuenta está conectada, pero falta completar o publicar la distribución de los pagos.",
      tone: "warning",
      attention: "action",
      nextAction: readiness.sumOk
        ? "Publicá la distribución."
        : "La distribución debe sumar 100 % antes de habilitar los cobros.",
      isReadyForPayments: false,
    };
  }

  if (env.key === "test" || gate.mode === "TEST") {
    return {
      key: "test_only",
      label: "Solo para pruebas",
      description:
        "La configuración actual no debe utilizarse para cobros reales de inscripciones.",
      tone: "warning",
      attention: "action",
      nextAction: "Usá una cuenta de pagos reales antes de abrir inscripciones productivas.",
      isReadyForPayments: false,
    };
  }

  if (!gate.ok || !readiness.checkoutAllocationsReady || !readiness.webhookReady) {
    return {
      key: "blocked",
      label: "Requiere atención",
      description:
        "Hay un bloqueo de configuración, autorización o comunicación con Mercado Pago.",
      tone: "danger",
      attention: "action",
      nextAction: "Revisá los bloqueos y resolvé el próximo paso indicado abajo.",
      isReadyForPayments: false,
    };
  }

  return {
    key: "ready",
    label: "Listo para recibir pagos",
    description:
      "La cuenta está conectada, la distribución está configurada y no hay bloqueos conocidos en esta verificación.",
    tone: "success",
    attention: "ok",
    nextAction: "Podés continuar con la operación diaria de la edición.",
    isReadyForPayments: true,
  };
}

export function presentFinanceGateBlocker(blocker: string): {
  label: string;
  nextAction?: string;
} {
  const raw = blocker.trim();
  if (/webhook/i.test(raw)) {
    return {
      label:
        "Clickatón no está recibiendo correctamente las actualizaciones automáticas de Mercado Pago.",
      nextAction:
        "Revisá la configuración técnica o contactá a soporte antes de habilitar nuevos cobros.",
    };
  }
  if (/DNX Payments no está operativo/i.test(raw)) {
    return {
      label: "El sistema de pagos todavía no está operativo para esta edición.",
      nextAction: "Contactá a soporte antes de abrir cobros.",
    };
  }
  if (/sin conexión Mercado Pago/i.test(raw)) {
    return {
      label: raw.replace(/Conexión de /i, "Cuenta de "),
      nextAction: "Conectá Mercado Pago para la cuenta receptora.",
    };
  }
  if (/suma de allocations|bps=/i.test(raw)) {
    return {
      label: "La distribución debe sumar 100 % antes de habilitar los cobros.",
      nextAction: "Revisá los porcentajes y guardá la distribución.",
    };
  }
  if (/se requiere ACTIVE/i.test(raw) || /No hay distribución financiera ACTIVE/i.test(raw)) {
    return {
      label: "No hay una distribución publicada para esta edición.",
      nextAction: "Publicá la distribución de los pagos.",
    };
  }
  if (/fase de precio/i.test(raw)) {
    return {
      label: "Falta configurar una fase de precios vigente.",
      nextAction: "Revisá precios de la edición.",
    };
  }
  if (/no puede recibir pagos/i.test(raw)) {
    return {
      label: raw.replace(/\s*\([^)]*\)\s*$/, ""),
      nextAction: "Volvé a conectar la cuenta de Mercado Pago.",
    };
  }
  if (/LIVE\/PROD|está en /i.test(raw) && /requiere LIVE/i.test(raw)) {
    return {
      label: "La cuenta receptora está en un entorno de prueba y se necesitan pagos reales.",
      nextAction: "Conectá una cuenta de pagos reales.",
    };
  }
  // Quitar enums crudos evidentes del final del mensaje
  const cleaned = raw
    .replace(/\bACTIVE\b/g, "publicada")
    .replace(/\bDRAFT\b/g, "borrador")
    .replace(/\bLIVE\b/g, "pagos reales")
    .replace(/\bTEST\b/g, "prueba");
  return { label: cleaned };
}

export function presentFinanceGateWarning(warning: string): string {
  if (/modo TEST/i.test(warning)) {
    return "Hay una cuenta de pagos reales usada en un entorno de prueba. Revisá antes de continuar.";
  }
  if (/Último error de conexión/i.test(warning)) {
    const safe = sanitizeFinanceErrorText(warning);
    return safe ?? "Hay un aviso de conexión reciente. Revisá la cuenta receptora.";
  }
  return warning
    .replace(/\bLIVE\b/g, "pagos reales")
    .replace(/\bTEST\b/g, "prueba");
}

export function presentWebhookReadiness(ready: boolean): FinanceStatusPresentation {
  if (ready) {
    return {
      key: "webhook_ok",
      label: "Actualizaciones automáticas disponibles",
      description:
        "Clickatón puede recibir notificaciones automáticas de Mercado Pago sobre el estado de los pagos.",
      tone: "success",
      attention: "ok",
    };
  }
  return {
    key: "webhook_missing",
    label: "Actualizaciones automáticas incompletas",
    description:
      "Clickatón no está recibiendo correctamente las actualizaciones de Mercado Pago.",
    tone: "danger",
    attention: "action",
    nextAction:
      "Revisá la configuración técnica o contactá a soporte antes de habilitar nuevos cobros.",
  };
}

export function presentReconciliationDiagnostics(input: {
  pendingPaymentOrders: number;
  recentErrors: number;
  lastRunAt: string | null;
}): FinanceStatusPresentation {
  if (input.recentErrors > 0) {
    return {
      key: "recon_errors",
      label: "No pudimos completar la verificación",
      description:
        "Hubo errores recientes al comparar los registros de Clickatón con Mercado Pago.",
      tone: "danger",
      attention: "action",
      nextAction: "Revisá la información técnica o contactá a soporte.",
    };
  }
  if (input.pendingPaymentOrders > 0) {
    return {
      key: "recon_pending",
      label: "Pendiente de verificación",
      description:
        "Hay pagos que todavía están siendo procesados o verificados. No realices cambios manuales sin revisar el detalle.",
      tone: "warning",
      attention: "watch",
    };
  }
  if (!input.lastRunAt) {
    return {
      key: "recon_never",
      label: "Pendiente de verificación",
      description: "Todavía no hay una verificación automática registrada.",
      tone: "neutral",
      attention: "watch",
    };
  }
  return {
    key: "recon_ok",
    label: "Sin diferencias",
    description:
      "La última verificación no reportó diferencias pendientes entre Clickatón y Mercado Pago.",
    tone: "success",
    attention: "ok",
  };
}

export type FinanceChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  description: string;
  nextAction?: string;
};

export function buildEditionFinanceChecklist(input: {
  readiness: EditionFinanceReadinessInput;
  gate: EditionFinanceGateInput;
}): FinanceChecklistItem[] {
  const { readiness, gate } = input;
  const env = presentPaymentEnvironment(readiness.accountMode);
  const webhook = presentWebhookReadiness(readiness.webhookReady);
  return [
    {
      id: "account",
      label: "Cuenta de Mercado Pago conectada",
      ok: readiness.paymentAccountConnected,
      description: readiness.paymentAccountConnected
        ? "Hay una cuenta receptora vinculada a la distribución."
        : "Falta una cuenta autorizada para recibir pagos.",
      nextAction: readiness.paymentAccountConnected
        ? undefined
        : "Conectar Mercado Pago",
    },
    {
      id: "auth",
      label: "Autorización vigente",
      ok: readiness.oauthLikelyValid,
      description: readiness.oauthLikelyValid
        ? "La autorización permite operar cobros con esta cuenta."
        : "La autorización no es válida para nuevos pagos.",
      nextAction: readiness.oauthLikelyValid ? undefined : "Volver a conectar",
    },
    {
      id: "distribution",
      label: "Distribución completa",
      ok: readiness.distributionStatus === "ACTIVE" && readiness.sumOk,
      description:
        readiness.distributionStatus === "ACTIVE" && readiness.sumOk
          ? "La distribución publicada suma 100 %."
          : "Falta publicar la distribución o completar el 100 %.",
      nextAction:
        readiness.distributionStatus === "ACTIVE" && readiness.sumOk
          ? undefined
          : "Completar distribución",
    },
    {
      id: "environment",
      label: "Entorno correcto",
      ok: env.key === "live" || gate.mode === "TEST",
      description: env.description,
      nextAction: env.key === "test" ? "Revisar entorno" : undefined,
    },
    {
      id: "updates",
      label: "Actualizaciones automáticas",
      ok: readiness.webhookReady,
      description: webhook.description,
      nextAction: webhook.nextAction,
    },
    {
      id: "gate",
      label: "Sin bloqueos conocidos",
      ok: gate.ok,
      description: gate.ok
        ? "La verificación comercial no reportó bloqueos."
        : "Hay bloqueos que impiden considerar la edición lista para cobrar.",
      nextAction: gate.ok ? undefined : "Resolver bloqueos",
    },
  ];
}

export function financeToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

export function presentConnectionStatusLabel(status: string | null | undefined): string {
  return presentMpConnectionStatus(status).label;
}

/** Evita jerga OAuth/PKCE/webhook/split/ledger en copy operativo. */
export function containsForbiddenFinanceOpsJargon(text: string): boolean {
  return /\b(OAuth|PKCE|webhook|collector|ledger|split\s*1\s*:\s*N|invalid_grant|token_expired)\b/i.test(
    text,
  );
}
