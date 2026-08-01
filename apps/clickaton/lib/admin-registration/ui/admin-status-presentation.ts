/**
 * Presentación administrativa de estados (Etapa 02 Imp. 02).
 * Deriva de status-labels + presentaciones públicas; no crea estados persistidos.
 */
import type {
  ClickatonItemFulfillmentStatus,
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import {
  paymentStatusLabel,
  registrationStatusLabel,
  registrationStatusTone,
} from "@/lib/admin-registration/ui/status-labels";
import {
  presentFulfillmentStatus,
  presentWelcomeCardStatus,
  type PublicStatusPresentation,
  type PublicStatusTone,
} from "@/lib/public-ux/status-presentation";

export type AdminAttentionLevel = "ok" | "watch" | "action" | "blocked";

export type AdminStatusPresentation = PublicStatusPresentation & {
  attention: AdminAttentionLevel;
};

export type AdminOperationalSummary = {
  key:
    | "all_set"
    | "needs_attention"
    | "kit_pending"
    | "incomplete"
    | "cancelled"
    | "waitlisted"
    | "payment_review";
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: AdminAttentionLevel;
  nextAction?: string;
};

const REG_ADMIN_EXTRA: Partial<
  Record<ClickatonRegistrationStatus, { description: string; nextAction?: string }>
> = {
  DRAFT: {
    description: "La inscripción quedó en borrador y todavía no está operativa.",
    nextAction: "Revisá datos o confirmá administrativamente si corresponde.",
  },
  PENDING_PAYMENT: {
    description: "Hay una reserva, pero el pago aún no está acreditado.",
    nextAction: "Esperá la confirmación del pago o revisá el detalle comercial.",
  },
  CONFIRMED: {
    description: "La inscripción está confirmada y puede operarse en sede.",
    nextAction: "Revisá kit, placa y comunicaciones si hace falta.",
  },
  WAITLISTED: {
    description: "La persona está en lista de espera.",
    nextAction: "Gestioná cupo o confirmá cuando haya lugar.",
  },
  CANCELLED: {
    description: "La inscripción fue cancelada y ya no está activa.",
  },
  REFUNDED: {
    description: "La inscripción figura reembolsada.",
  },
  DISQUALIFIED: {
    description: "La participación fue descalificada.",
  },
  EXPIRED: {
    description: "La reserva o el intento venció.",
    nextAction: "Si corresponde, pedí una nueva inscripción.",
  },
  REFUND_REQUESTED: {
    description: "Hay un pedido de reembolso en curso.",
    nextAction: "Revisá el caso antes de operar en sede.",
  },
  TRANSFERRED_TO_NEXT_EDITION: {
    description: "La inscripción fue trasladada a otra edición.",
  },
};

export function presentAdminRegistrationStatus(
  status: ClickatonRegistrationStatus | string,
): AdminStatusPresentation {
  const key = status as ClickatonRegistrationStatus;
  const tone = registrationStatusTone(key) as PublicStatusTone;
  const extra = REG_ADMIN_EXTRA[key];
  const attention: AdminAttentionLevel =
    key === "CONFIRMED"
      ? "ok"
      : key === "CANCELLED" || key === "REFUNDED" || key === "DISQUALIFIED" || key === "EXPIRED"
        ? "blocked"
        : key === "PENDING_PAYMENT" || key === "REFUND_REQUESTED" || key === "WAITLISTED"
          ? "action"
          : "watch";
  return {
    label: registrationStatusLabel(key),
    description:
      extra?.description ?? "Revisá el detalle de la inscripción para más información.",
    tone,
    attention,
    ...(extra?.nextAction ? { nextAction: extra.nextAction } : {}),
  };
}

export function presentAdminPaymentStatus(
  status: ClickatonPaymentStatus | string,
): AdminStatusPresentation {
  const key = status as ClickatonPaymentStatus;
  const label = paymentStatusLabel(key);
  const map: Record<
    ClickatonPaymentStatus,
    Omit<AdminStatusPresentation, "label">
  > = {
    NOT_REQUIRED: {
      description: "Esta inscripción no requiere cobro.",
      tone: "success",
      attention: "ok",
      isFinal: true,
    },
    PENDING: {
      description: "Todavía no hay cobro acreditado.",
      tone: "warning",
      attention: "action",
      nextAction: "Revisá si la persona debe completar el pago.",
    },
    PROCESSING: {
      description: "El cobro está en proceso. No fuerces un segundo cobro.",
      tone: "info",
      attention: "watch",
      nextAction: "Esperá unos minutos y actualizá el detalle.",
    },
    APPROVED: {
      description: "El pago está acreditado.",
      tone: "success",
      attention: "ok",
      isFinal: true,
    },
    FAILED: {
      description: "El cobro no se completó.",
      tone: "danger",
      attention: "action",
      nextAction: "Revisá el detalle o pedí un nuevo intento de pago.",
    },
    EXPIRED: {
      description: "El intento de cobro venció.",
      tone: "warning",
      attention: "action",
    },
    CANCELLED: {
      description: "El cobro fue cancelado.",
      tone: "warning",
      attention: "blocked",
    },
    REFUNDED: {
      description: "El cobro fue reembolsado.",
      tone: "neutral",
      attention: "blocked",
      isFinal: true,
    },
    PARTIALLY_REFUNDED: {
      description: "Hay un reembolso parcial registrado.",
      tone: "neutral",
      attention: "watch",
    },
    MANUAL_REVIEW: {
      description: "El cobro requiere revisión manual.",
      tone: "warning",
      attention: "action",
      nextAction: "Revisá inconsistencias antes de operar.",
    },
  };
  const base = map[key];
  if (!base) {
    return {
      label: label || "Estado del pago",
      description: "Revisá el detalle comercial.",
      tone: "neutral",
      attention: "watch",
    };
  }
  return { label, ...base };
}

export function presentAdminFulfillmentStatus(
  status: ClickatonItemFulfillmentStatus | string | null | undefined,
): AdminStatusPresentation {
  const label = presentFulfillmentStatus(status);
  switch (status) {
    case "DELIVERED":
      return {
        label,
        description: "El producto ya fue entregado en sede.",
        tone: "success",
        attention: "ok",
        isFinal: true,
      };
    case "READY":
      return {
        label,
        description: "El kit está listo para entregar.",
        tone: "info",
        attention: "action",
        nextAction: "Entregá el producto y registrá la entrega.",
      };
    case "CANCELLED":
      return {
        label,
        description: "La entrega de este ítem fue cancelada.",
        tone: "neutral",
        attention: "blocked",
      };
    case "RETURNED":
      return {
        label,
        description: "El ítem figura como devuelto.",
        tone: "warning",
        attention: "watch",
      };
    case "PENDING":
    default:
      return {
        label: status ? label : "Pendiente de entrega",
        description: "Todavía no se registró la entrega del kit.",
        tone: "warning",
        attention: "action",
        nextAction: "Marcá como entregado cuando lo entregues en sede.",
      };
  }
}

export function presentAdminWelcomeCardStatus(
  status: string | null | undefined,
): AdminStatusPresentation {
  const base = presentWelcomeCardStatus(status);
  const adminLabel =
    status === "GENERATED"
      ? "Placa disponible"
      : status === "FAILED"
        ? "Placa con error"
        : status === "PENDING" || !status
          ? "Placa pendiente"
          : base.label;
  return {
    ...base,
    label: adminLabel,
    attention:
      status === "GENERATED" ? "ok" : status === "FAILED" ? "action" : "watch",
  };
}

export function presentAdminEmailQueueStatus(
  status: string | null | undefined,
): AdminStatusPresentation {
  // Distingue enviado vs entregado (Imp. 08). No afirma entrega si solo fue aceptado.
  switch (status) {
    case "DELIVERED":
      return {
        label: "Correo entregado",
        description: "El proveedor informó que el mensaje llegó correctamente.",
        tone: "success",
        attention: "ok",
      };
    case "SENT":
      return {
        label: "Correo enviado",
        description:
          "El mensaje fue aceptado para su entrega. Todavía puede faltar la confirmación de llegada.",
        tone: "info",
        attention: "watch",
      };
    case "BOUNCED":
      return {
        label: "No pudo entregarse",
        description: "El correo fue rechazado por el servidor de destino.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá la dirección del participante antes de volver a enviarlo.",
      };
    case "FAILED":
      return {
        label: "No pudimos enviar el correo",
        description: "El participante todavía no recibió este mensaje.",
        tone: "danger",
        attention: "action",
        nextAction: "Reenviá la confirmación si la dirección es correcta.",
      };
    case "PENDING":
    case "QUEUED":
      return {
        label: "Preparando envío",
        description: "El mensaje todavía no salió del sistema.",
        tone: "warning",
        attention: "watch",
      };
    default:
      return {
        label: status ? "Estado del correo a revisar" : "Sin correo registrado",
        description: "No hay un envío reciente asociado a esta inscripción.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export function presentAdminFotoRankSyncStatus(
  status: string | null | undefined,
): AdminStatusPresentation {
  switch (status) {
    case "SYNCED":
    case "COMPLETED":
    case "SUCCESS":
      return {
        label: "Sincronizado con FotoRank",
        description: "La inscripción ya está vinculada para la competencia.",
        tone: "success",
        attention: "ok",
      };
    case "FAILED":
    case "ERROR":
      return {
        label: "Error de sincronización",
        description: "No se pudo sincronizar con FotoRank.",
        tone: "danger",
        attention: "action",
        nextAction: "Reintentá la sincronización desde este detalle.",
      };
    case "PENDING":
    case "RETRY_PENDING":
      return {
        label: "Sincronización pendiente",
        description: "Todavía no se completó el vínculo con FotoRank.",
        tone: "warning",
        attention: "watch",
      };
    default:
      return {
        label: status ? "Estado FotoRank" : "Sin sincronización",
        description: "No hay sincronización registrada todavía.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

/**
 * Síntesis operativa de presentación (no se persiste).
 * Criterios documentados en docs/clickaton/ux-improvements/admin-status-map.md
 *
 * Nota: el listado admin actual no incluye check-in; la acreditación
 * se opera en el módulo de acreditación / detalle cuando exista el dato.
 */
export function presentAdminOperationalSummary(input: {
  registrationStatus: ClickatonRegistrationStatus | string;
  paymentStatus: ClickatonPaymentStatus | string;
  fulfillmentStatus?: ClickatonItemFulfillmentStatus | string | null;
}): AdminOperationalSummary {
  const reg = input.registrationStatus;
  const pay = input.paymentStatus;
  const kit = input.fulfillmentStatus;

  if (
    reg === "CANCELLED" ||
    reg === "REFUNDED" ||
    reg === "DISQUALIFIED" ||
    reg === "EXPIRED"
  ) {
    return {
      key: "cancelled",
      label: "Cancelada / inactiva",
      description: "Esta inscripción ya no está activa para operar en sede.",
      tone: "danger",
      attention: "blocked",
    };
  }

  if (reg === "WAITLISTED") {
    return {
      key: "waitlisted",
      label: "Lista de espera",
      description: "La persona espera cupo.",
      tone: "warning",
      attention: "action",
      nextAction: "Gestioná el cupo o confirmá cuando corresponda.",
    };
  }

  if (pay === "MANUAL_REVIEW" || pay === "FAILED") {
    return {
      key: "payment_review",
      label: "Requiere atención",
      description:
        pay === "FAILED"
          ? "El pago falló o no se acreditó."
          : "El pago necesita revisión manual.",
      tone: "danger",
      attention: "action",
      nextAction: "Abrí el detalle y revisá el bloque de pago.",
    };
  }

  if (reg === "DRAFT" || reg === "PENDING_PAYMENT" || pay === "PENDING" || pay === "PROCESSING") {
    return {
      key: "incomplete",
      label: "Inscripción incompleta",
      description: "Falta confirmar el pago o completar la inscripción.",
      tone: "warning",
      attention: "action",
      nextAction: "Revisá el pago o las acciones administrativas disponibles.",
    };
  }

  if (reg === "CONFIRMED" && (pay === "APPROVED" || pay === "NOT_REQUIRED")) {
    if (kit && kit !== "DELIVERED" && kit !== "CANCELLED") {
      return {
        key: "kit_pending",
        label: "Kit pendiente",
        description: "La inscripción está confirmada, pero la entrega del kit sigue pendiente.",
        tone: "warning",
        attention: "action",
        nextAction: "Entregá el kit en sede y registralo.",
      };
    }
    return {
      key: "all_set",
      label: "Todo listo",
      description: "Inscripción confirmada y pago en orden. Revisá acreditación en el módulo de sede.",
      tone: "success",
      attention: "ok",
      nextAction: "Operá acreditación o kit según el flujo del evento.",
    };
  }

  return {
    key: "needs_attention",
    label: "Requiere atención",
    description: "Hay un estado que conviene revisar antes de operar.",
    tone: "warning",
    attention: "action",
    nextAction: "Abrí el detalle de la inscripción.",
  };
}

export function adminToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

export function displayAdminValue(value: string | null | undefined, empty = "No informado"): string {
  if (value == null || String(value).trim() === "") return empty;
  return String(value);
}

export function presentAdminResendClassification(
  classification: string | null | undefined,
): AdminStatusPresentation {
  switch (classification) {
    case "DELIVERED":
      return {
        label: "Entregado al buzón",
        description: "El proveedor confirmó la entrega del correo.",
        tone: "success",
        attention: "ok",
      };
    case "SENT":
      return {
        label: "Enviado",
        description: "El correo salió del proveedor. Todavía no hay confirmación de entrega.",
        tone: "info",
        attention: "watch",
      };
    case "DELIVERY_DELAYED":
      return {
        label: "Entrega demorada",
        description: "El proveedor reportó demora en la entrega.",
        tone: "warning",
        attention: "watch",
      };
    case "BOUNCED":
      return {
        label: "Rebotó",
        description: "El correo no llegó. Revisá la dirección e intentá reenviar.",
        tone: "danger",
        attention: "action",
        nextAction: "Reenviá la confirmación si el email es correcto.",
      };
    case "SUPPRESSED":
      return {
        label: "Bloqueado por el proveedor",
        description: "El proveedor no permite enviar a esta dirección por ahora.",
        tone: "danger",
        attention: "action",
      };
    case "FAILED":
      return {
        label: "Falló el envío",
        description: "El último intento de correo no se completó.",
        tone: "danger",
        attention: "action",
        nextAction: "Reenviá la confirmación.",
      };
    default:
      return {
        label: "Sin confirmación de entrega",
        description: "No hay un evento de entrega claro todavía.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export function presentAdminPublicationStatus(
  status: string | null | undefined,
): AdminStatusPresentation {
  switch (status) {
    case "PUBLISHED":
      return {
        label: "Publicada",
        description: "El contenido ya fue publicado o confirmado.",
        tone: "success",
        attention: "ok",
      };
    case "SCHEDULED":
      return {
        label: "Programada",
        description: "La publicación se realizará en la fecha y hora indicadas.",
        tone: "info",
        attention: "watch",
      };
    case "PENDING_APPROVAL":
      return {
        label: "Listo para revisar",
        description: "La pieza está preparada y espera aprobación del equipo.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá la vista previa en Publicaciones en redes sociales.",
      };
    case "APPROVED":
      return {
        label: "Aprobada",
        description: "Aprobada para publicarse según la programación o el modo activo.",
        tone: "info",
        attention: "watch",
      };
    case "FAILED":
      return {
        label: "No pudimos confirmar la publicación",
        description:
          "El contenido pudo haberse enviado. Revisá Instagram antes de reintentar.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá la cola social antes de volver a intentar.",
      };
    case "CANCELLED":
      return {
        label: "Cancelada",
        description: "Esta solicitud no se publicará.",
        tone: "neutral",
        attention: "ok",
      };
    case "REJECTED":
      return {
        label: "Rechazada",
        description: "El equipo rechazó esta publicación.",
        tone: "neutral",
        attention: "watch",
      };
    case "NOT_SCHEDULED":
      return {
        label: "Sin programación",
        description: "Todavía no hay una publicación programada para esta pieza.",
        tone: "neutral",
        attention: "watch",
      };
    case "PENDING":
    case "QUEUED":
      return {
        label: "En cola",
        description: "La solicitud está en espera de procesamiento.",
        tone: "warning",
        attention: "watch",
      };
    default:
      return {
        label: status ? "Estado de publicación a revisar" : "Sin publicación",
        description: "No hay solicitud de publicación registrada.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export const FULFILLMENT_FILTER_OPTIONS: Array<{
  value: ClickatonItemFulfillmentStatus;
  label: string;
}> = [
  { value: "PENDING", label: "Pendiente de entrega" },
  { value: "READY", label: "Listo para entregar" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "CANCELLED", label: "Entrega cancelada" },
];
