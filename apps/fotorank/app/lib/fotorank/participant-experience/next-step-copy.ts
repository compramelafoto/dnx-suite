import { formatParticipantDate } from "./dates";
import type { UploadWindowView } from "./upload-window";

export type NextStepBlock = {
  title: string;
  message: string;
  tone: "success" | "info" | "warning" | "neutral" | "danger";
  facts: Array<{ label: string; value: string }>;
};

export type NextStepInput = {
  registrationStatus: string;
  categoryName: string;
  maxFiles: number;
  entryStatus?: string | null;
  manualReviewStatus?: string | null;
  publicRejectionReason?: string | null;
  upload: UploadWindowView;
  timezone?: string | null;
  needsRulesReacceptance?: boolean;
};

/**
 * Bloque “Qué tenés que hacer ahora” a partir del estado real.
 */
export function resolveNextStepBlock(input: NextStepInput): NextStepBlock {
  const maxLabel =
    input.maxFiles === 1 ? "1 fotografía" : `${input.maxFiles} fotografías`;
  const openLabel = formatParticipantDate(input.upload.opensAt, {
    includeTime: true,
    timeZone: input.timezone,
  });

  if (input.needsRulesReacceptance && input.registrationStatus === "CONFIRMED") {
    return {
      title: "Nuevas Bases y Condiciones",
      message:
        "Se publicó una nueva versión oficial de las Bases. Debés leerlas y aceptarlas expresamente antes de cargar o confirmar tu fotografía. No se registra aceptación automática.",
      tone: "warning",
      facts: [{ label: "Categoría", value: input.categoryName }],
    };
  }

  if (input.registrationStatus === "CANCELLED") {
    return {
      title: "Participación cancelada",
      message: "Esta inscripción no está activa.",
      tone: "danger",
      facts: [{ label: "Categoría", value: input.categoryName }],
    };
  }
  if (input.registrationStatus === "DISQUALIFIED") {
    return {
      title: "Participación descalificada",
      message: "Esta inscripción no puede continuar en el concurso.",
      tone: "danger",
      facts: [{ label: "Categoría", value: input.categoryName }],
    };
  }

  if (
    input.registrationStatus === "DRAFT" ||
    input.registrationStatus === "PENDING_PAYMENT" ||
    input.registrationStatus === "PENDING"
  ) {
    return {
      title: "Completá tu inscripción",
      message:
        input.registrationStatus === "PENDING_PAYMENT"
          ? "Falta confirmar el pago para dejar la inscripción lista."
          : "Todavía hay pasos pendientes para confirmar tu inscripción.",
      tone: "warning",
      facts: [{ label: "Categoría", value: input.categoryName }],
    };
  }

  if (input.manualReviewStatus === "REPLACEMENT_REQUESTED") {
    return {
      title: "Tenés que corregir tu fotografía",
      message: input.upload.isOpen
        ? "El organizador solicitó un reemplazo. Podés corregirla mientras la carga esté abierta."
        : "Hay una solicitud de corrección, pero la ventana de carga no está abierta.",
      tone: "warning",
      facts: [
        { label: "Categoría", value: input.categoryName },
        { label: "Máximo de obras", value: maxLabel },
      ],
    };
  }

  if (input.entryStatus === "REJECTED") {
    return {
      title: "Tu obra no fue admitida",
      message:
        input.publicRejectionReason?.trim() ||
        "Consultá el detalle y las bases. No se muestran notas internas del organizador.",
      tone: "danger",
      facts: [{ label: "Categoría", value: input.categoryName }],
    };
  }

  if (
    input.entryStatus === "CONFIRMED" ||
    input.entryStatus === "READY_TO_CONFIRM" ||
    input.entryStatus === "UPLOADED" ||
    input.entryStatus === "REQUIRES_REVIEW" ||
    input.entryStatus === "PROCESSING"
  ) {
    if (input.entryStatus === "READY_TO_CONFIRM" && input.upload.isOpen) {
      return {
        title: "Revisá y confirmá tu envío",
        message: "Tu archivo está listo para confirmar.",
        tone: "info",
        facts: [
          { label: "Categoría", value: input.categoryName },
          { label: "Máximo de obras", value: maxLabel },
        ],
      };
    }
    return {
      title: "Envío recibido",
      message: "Recibimos tu fotografía. No hace falta que hagas nada más por ahora, salvo que te indiquemos una corrección.",
      tone: "success",
      facts: [
        { label: "Categoría", value: input.categoryName },
        { label: "Máximo de obras", value: maxLabel },
      ],
    };
  }

  if (input.entryStatus === "DRAFT") {
    return {
      title: "Tenés un borrador",
      message: input.upload.isOpen
        ? "Podés continuar la carga de tu fotografía."
        : "Hay un borrador guardado. La carga no está habilitada en este momento.",
      tone: input.upload.isOpen ? "info" : "neutral",
      facts: [
        { label: "Categoría", value: input.categoryName },
        { label: "Máximo de obras", value: maxLabel },
        ...(openLabel && !input.upload.isOpen
          ? [{ label: "Apertura de carga", value: openLabel }]
          : []),
      ],
    };
  }

  // CONFIRMED registration, no entry
  if (input.registrationStatus === "CONFIRMED" && !input.upload.isOpen) {
    const phaseMsg =
      input.upload.phase === "closed"
        ? "La ventana de carga ya cerró."
        : input.upload.phase === "contest_closed"
          ? "El concurso ya no admite cargas."
          : "La carga de fotografías todavía no está habilitada.";

    return {
      title: "Tu inscripción está confirmada",
      message: `${phaseMsg} No tenés que hacer nada por ahora.`,
      tone: "success",
      facts: [
        { label: "Categoría", value: input.categoryName },
        { label: "Máximo de obras", value: maxLabel },
        ...(openLabel && input.upload.phase === "not_yet_open"
          ? [{ label: "Apertura de carga", value: openLabel }]
          : []),
      ],
    };
  }

  if (input.registrationStatus === "CONFIRMED" && input.upload.isOpen) {
    return {
      title: "Ya podés cargar tu fotografía",
      message: `En tu categoría podés presentar hasta ${maxLabel}.`,
      tone: "info",
      facts: [
        { label: "Categoría", value: input.categoryName },
        { label: "Máximo de obras", value: maxLabel },
      ],
    };
  }

  return {
    title: "Revisá el estado de tu participación",
    message: "Consultá el detalle para ver los próximos pasos.",
    tone: "neutral",
    facts: [{ label: "Categoría", value: input.categoryName }],
  };
}
