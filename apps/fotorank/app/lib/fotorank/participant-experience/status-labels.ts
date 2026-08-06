import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  CircleAlert,
  CircleDashed,
  ClipboardCheck,
  CreditCard,
  FileCheck,
  Lock,
  Send,
  ShieldCheck,
  Trophy,
} from "lucide-react";

export type ParticipantStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "locked";

export type ParticipantStatusPresentation = {
  /** Label pública — nunca el enum crudo. */
  label: string;
  description: string;
  tone: ParticipantStatusTone;
  icon: LucideIcon;
  priority: number;
};

const UNKNOWN: ParticipantStatusPresentation = {
  label: "Estado no disponible",
  description: "Consultá el detalle de tu participación o las bases del concurso.",
  tone: "neutral",
  icon: CircleDashed,
  priority: 0,
};

const REGISTRATION: Record<string, ParticipantStatusPresentation> = {
  DRAFT: {
    label: "Borrador",
    description: "La inscripción todavía no está completa.",
    tone: "warning",
    icon: CircleDashed,
    priority: 40,
  },
  PENDING_PAYMENT: {
    label: "Pago pendiente",
    description: "Falta completar el pago para confirmar la inscripción.",
    tone: "warning",
    icon: CreditCard,
    priority: 50,
  },
  CONFIRMED: {
    label: "Confirmada",
    description: "Tu inscripción está confirmada.",
    tone: "success",
    icon: ClipboardCheck,
    priority: 80,
  },
  CANCELLED: {
    label: "Cancelada",
    description: "Esta participación fue cancelada.",
    tone: "danger",
    icon: Ban,
    priority: 10,
  },
  DISQUALIFIED: {
    label: "Descalificada",
    description: "Esta participación no puede continuar.",
    tone: "danger",
    icon: Ban,
    priority: 5,
  },
};

const ENTRY: Record<string, ParticipantStatusPresentation> = {
  DRAFT: {
    label: "Borrador",
    description: "Tenés una fotografía en borrador. Podés continuar cuando la carga esté abierta.",
    tone: "warning",
    icon: CircleDashed,
    priority: 55,
  },
  UPLOADED: {
    label: "Archivo recibido",
    description: "Recibimos tu archivo. Una carga exitosa no implica admisión.",
    tone: "info",
    icon: FileCheck,
    priority: 60,
  },
  PROCESSING: {
    label: "En proceso",
    description: "Estamos procesando tu archivo.",
    tone: "info",
    icon: CircleDashed,
    priority: 58,
  },
  REQUIRES_REVIEW: {
    label: "En revisión",
    description: "Tu obra requiere revisión del organizador.",
    tone: "warning",
    icon: CircleAlert,
    priority: 65,
  },
  READY_TO_CONFIRM: {
    label: "Lista para confirmar",
    description: "Podés confirmar el envío de tu fotografía.",
    tone: "info",
    icon: Send,
    priority: 70,
  },
  CONFIRMED: {
    label: "Enviada",
    description: "Tu envío fue recibido.",
    tone: "success",
    icon: BadgeCheck,
    priority: 75,
  },
  REJECTED: {
    label: "No admitida",
    description: "Tu obra no fue admitida. Consultá el motivo público si está disponible.",
    tone: "danger",
    icon: CircleAlert,
    priority: 20,
  },
  WITHDRAWN: {
    label: "Retirada",
    description: "Retiraste esta obra.",
    tone: "neutral",
    icon: Ban,
    priority: 15,
  },
  REPLACED: {
    label: "Reemplazada",
    description: "Esta obra fue reemplazada por una versión posterior.",
    tone: "neutral",
    icon: CircleDashed,
    priority: 15,
  },
};

const PAYMENT: Record<string, ParticipantStatusPresentation> = {
  NOT_REQUIRED: {
    label: "Sin pago",
    description: "Esta inscripción no requiere cobro.",
    tone: "neutral",
    icon: BadgeCheck,
    priority: 1,
  },
  PENDING: {
    label: "Pago pendiente",
    description: "El pago todavía no está confirmado.",
    tone: "warning",
    icon: CreditCard,
    priority: 50,
  },
  PAID: {
    label: "Pagado",
    description: "El pago está confirmado.",
    tone: "success",
    icon: BadgeCheck,
    priority: 40,
  },
  FAILED: {
    label: "Pago fallido",
    description: "Hubo un problema con el pago.",
    tone: "danger",
    icon: CircleAlert,
    priority: 55,
  },
  REFUNDED: {
    label: "Reembolsado",
    description: "El pago fue reembolsado.",
    tone: "neutral",
    icon: Ban,
    priority: 10,
  },
};

export function presentRegistrationStatus(status: string): ParticipantStatusPresentation {
  return REGISTRATION[status] ?? { ...UNKNOWN, label: "Inscripción" };
}

export function presentEntryStatus(status: string | null | undefined): ParticipantStatusPresentation {
  if (!status) {
    return {
      label: "Sin fotografía",
      description: "Todavía no cargaste una fotografía.",
      tone: "neutral",
      icon: Lock,
      priority: 30,
    };
  }
  return ENTRY[status] ?? { ...UNKNOWN, label: "Fotografía" };
}

export function presentPaymentStatus(status: string): ParticipantStatusPresentation {
  return PAYMENT[status] ?? UNKNOWN;
}

/** Etiqueta principal de la card/detalle (prioriza corrección / admisión cuando aplica). */
export function presentPrimaryParticipationStatus(input: {
  registrationStatus: string;
  entryStatus?: string | null;
  manualReviewStatus?: string | null;
  admissionStatus?: string | null;
}): ParticipantStatusPresentation {
  if (input.registrationStatus === "CANCELLED" || input.registrationStatus === "DISQUALIFIED") {
    return presentRegistrationStatus(input.registrationStatus);
  }
  if (input.manualReviewStatus === "REPLACEMENT_REQUESTED") {
    return {
      label: "Requiere corrección",
      description: "El organizador solicitó corregir o reemplazar la fotografía.",
      tone: "warning",
      icon: CircleAlert,
      priority: 90,
    };
  }
  if (input.admissionStatus === "ADMITTED") {
    return {
      label: "Admitida",
      description: "Tu obra fue admitida técnicamente.",
      tone: "success",
      icon: ShieldCheck,
      priority: 85,
    };
  }
  if (input.admissionStatus === "FROZEN_FOR_JURY") {
    return {
      label: "En evaluación",
      description: "Tu obra está en evaluación del jurado.",
      tone: "info",
      icon: Trophy,
      priority: 88,
    };
  }
  if (input.admissionStatus === "REJECTED" || input.entryStatus === "REJECTED") {
    return presentEntryStatus("REJECTED");
  }
  if (input.entryStatus) {
    return presentEntryStatus(input.entryStatus);
  }
  return presentRegistrationStatus(input.registrationStatus);
}
