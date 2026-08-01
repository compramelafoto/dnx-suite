/**
 * Presentación UX — placas, publicaciones sociales y correos (Etapa 02 Imp. 08).
 * Solo etiquetas y síntesis; no altera jobs, publisher, Resend ni estados persistidos.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";

export type SocialCommAttention = "ok" | "watch" | "action" | "blocked";

export type SocialCommunicationsStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: SocialCommAttention;
  nextAction?: string;
  ready: boolean;
  sentOrPublished: boolean;
  needsAttention: boolean;
  canRetry: boolean;
  duplicationRisk: boolean;
};

export function socialToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function formatSocialDateTime(
  value: Date | string | null | undefined,
  timezone = DEFAULT_TZ,
): string {
  if (value == null || value === "") return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function presentSocialPublisherLiveMode(live: boolean): {
  label: string;
  description: string;
  tone: PublicStatusTone;
  canPublishNow: boolean;
} {
  if (live) {
    return {
      label: "Publicación automática habilitada",
      description:
        "Cuando una pieza esté aprobada o programada, el sistema podrá enviarla a la red social según la integración.",
      tone: "success",
      canPublishNow: true,
    };
  }
  return {
    label: "Publicación automática desactivada",
    description:
      "Las piezas pueden prepararse y revisarse, pero no se publicarán automáticamente en redes sociales.",
    tone: "warning",
    canPublishNow: false,
  };
}

export function presentSocialPublishStatus(
  status: string | null | undefined,
): SocialCommunicationsStatusPresentation {
  switch (status) {
    case "PENDING_APPROVAL":
      return {
        key: "pending_approval",
        label: "Listo para revisar",
        description: "La pieza está preparada y espera aprobación del equipo.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá la vista previa y aprobá o rechazá la publicación.",
        ready: true,
        sentOrPublished: false,
        needsAttention: true,
        canRetry: false,
        duplicationRisk: false,
      };
    case "APPROVED":
      return {
        key: "approved",
        label: "Aprobada",
        description: "Aprobada para publicarse según la programación o el modo activo.",
        tone: "info",
        attention: "watch",
        nextAction: "Programá la fecha o esperá el proceso automático si está habilitado.",
        ready: true,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    case "SCHEDULED":
      return {
        key: "scheduled",
        label: "Programada",
        description: "La publicación se realizará en la fecha y hora indicadas.",
        tone: "info",
        attention: "watch",
        ready: true,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    case "PUBLISHED":
      return {
        key: "published",
        label: "Publicada",
        description: "El contenido ya fue publicado o confirmado por el sistema.",
        tone: "success",
        attention: "ok",
        ready: true,
        sentOrPublished: true,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: true,
      };
    case "FAILED":
      return {
        key: "failed",
        label: "No pudimos confirmar la publicación",
        description:
          "El contenido pudo haberse enviado. Revisá la cuenta de Instagram antes de volver a intentar.",
        tone: "danger",
        attention: "action",
        nextAction: "Consultá el estado y solo reintentá si confirmás que no se publicó.",
        ready: false,
        sentOrPublished: false,
        needsAttention: true,
        canRetry: true,
        duplicationRisk: true,
      };
    case "CANCELLED":
      return {
        key: "cancelled",
        label: "Cancelada",
        description: "Esta solicitud no se publicará.",
        tone: "neutral",
        attention: "ok",
        ready: false,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    case "REJECTED":
      return {
        key: "rejected",
        label: "Rechazada",
        description: "El equipo rechazó esta publicación.",
        tone: "neutral",
        attention: "watch",
        ready: false,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    case "NOT_SCHEDULED":
      return {
        key: "not_scheduled",
        label: "Sin programación",
        description: "Todavía no hay una publicación programada para esta pieza.",
        tone: "neutral",
        attention: "watch",
        ready: false,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    case "PENDING":
    case "QUEUED":
      return {
        key: "queued",
        label: "En cola",
        description: "La solicitud está en espera de procesamiento.",
        tone: "warning",
        attention: "watch",
        ready: false,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    default:
      return {
        key: "unknown",
        label: status ? "Estado de publicación a revisar" : "Sin publicación",
        description: "No hay una solicitud de publicación clara registrada.",
        tone: "neutral",
        attention: "watch",
        ready: false,
        sentOrPublished: false,
        needsAttention: Boolean(status),
        canRetry: false,
        duplicationRisk: false,
      };
  }
}

export function presentSocialEntityType(entityType: string | null | undefined): {
  label: string;
  publicationType: string;
} {
  switch (entityType) {
    case "WELCOME_CARD":
      return {
        label: "Placa de bienvenida",
        publicationType: "Historia",
      };
    default:
      return {
        label: entityType ? "Pieza social" : "Pieza",
        publicationType: "Contenido listo para compartir",
      };
  }
}

export const SOCIAL_PUBLISH_STATUS_FILTER_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "PENDING_APPROVAL", label: "Listo para revisar" },
  { value: "APPROVED", label: "Aprobada" },
  { value: "SCHEDULED", label: "Programada" },
  { value: "PUBLISHED", label: "Publicada" },
  { value: "FAILED", label: "Con error" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "REJECTED", label: "Rechazada" },
];

export function presentWelcomeCardAdminActionLabels(hasCard: boolean): {
  generate: string;
  regenerate: string;
  retry: string;
  approve: string;
  reject: string;
} {
  return {
    generate: "Generar placa",
    regenerate: "Volver a generar",
    retry: hasCard ? "Volver a intentar la generación" : "Generar placa",
    approve: "Aprobar placa",
    reject: "Rechazar placa",
  };
}

export function presentEmailQueueOperationalStatus(
  status: string | null | undefined,
): SocialCommunicationsStatusPresentation {
  switch (status) {
    case "DELIVERED":
      return {
        key: "email_delivered",
        label: "Correo entregado",
        description: "El proveedor informó que el mensaje llegó correctamente.",
        tone: "success",
        attention: "ok",
        ready: true,
        sentOrPublished: true,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: true,
      };
    case "SENT":
      return {
        key: "email_sent",
        label: "Correo enviado",
        description:
          "El mensaje fue aceptado para su entrega. Todavía puede faltar la confirmación de llegada.",
        tone: "info",
        attention: "watch",
        ready: true,
        sentOrPublished: true,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: true,
      };
    case "BOUNCED":
      return {
        key: "email_bounced",
        label: "No pudo entregarse",
        description: "El correo fue rechazado por el servidor de destino.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá la dirección del participante antes de volver a enviarlo.",
        ready: false,
        sentOrPublished: false,
        needsAttention: true,
        canRetry: true,
        duplicationRisk: true,
      };
    case "FAILED":
      return {
        key: "email_failed",
        label: "No pudimos enviar el correo",
        description: "El participante todavía no recibió este mensaje.",
        tone: "danger",
        attention: "action",
        nextAction: "Reenviá el correo si la dirección es correcta.",
        ready: false,
        sentOrPublished: false,
        needsAttention: true,
        canRetry: true,
        duplicationRisk: true,
      };
    case "PENDING":
    case "QUEUED":
      return {
        key: "email_queued",
        label: "Preparando envío",
        description: "El mensaje todavía no salió del sistema.",
        tone: "warning",
        attention: "watch",
        ready: false,
        sentOrPublished: false,
        needsAttention: false,
        canRetry: false,
        duplicationRisk: false,
      };
    default:
      return {
        key: "email_unknown",
        label: status ? "Estado del correo a revisar" : "Sin correo registrado",
        description: "No hay un envío reciente asociado.",
        tone: "neutral",
        attention: "watch",
        ready: false,
        sentOrPublished: false,
        needsAttention: Boolean(status),
        canRetry: false,
        duplicationRisk: false,
      };
  }
}

export function presentAccreditationWindow(canCheckIn: boolean | null | undefined): {
  label: string;
  description: string;
} {
  if (canCheckIn == null) {
    return {
      label: "Horario a confirmar",
      description: "Todavía no está definida la ventana de acreditación.",
    };
  }
  if (canCheckIn) {
    return {
      label: "Ventana abierta",
      description: "Se puede acreditar participantes en sede ahora.",
    };
  }
  return {
    label: "Ventana cerrada",
    description: "Fuera del horario de acreditación configurado.",
  };
}

export function presentAccreditationEligibilityReason(
  reason: string | null | undefined,
): { label: string; description: string } {
  switch (reason) {
    case "READY":
      return {
        label: "Lista para acreditar",
        description: "El participante puede completar el check-in.",
      };
    case "CREDENTIAL_MISSING":
      return {
        label: "Falta la credencial",
        description: "Todavía no hay un código QR activo para esta inscripción.",
      };
    case "PAYMENT_PENDING":
      return {
        label: "Pago pendiente",
        description: "El pago todavía no está acreditado.",
      };
    case "WINDOW_CLOSED":
      return {
        label: "Fuera de horario",
        description: "La ventana de acreditación no está abierta.",
      };
    case "ALREADY_CHECKED_IN":
      return {
        label: "Ya acreditado",
        description: "Este participante ya completó el check-in.",
      };
    case "ACCREDITATION_DISABLED":
      return {
        label: "Acreditación deshabilitada",
        description: "El módulo de acreditación no está habilitado para esta edición.",
      };
    case "REGISTRATION_INACTIVE":
      return {
        label: "Inscripción inactiva",
        description: "La inscripción no está en un estado operable para sede.",
      };
    case "DISQUALIFIED":
      return {
        label: "Descalificado",
        description: "La participación fue invalidada.",
      };
    case "NOT_CONFIRMED":
      return {
        label: "Inscripción no confirmada",
        description: "La inscripción todavía no está confirmada.",
      };
    case "CREDENTIAL_REVOKED":
      return {
        label: "Credencial revocada",
        description: "El QR ya no es válido.",
      };
    default:
      return {
        label: reason ? "Revisar acreditación" : "Sin motivo",
        description: "Revisá el detalle técnico si necesitás más información.",
      };
  }
}

export const LEGAL_REVIEW_NOTE =
  "Uso de nombre, imagen, Instagram y publicación en redes requiere consentimiento válido. No asumir etiquetado ni publicación automática.";

export const SOCIAL_SENSITIVE_CONFIRM = {
  approve:
    "¿Aprobar esta publicación? Podrá programarse o enviarse según el modo de publicación activo. Revisá la vista previa antes de continuar.",
  reject: "¿Rechazar esta publicación? No se enviará a redes sociales.",
  cancel: "¿Cancelar esta solicitud? No se publicará este contenido.",
  retry:
    "¿Volver a intentar la publicación? Si el contenido ya se envió a Instagram, podrías generar un duplicado. Revisá la cuenta antes de continuar.",
  duplicate:
    "¿Duplicar esta solicitud? Se creará una nueva preparación. No publica automáticamente.",
  schedule: "¿Programar esta publicación para la fecha indicada?",
  regenerateWelcome:
    "¿Volver a generar la placa? Se creará una nueva versión con los datos actuales. Las descargas anteriores pueden quedar desactualizadas. No se publica automáticamente.",
  retryWelcome:
    "¿Volver a intentar la generación? Los datos del participante siguen guardados. No se envía ni publica automáticamente.",
  approveWelcome: "¿Aprobar esta placa para el flujo editorial?",
  rejectWelcome: "¿Rechazar esta placa? Deberá generarse nuevamente si corresponde.",
  resendEmail:
    "¿Reenviar el correo de confirmación? El participante recibirá un nuevo mensaje. Puede duplicar comunicaciones si ya lo recibió.",
} as const;
