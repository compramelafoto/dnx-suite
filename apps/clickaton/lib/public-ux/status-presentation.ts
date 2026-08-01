/**
 * Presentación pública de estados (Etapa 02 UX).
 * Reutiliza labels admin cuando aplica; nunca expone enums crudos al participante.
 */
import type {
  ClickatonCredentialStatus,
  ClickatonItemFulfillmentStatus,
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import {
  paymentStatusLabel,
  registrationStatusLabel,
  registrationStatusTone,
} from "@/lib/admin-registration/ui/status-labels";

export type PublicStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand";

export type PublicStatusPresentation = {
  label: string;
  description: string;
  tone: PublicStatusTone;
  nextAction?: string;
  /** true = no se espera cambio automático; false = puede actualizarse. */
  isFinal?: boolean;
};

const REGISTRATION_PUBLIC: Record<
  ClickatonRegistrationStatus,
  Omit<PublicStatusPresentation, "label" | "tone">
> = {
  DRAFT: {
    description: "Empezaste la inscripción, pero todavía no está completa.",
    nextAction: "Completá los datos o retomá el proceso desde la ficha del evento.",
    isFinal: false,
  },
  PENDING_PAYMENT: {
    description: "Reservamos tu lugar. Todavía no recibimos la confirmación del pago.",
    nextAction:
      "Completá el pago antes de que venza la reserva. No cierres el proceso a medias.",
    isFinal: false,
  },
  CONFIRMED: {
    description: "Tu lugar en Clickatón ya está reservado.",
    nextAction:
      "Desde Mi cuenta podés ver tu QR, la credencial y los datos del evento.",
    isFinal: true,
  },
  WAITLISTED: {
    description: "Hay cupo limitado. Quedaste en lista de espera.",
    nextAction: "Te vamos a avisar si se libera un lugar.",
    isFinal: false,
  },
  CANCELLED: {
    description: "Esta inscripción ya no está activa.",
    nextAction: "Si querés participar, iniciá una nueva inscripción desde la ficha del evento.",
    isFinal: true,
  },
  REFUNDED: {
    description: "Se devolvió el importe según las condiciones del evento.",
    isFinal: true,
  },
  DISQUALIFIED: {
    description: "La organización invalidó esta participación.",
    nextAction: "Si necesitás ayuda, escribinos desde el formulario de contacto.",
    isFinal: true,
  },
  TRANSFERRED_TO_NEXT_EDITION: {
    description: "Tu lugar pasó a otra edición.",
    nextAction: "Revisá los datos de la nueva edición en Mi cuenta.",
    isFinal: true,
  },
  EXPIRED: {
    description: "Se venció el tiempo de reserva o de pago.",
    nextAction: "Podés iniciar una nueva inscripción si todavía hay cupo.",
    isFinal: true,
  },
  REFUND_REQUESTED: {
    description: "Pediste la devolución. El equipo la está revisando.",
    isFinal: false,
  },
};

const PAYMENT_PUBLIC: Record<ClickatonPaymentStatus, PublicStatusPresentation> = {
  NOT_REQUIRED: {
    label: "Sin cobro",
    description: "Esta inscripción no requiere pago.",
    tone: "success",
    isFinal: true,
  },
  PENDING: {
    label: "Pago pendiente",
    description: "Todavía no recibimos la confirmación del pago.",
    tone: "warning",
    nextAction:
      "Completá el pago o esperá unos minutos si ya lo hiciste, y actualizá esta pantalla.",
    isFinal: false,
  },
  PROCESSING: {
    label: "Estamos verificando el pago",
    description:
      "Mercado Pago está procesando la operación. No necesitás pagar nuevamente mientras aparece este estado.",
    tone: "info",
    nextAction: "Esperá unos minutos y consultá el estado desde Mi cuenta.",
    isFinal: false,
  },
  APPROVED: {
    label: "Pago recibido",
    description: "Recibimos correctamente tu pago.",
    tone: "success",
    isFinal: true,
  },
  FAILED: {
    label: "El pago no pudo completarse",
    description:
      "No se realizó un cobro confirmado. Revisá el medio de pago e intentá nuevamente.",
    tone: "danger",
    nextAction: "Volvé al resumen e intentá el pago otra vez.",
    isFinal: false,
  },
  EXPIRED: {
    label: "El intento de pago venció",
    description: "Este intento ya no está activo.",
    tone: "warning",
    nextAction: "Iniciá un nuevo pago para completar la inscripción.",
    isFinal: true,
  },
  CANCELLED: {
    label: "Pago cancelado",
    description:
      "El proceso fue cancelado antes de completarse. Tu inscripción todavía no está confirmada.",
    tone: "warning",
    nextAction: "Podés retomar el pago cuando quieras desde el resumen.",
    isFinal: false,
  },
  REFUNDED: {
    label: "Pago reembolsado",
    description: "Se devolvió el importe de esta inscripción.",
    tone: "neutral",
    isFinal: true,
  },
  PARTIALLY_REFUNDED: {
    label: "Reembolso parcial",
    description: "Se devolvió una parte del importe.",
    tone: "neutral",
    isFinal: true,
  },
  MANUAL_REVIEW: {
    label: "Pago en revisión",
    description: "El equipo está revisando este cobro.",
    tone: "info",
    nextAction: "No realices un nuevo pago. Consultá Mi cuenta más tarde.",
    isFinal: false,
  },
};

export function presentRegistrationStatus(
  status: ClickatonRegistrationStatus | string,
): PublicStatusPresentation {
  const key = status as ClickatonRegistrationStatus;
  const base = REGISTRATION_PUBLIC[key];
  if (!base) {
    return {
      label: "Estado de inscripción",
      description: "Consultá el detalle o pedí ayuda desde el formulario de contacto.",
      tone: "neutral",
    };
  }
  const toneMap: Record<
    ReturnType<typeof registrationStatusTone>,
    PublicStatusTone
  > = {
    success: "success",
    warning: "warning",
    danger: "danger",
    neutral: "neutral",
    brand: "brand",
  };
  return {
    label: registrationStatusLabel(key),
    description: base.description,
    tone: toneMap[registrationStatusTone(key)],
    ...(base.nextAction ? { nextAction: base.nextAction } : {}),
    ...(base.isFinal !== undefined ? { isFinal: base.isFinal } : {}),
  };
}

export function presentPaymentStatus(
  status: ClickatonPaymentStatus | string,
): PublicStatusPresentation {
  const key = status as ClickatonPaymentStatus;
  const base = PAYMENT_PUBLIC[key];
  if (!base) {
    return {
      label: paymentStatusLabel(key as ClickatonPaymentStatus) || "Estado del pago",
      description: "Consultá Mi cuenta en unos minutos antes de intentar otro pago.",
      tone: "neutral",
      nextAction: "No realices un nuevo pago todavía si no estás seguro del resultado.",
    };
  }
  return { ...base };
}

/** Combinación inscripción + pago para la tarjeta principal en Mi cuenta. */
export function presentParticipantRegistration(
  registrationStatus: ClickatonRegistrationStatus | string,
  paymentStatus: ClickatonPaymentStatus | string,
): PublicStatusPresentation {
  const reg = presentRegistrationStatus(registrationStatus);
  const pay = presentPaymentStatus(paymentStatus);

  if (registrationStatus === "CONFIRMED") {
    return {
      label: "Inscripción confirmada",
      description:
        paymentStatus === "NOT_REQUIRED"
          ? "Tu lugar está confirmado. No requería pago."
          : "Tu lugar en Clickatón ya está reservado y el pago está acreditado.",
      tone: "success",
      nextAction: "Presentá tu QR en la acreditación el día del evento.",
      isFinal: true,
    };
  }

  if (
    registrationStatus === "PENDING_PAYMENT" &&
    (paymentStatus === "PROCESSING" || paymentStatus === "MANUAL_REVIEW")
  ) {
    return {
      label: pay.label,
      description: pay.description,
      tone: pay.tone,
      nextAction: pay.nextAction,
      isFinal: false,
    };
  }

  if (registrationStatus === "PENDING_PAYMENT") {
    return {
      label: reg.label,
      description: reg.description,
      tone: reg.tone,
      nextAction: reg.nextAction,
      isFinal: false,
    };
  }

  return {
    label: reg.label,
    description: reg.description,
    tone: reg.tone,
    nextAction: reg.nextAction ?? pay.nextAction,
    isFinal: reg.isFinal,
  };
}

export type PaymentReturnVariant = "exito" | "pendiente" | "error";

/** Copy de pantallas de retorno (antes de confirmación completa). */
export function presentPaymentReturn(input: {
  variant: PaymentReturnVariant;
  registrationStatus: string;
  paymentStatus: string;
  displayAsApproved: boolean;
  errCode?: string | null;
}): PublicStatusPresentation {
  if (input.displayAsApproved) {
    return {
      label: "Tu inscripción está confirmada",
      description: "Ya tenés tu lugar reservado para esta edición de Clickatón.",
      tone: "success",
      nextAction: "Entrá a Mi cuenta para ver tu QR y los datos del evento.",
      isFinal: true,
    };
  }

  if (input.variant === "exito") {
    return {
      label: "Recibimos tu pago",
      description:
        "Estamos terminando de confirmar tu inscripción en Clickatón. Esto puede tardar unos minutos.",
      tone: "info",
      nextAction:
        "No realices un segundo pago. Actualizá esta pantalla o consultá Mi cuenta.",
      isFinal: false,
    };
  }

  if (input.variant === "pendiente") {
    return {
      label: "Estamos verificando el pago",
      description:
        "La confirmación puede tardar unos minutos. No necesitás volver a pagar mientras aparece este estado.",
      tone: "warning",
      nextAction: "Consultá el estado desde Mi cuenta dentro de unos minutos.",
      isFinal: false,
    };
  }

  // error / rechazo / cancelación
  if (
    input.paymentStatus === "CANCELLED" ||
    input.registrationStatus === "CANCELLED"
  ) {
    return {
      label: "El pago fue cancelado",
      description:
        "Tu inscripción todavía no está confirmada. Podés retomar el proceso cuando quieras.",
      tone: "warning",
      nextAction: "Volvé al resumen para retomar el pago.",
      isFinal: false,
    };
  }

  if (
    input.paymentStatus === "EXPIRED" ||
    input.registrationStatus === "EXPIRED"
  ) {
    return {
      label: "El intento de pago venció",
      description: "Este intento ya no está activo.",
      tone: "warning",
      nextAction: "Iniciá un nuevo pago desde el resumen si todavía hay cupo.",
      isFinal: true,
    };
  }

  return {
    label: "El pago no pudo completarse",
    description:
      "Revisá los datos o elegí otro medio de pago para intentarlo nuevamente. No se realizó un cobro confirmado.",
    tone: "danger",
    nextAction: "Volvé al resumen e intentá nuevamente.",
    isFinal: false,
  };
}

export function presentWelcomeCardStatus(
  status: string | null | undefined,
): PublicStatusPresentation {
  switch (status) {
    case "GENERATED":
      return {
        label: "Lista para compartir",
        description: "Ya podés ver, descargar y compartir tu placa de bienvenida.",
        tone: "success",
        isFinal: true,
      };
    case "FAILED":
      return {
        label: "No pudimos generar la placa",
        description: "Revisá tu foto de perfil o pedí ayuda desde el formulario de contacto.",
        tone: "danger",
        nextAction: "Volvé a intentar más tarde desde esta misma pantalla.",
        isFinal: false,
      };
    case "PENDING":
    case null:
    case undefined:
    default:
      return {
        label: "Generando tu placa",
        description: "En unos momentos vas a poder previsualizarla y descargarla acá.",
        tone: "info",
        isFinal: false,
      };
  }
}

export function presentPromptStatus(status: string | null | undefined): string {
  switch (status) {
    case "LOCKED":
      return "Bloqueada";
    case "READY":
    case "RELEASED":
      return "Disponible";
    case "CLOSED":
      return "Cerrada";
    case "DRAFT":
      return "Borrador";
    default:
      return "Estado a confirmar";
  }
}

export function presentPhotoSubmissionStatus(
  status: string | null | undefined,
): string {
  switch (status) {
    case "PENDING_CONFIRMATION":
      return "Pendiente de confirmación";
    case "CONFIRMED":
      return "Confirmado";
    case "REJECTED":
      return "Rechazado";
    case "FAILED":
      return "Fallido";
    case "MANUAL_REVIEW":
      return "En revisión";
    case "PROCESSING":
    case "UPLOADING":
    case "UPLOAD_PENDING":
      return "Procesando";
    case "WITHDRAWN":
      return "Retirado";
    case null:
    case undefined:
      return "Sin envío";
    default:
      return "Estado del envío";
  }
}

export function presentFulfillmentStatus(
  status: ClickatonItemFulfillmentStatus | string | null | undefined,
): string {
  switch (status) {
    case "PENDING":
      return "Pendiente de entrega";
    case "READY":
      return "Listo para entregar";
    case "DELIVERED":
      return "Entregado";
    case "CANCELLED":
      return "Entrega cancelada";
    case "RETURNED":
      return "Devuelto";
    default:
      return "Entrega a confirmar";
  }
}

export function presentCredentialStatus(
  status: ClickatonCredentialStatus | string | null | undefined,
): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "REVOKED":
      return "Revocada";
    case "REPLACED":
      return "Reemplazada";
    default:
      return "Credencial";
  }
}

export function presentProfilePhotoStatus(
  status: string | null | undefined,
): string {
  switch (status) {
    case "READY":
    case "APPROVED":
    case "UPLOADED":
      return "Lista";
    case "PENDING":
    case "PROCESSING":
      return "En proceso";
    case "FAILED":
    case "REJECTED":
      return "Revisar foto";
    default:
      return status ? "En revisión" : "Pendiente";
  }
}

export function presentCheckInSource(source: string | null | undefined): string {
  switch (source) {
    case "QR_SCAN":
      return "Escaneo de QR";
    case "MANUAL_SEARCH":
      return "Registro manual";
    case "ADMIN":
      return "Equipo de acreditación";
    default:
      return "Acreditación";
  }
}

export function presentIdentityStatus(status: string | null | undefined): string {
  switch (status) {
    case "VERIFIED":
      return "Verificada";
    case "PENDING":
      return "Pendiente";
    case "EXCEPTION_GRANTED":
      return "Excepción otorgada";
    default:
      return "A confirmar";
  }
}

/** Badge tone → UI Badge variant. */
export function publicToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

/** Detecta enums/códigos crudos que no deben renderizarse al público. */
export function looksLikeRawStatusEnum(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,}$/.test(value.trim());
}
