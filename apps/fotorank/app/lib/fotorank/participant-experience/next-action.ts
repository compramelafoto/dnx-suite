import type { UploadWindowView } from "./upload-window";

export type ParticipantActionVariant = "primary" | "secondary" | "ghost";

export type ParticipantNextAction = {
  key: string;
  label: string;
  href: string;
  variant: ParticipantActionVariant;
  enabled: boolean;
  blockedReason?: string;
};

export type NextActionInput = {
  registrationId: string;
  contestSlug: string;
  registrationStatus: string;
  entryStatus?: string | null;
  manualReviewStatus?: string | null;
  admissionStatus?: string | null;
  upload: UploadWindowView;
  resultsPublished?: boolean;
  needsRulesReacceptance?: boolean;
  /** En detalle, evita CTA “Ver detalle” autorreferencial. */
  surface?: "list" | "detail";
  /** Lugares libres del cupo de obras. Ausente = 0 (concurso de una foto). */
  remainingEntries?: number;
};

/**
 * Acción dominante contextual. Evita CTAs activos hacia fases cerradas.
 */
export function resolveParticipantNextAction(input: NextActionInput): ParticipantNextAction {
  const detailHref = `/participaciones/${input.registrationId}`;
  const contestHref = `/concursos/${input.contestSlug}`;
  const basesHref = `/concursos/${input.contestSlug}#bases`;
  const inscriptionHref = `/concursos/${input.contestSlug}/inscripcion`;
  const resultsHref = `/concursos/${input.contestSlug}/resultados`;
  const onDetail = input.surface === "detail";

  if (input.registrationStatus === "CANCELLED" || input.registrationStatus === "DISQUALIFIED") {
    return {
      key: onDetail ? "view_contest" : "view_detail",
      label: onDetail ? "Ver concurso" : "Consultar participación",
      href: onDetail ? contestHref : detailHref,
      variant: "primary",
      enabled: true,
    };
  }

  if (input.needsRulesReacceptance && input.registrationStatus === "CONFIRMED") {
    return {
      key: "reaccept_rules",
      label: "Aceptar nuevas Bases",
      href: detailHref,
      variant: "primary",
      enabled: true,
      blockedReason:
        "Hay una nueva versión de Bases y Condiciones. Debés aceptarlas expresamente antes de continuar.",
    };
  }

  if (
    input.registrationStatus === "DRAFT" ||
    input.registrationStatus === "PENDING_PAYMENT" ||
    input.registrationStatus === "PENDING"
  ) {
    return {
      key: "complete_registration",
      label: "Completar inscripción",
      href: inscriptionHref,
      variant: "primary",
      enabled: true,
    };
  }

  if (input.resultsPublished) {
    return {
      key: "view_results",
      label: "Consultar resultado",
      href: resultsHref,
      variant: "primary",
      enabled: true,
    };
  }

  if (input.manualReviewStatus === "REPLACEMENT_REQUESTED") {
    if (input.upload.isOpen) {
      return {
        key: "correct_photo",
        label: "Corregir fotografía",
        href: inscriptionHref,
        variant: "primary",
        enabled: true,
      };
    }
    return {
      key: onDetail ? "view_bases" : "view_detail",
      label: onDetail ? "Consultar bases" : "Ver detalle",
      href: onDetail ? basesHref : detailHref,
      variant: "primary",
      enabled: true,
      blockedReason: "La corrección requiere que la ventana de carga esté abierta.",
    };
  }

  /**
   * Una obra rechazada no tiene “carga” que continuar: o se vuelve a subir
   * mientras la ventana esté abierta, o sólo queda consultar el detalle. Antes
   * caía en “Continuar carga” porque el estado de la obra y el de admisión
   * podían quedar desfasados (obra en PROCESSING con admisión REJECTED).
   */
  if (input.admissionStatus === "REJECTED" || input.entryStatus === "REJECTED") {
    if (input.upload.isOpen) {
      return {
        key: "reupload_photo",
        label: "Volver a cargar",
        href: inscriptionHref,
        variant: "primary",
        enabled: true,
      };
    }
    return {
      key: onDetail ? "view_bases" : "view_detail",
      label: onDetail ? "Consultar bases" : "Ver detalle",
      href: onDetail ? basesHref : detailHref,
      variant: "primary",
      enabled: true,
    };
  }

  const entry = input.entryStatus;
  if (entry && ["DRAFT", "UPLOADED", "PROCESSING", "READY_TO_CONFIRM", "REQUIRES_REVIEW"].includes(entry)) {
    if (input.upload.isOpen) {
      return {
        key: entry === "READY_TO_CONFIRM" ? "review_submission" : "continue_upload",
        label: entry === "READY_TO_CONFIRM" ? "Revisar envío" : "Continuar carga",
        href: inscriptionHref,
        variant: "primary",
        enabled: true,
      };
    }
    return {
      key: onDetail ? "view_bases" : "view_detail",
      label: onDetail ? "Consultar bases" : "Ver detalle",
      href: onDetail ? basesHref : detailHref,
      variant: "primary",
      enabled: true,
    };
  }

  if (entry === "CONFIRMED" || input.admissionStatus === "ADMITTED" || input.admissionStatus === "FROZEN_FOR_JURY") {
    // Concursos de varias fotos: la primera ya está enviada, pero el cupo no.
    if (input.upload.isOpen && (input.remainingEntries ?? 0) > 0) {
      return {
        key: "add_photo",
        label: "Subir otra fotografía",
        href: inscriptionHref,
        variant: "primary",
        enabled: true,
      };
    }
    return {
      key: onDetail ? "view_contest" : "view_detail",
      label: onDetail ? "Ver concurso" : "Consultar participación",
      href: onDetail ? contestHref : detailHref,
      variant: "primary",
      enabled: true,
    };
  }

  if (input.registrationStatus === "CONFIRMED") {
    if (input.upload.isOpen && !entry) {
      return {
        key: "upload_photos",
        label: "Cargar fotografías",
        href: inscriptionHref,
        variant: "primary",
        enabled: true,
      };
    }
    return {
      key: onDetail ? "view_bases" : "view_detail",
      label: onDetail ? "Consultar bases" : "Ver detalle",
      href: onDetail ? basesHref : detailHref,
      variant: "primary",
      enabled: true,
    };
  }

  return {
    key: "view_contest",
    label: "Ver concurso",
    href: contestHref,
    variant: "primary",
    enabled: true,
  };
}

export function resolveSecondaryActions(input: NextActionInput): ParticipantNextAction[] {
  const detailHref = `/participaciones/${input.registrationId}`;
  const contestHref = `/concursos/${input.contestSlug}`;
  const basesHref = `/concursos/${input.contestSlug}#bases`;
  const primary = resolveParticipantNextAction(input);

  const all: ParticipantNextAction[] = [
    {
      key: "view_detail",
      label: "Ver detalle",
      href: detailHref,
      variant: "secondary",
      enabled: true,
    },
    {
      key: "view_contest",
      label: "Ver concurso",
      href: contestHref,
      variant: "secondary",
      enabled: true,
    },
    {
      key: "view_bases",
      label: "Consultar bases",
      href: basesHref,
      variant: "ghost",
      enabled: true,
    },
  ];

  return all.filter((a) => a.href !== primary.href || a.key !== primary.key);
}
