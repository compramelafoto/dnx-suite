/**
 * Traducción segura de errores técnicos a mensajes públicos.
 * Nunca expone stack, Prisma, tokens ni códigos internos como mensaje principal.
 */

export type PublicErrorMessage = {
  title: string;
  description: string;
  nextAction?: string;
  /** Referencia real existente (código público, visibleCode, etc.). */
  supportReference?: string | null;
};

const FORBIDDEN_FRAGMENT =
  /\b(webhook|oauth|prisma|stack|collector|split\s*1\s*:\s*n|dnx\s*payments|preference|payment\s*intent|ledger|pkce|client_secret|access_token|refresh_token)\b/i;

export function isUnsafePublicErrorText(text: string): boolean {
  if (FORBIDDEN_FRAGMENT.test(text)) return true;
  if (/at\s+\w+\s+\(/.test(text)) return true;
  if (/^\s*\{[\s\S]*\}\s*$/.test(text)) return true;
  return false;
}

export function publicCheckoutError(
  code?: string | null,
  fallbackMessage?: string | null,
): PublicErrorMessage {
  switch (code) {
    case "TOKEN_EXPIRED":
      return {
        title: "El enlace de acceso expiró",
        description:
          "No pudimos comprobar el estado del pago con este enlace. Es posible que el pago todavía esté siendo procesado.",
        nextAction:
          "Revisá el estado desde Mi cuenta antes de realizar otra operación. No realices un nuevo pago todavía.",
      };
    case "TOKEN_INVALID":
    case "FORBIDDEN":
      return {
        title: "No pudimos validar el enlace",
        description:
          "El enlace de acceso no es válido o está incompleto. El retorno del navegador por sí solo no confirma el pago.",
        nextAction: "Entrá a Mi cuenta o retomá el proceso desde la ficha del evento.",
      };
    case "CHECKOUT_NOT_AVAILABLE":
      return {
        title: "No pudimos iniciar el pago",
        description:
          "Tu inscripción todavía no fue cobrada. Revisá tu conexión e intentá nuevamente en unos minutos.",
        nextAction: "Si el problema continúa, escribinos desde el formulario de contacto.",
      };
    default:
      break;
  }

  const safeFallback =
    fallbackMessage && !isUnsafePublicErrorText(fallbackMessage)
      ? fallbackMessage
      : null;

  return {
    title: "No pudimos confirmar el resultado",
    description:
      safeFallback ??
      "Es posible que el pago todavía esté siendo procesado. Revisá el estado desde Mi cuenta antes de realizar otra operación.",
    nextAction: "No realices un nuevo pago todavía si no estás seguro del resultado.",
  };
}

export function publicUploadError(
  codeOrMessage?: string | null,
): PublicErrorMessage {
  if (codeOrMessage && !isUnsafePublicErrorText(codeOrMessage) && codeOrMessage.length < 160) {
    return {
      title: "No pudimos subir la fotografía",
      description: codeOrMessage,
      nextAction: "Revisá el formato del archivo y volvé a intentar.",
    };
  }
  return {
    title: "No pudimos subir la fotografía",
    description:
      "Revisá el formato del archivo, el tamaño y tu conexión. Tu inscripción no se ve afectada.",
    nextAction: "Volvé a intentar en unos segundos.",
  };
}

/** Strings que no deben aparecer en copy público de checkout. */
export const PUBLIC_CHECKOUT_FORBIDDEN_TERMS = [
  "webhook",
  "Split 1:N",
  "Orders Split",
  "DNX Payments",
  "collector",
  "OAuth",
  "Payment Brick",
  "Card Payment Brick",
  "preference",
  "payment intent",
  "reconciliación",
] as const;
