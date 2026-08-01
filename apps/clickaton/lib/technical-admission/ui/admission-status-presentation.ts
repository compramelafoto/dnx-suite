/**
 * Presentación administrativa de admisión técnica (Etapa 02 Imp. 05).
 * Solo deriva etiquetas; no cambia reglas, batch ni estados persistidos.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";
import type { HumanReason } from "@/lib/photo-upload/ui/submission-status-presentation";

export type AdmissionAttention = "ok" | "watch" | "action" | "blocked";

export type AdmissionStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: AdmissionAttention;
  nextAction?: string;
  needsHumanReview: boolean;
  canContinueToFotoRank: boolean;
  reversible: boolean;
  participantSees?: string;
};

export function admissionToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

export function presentAdmissionStatus(
  status: string | null | undefined,
): AdmissionStatusPresentation {
  switch (status) {
    case "NOT_EVALUATED":
      return {
        key: "not_evaluated",
        label: "Sin evaluar",
        description: "Todavía no se aplicó la admisión técnica a esta entrega.",
        tone: "neutral",
        attention: "watch",
        nextAction: "Evaluá el lote cuando corresponda.",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "PENDING_AUTOMATIC_REVIEW":
      return {
        key: "pending_auto",
        label: "En revisión automática",
        description: "El sistema está evaluando si la entrega puede continuar.",
        tone: "info",
        attention: "watch",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "PENDING_MANUAL_REVIEW":
      return {
        key: "pending_manual",
        label: "Requiere revisión técnica",
        description: "Hay condiciones que necesitan una decisión humana.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá los motivos antes de admitir o marcar como no válida.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
        participantSees: "Tu obra está en revisión técnica.",
      };
    case "ELIGIBLE":
      return {
        key: "eligible",
        label: "Elegible",
        description:
          "Cumple las condiciones técnicas para ser admitida. Todavía puede faltar el paso de admisión del lote.",
        tone: "success",
        attention: "ok",
        nextAction: "Podés admitir elegibles desde el lote.",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
      };
    case "ADMITTED":
      return {
        key: "admitted",
        label: "Aceptada técnicamente",
        description:
          "La obra fue admitida en la etapa técnica. Esto no determina si será finalista o ganadora.",
        tone: "success",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
        participantSees: "Tu obra fue admitida técnicamente.",
      };
    case "REJECTED":
      return {
        key: "rejected",
        label: "No admitida",
        description: "La obra no continúa en esta etapa técnica. Revisá el motivo.",
        tone: "danger",
        attention: "blocked",
        nextAction: "Revisá el motivo visible para el participante.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
        participantSees: "La obra no fue admitida en esta etapa.",
      };
    case "EXCLUDED":
      return {
        key: "excluded",
        label: "Excluida",
        description: "La organización excluyó esta obra del circuito técnico.",
        tone: "danger",
        attention: "blocked",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
        participantSees: "La obra fue excluida por la organización.",
      };
    case "WITHDRAWN":
      return {
        key: "withdrawn",
        label: "Retirada",
        description: "La obra fue retirada y no continúa.",
        tone: "neutral",
        attention: "blocked",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
        participantSees: "Retiraste esta obra.",
      };
    case "REPLACED":
      return {
        key: "replaced",
        label: "Reemplazada",
        description: "Esta versión fue reemplazada por otra.",
        tone: "neutral",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
        participantSees: "Esta versión fue reemplazada.",
      };
    case "FROZEN_FOR_JURY":
      return {
        key: "frozen",
        label: "Lista para el jurado",
        description:
          "La obra quedó congelada para evaluación del jurado. La admisión técnica ya no se modifica en este paso.",
        tone: "brand",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: false,
        participantSees: "Tu obra fue admitida técnicamente.",
      };
    default:
      return {
        key: "unknown",
        label: "Estado de admisión no reconocido",
        description: "Hay un estado interno que necesita revisión de soporte.",
        tone: "warning",
        attention: "action",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
  }
}

export function presentBatchStatus(status: string | null | undefined): AdmissionStatusPresentation {
  switch (status) {
    case "DRAFT":
      return {
        key: "batch_draft",
        label: "Lote en preparación",
        description: "El lote está abierto para evaluar y admitir entregas elegibles.",
        tone: "warning",
        attention: "action",
        nextAction: "Evaluá elegibles o cerrá el lote cuando corresponda.",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "PROCESSING":
      return {
        key: "batch_processing",
        label: "Lote en procesamiento",
        description: "El sistema está evaluando entregas de este lote.",
        tone: "info",
        attention: "watch",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "REVIEW_REQUIRED":
      return {
        key: "batch_review",
        label: "Lote con revisiones pendientes",
        description: "Hay entregas que necesitan una decisión humana antes de cerrar.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá las decisiones pendientes.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "READY_TO_CLOSE":
      return {
        key: "batch_ready",
        label: "Listo para cerrar",
        description: "El lote puede cerrarse cuando la organización lo confirme.",
        tone: "success",
        attention: "action",
        nextAction: "Cerrá el lote o congelá para el jurado.",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
      };
    case "CLOSED":
      return {
        key: "batch_closed",
        label: "Lote cerrado",
        description: "El lote ya no admite nuevas evaluaciones automáticas de este ciclo.",
        tone: "neutral",
        attention: "watch",
        nextAction: "Congelá para jurado si corresponde, o reabrí con motivo.",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
      };
    case "FROZEN":
      return {
        key: "batch_frozen",
        label: "Congelado para jurado",
        description: "El lote quedó listo para el circuito de jurado. No abre puntuaciones desde aquí.",
        tone: "success",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: false,
      };
    case "CANCELLED":
      return {
        key: "batch_cancelled",
        label: "Lote cancelado",
        description: "Este lote quedó cancelado y no continúa.",
        tone: "danger",
        attention: "blocked",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
      };
    default:
      return {
        key: "batch_none",
        label: status ? "Estado de lote a revisar" : "Sin lote",
        description: status
          ? "Hay un estado de lote que conviene revisar en información técnica."
          : "Todavía no hay un lote de admisión para esta edición.",
        tone: "warning",
        attention: "action",
        nextAction: "Creá o obtené un lote en preparación.",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
  }
}

export function presentAdmissionReasonCode(code: string): HumanReason {
  const map: Record<string, HumanReason> = {
    SUBMISSION_NOT_CONFIRMED: {
      code: "SUBMISSION_NOT_CONFIRMED",
      title: "Entrega no confirmada",
      adminExplanation: "La fotografía todavía no está en un estado confirmado para admisión.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    PAYMENT_NOT_APPROVED: {
      code: "PAYMENT_NOT_APPROVED",
      title: "Inscripción sin pago confirmado",
      adminExplanation: "La inscripción no está confirmada para admisión.",
      participantMessage: "La inscripción no está confirmada para admisión.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    ENTRY_MISSING: {
      code: "ENTRY_MISSING",
      title: "Sin vínculo con FotoRank",
      adminExplanation: "No hay una fotografía vinculada en FotoRank para continuar.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    ORIGINAL_MISSING: {
      code: "ORIGINAL_MISSING",
      title: "Falta el archivo original",
      adminExplanation: "No está disponible el archivo original necesario para la admisión.",
      participantMessage: "La obra no cumple requisitos técnicos.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    HASH_MISSING: {
      code: "HASH_MISSING",
      title: "Falta verificación de integridad",
      adminExplanation: "No hay huella del archivo para comprobar integridad.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    DECLARATION_MISSING: {
      code: "DECLARATION_MISSING",
      title: "Falta la declaración del participante",
      adminExplanation: "Falta aceptar la declaración del reglamento.",
      participantMessage: "Falta aceptar la declaración del reglamento.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    PROMPT_NOT_RELEASED: {
      code: "PROMPT_NOT_RELEASED",
      title: "Consigna no disponible",
      adminExplanation: "La consigna todavía no estaba liberada para esta entrega.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    UPLOAD_OUTSIDE_WINDOW: {
      code: "UPLOAD_OUTSIDE_WINDOW",
      title: "Entrega fuera de plazo",
      adminExplanation: "La fotografía fue enviada fuera del horario límite de entrega.",
      participantMessage: "La obra quedó fuera de la ventana permitida.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    CAPTURE_OUTSIDE_WINDOW: {
      code: "CAPTURE_OUTSIDE_WINDOW",
      title: "Fecha de captura fuera del horario permitido",
      adminExplanation:
        "Según la información registrada en el archivo, la fotografía fue tomada fuera de la ventana establecida.",
      participantMessage: "La obra quedó fuera de la ventana permitida.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    EXIF_FAIL: {
      code: "EXIF_FAIL",
      title: "Datos de captura no válidos",
      adminExplanation: "Los datos de captura del archivo no cumplen los requisitos técnicos.",
      participantMessage: "La obra no cumple requisitos técnicos.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    GPS_REQUIRED_MISSING: {
      code: "GPS_REQUIRED_MISSING",
      title: "Ubicación no verificable",
      adminExplanation: "La consigna exige ubicación y no pudimos verificarla.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    DUPLICATE_BLOCKING: {
      code: "DUPLICATE_BLOCKING",
      title: "Posible fotografía duplicada",
      adminExplanation:
        "Encontramos otra entrega con un archivo idéntico o muy similar que bloquea la admisión.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    WRONG_EDITION: {
      code: "WRONG_EDITION",
      title: "Edición incorrecta",
      adminExplanation: "La entrega no corresponde a esta edición.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    WRONG_CONTEST: {
      code: "WRONG_CONTEST",
      title: "Concurso incorrecto",
      adminExplanation: "La entrega no corresponde al concurso esperado.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    CATEGORY_INCOMPATIBLE: {
      code: "CATEGORY_INCOMPATIBLE",
      title: "Categoría incompatible",
      adminExplanation: "La categoría de la obra no es compatible con la admisión.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    ENTRY_REPLACED: {
      code: "ENTRY_REPLACED",
      title: "Versión reemplazada",
      adminExplanation: "Esta versión fue reemplazada por otra entrega.",
      participantMessage: "Esta versión fue reemplazada.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    ENTRY_WITHDRAWN: {
      code: "ENTRY_WITHDRAWN",
      title: "Obra retirada",
      adminExplanation: "La obra fue retirada y no continúa.",
      participantMessage: "Retiraste esta obra.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    ACCREDITATION_MISSING: {
      code: "ACCREDITATION_MISSING",
      title: "Falta acreditación",
      adminExplanation: "La admisión requiere acreditación y todavía no está registrada.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    PROCESSING_INCOMPLETE: {
      code: "PROCESSING_INCOMPLETE",
      title: "Procesamiento incompleto",
      adminExplanation: "El análisis del archivo todavía no terminó.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    MIME_INVALID: {
      code: "MIME_INVALID",
      title: "Formato no permitido",
      adminExplanation: "El tipo de archivo no coincide con los formatos aceptados.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    EXIF_WARNING: {
      code: "EXIF_WARNING",
      title: "Advertencia en datos de captura",
      adminExplanation: "Hay una advertencia sobre los datos de captura. Conviene revisión humana.",
      severity: "warning",
      automaticOrHuman: "mixed",
      legalReview: true,
    },
    GPS_OPTIONAL_MISSING: {
      code: "GPS_OPTIONAL_MISSING",
      title: "Ubicación no informada",
      adminExplanation: "No hay ubicación registrada y no es obligatoria.",
      severity: "warning",
      automaticOrHuman: "automatic",
    },
    METADATA_INCOMPLETE: {
      code: "METADATA_INCOMPLETE",
      title: "Datos insuficientes",
      adminExplanation: "No pudimos comprobar automáticamente uno o más requisitos.",
      severity: "warning",
      automaticOrHuman: "mixed",
      legalReview: true,
    },
    DUPLICATE_REVIEW: {
      code: "DUPLICATE_REVIEW",
      title: "Posible fotografía duplicada",
      adminExplanation:
        "Encontramos otra entrega con un archivo idéntico o muy similar. Requiere revisión humana.",
      severity: "warning",
      automaticOrHuman: "human",
      legalReview: true,
    },
    EXIF_INCONSISTENT: {
      code: "EXIF_INCONSISTENT",
      title: "Datos de captura inconsistentes",
      adminExplanation: "Los datos de captura presentan inconsistencias que conviene revisar.",
      severity: "warning",
      automaticOrHuman: "mixed",
      legalReview: true,
    },
    ACCREDITATION_EXCEPTION: {
      code: "ACCREDITATION_EXCEPTION",
      title: "Excepción de acreditación",
      adminExplanation: "Hay una excepción de acreditación aplicada o pendiente de revisión.",
      severity: "warning",
      automaticOrHuman: "human",
      legalReview: true,
    },
    TIMEZONE_AMBIGUOUS: {
      code: "TIMEZONE_AMBIGUOUS",
      title: "Zona horaria ambigua",
      adminExplanation: "La zona horaria de la captura no pudo interpretarse con certeza.",
      severity: "warning",
      automaticOrHuman: "mixed",
      legalReview: true,
    },
    ADMIN_EXCEPTION: {
      code: "ADMIN_EXCEPTION",
      title: "Decisión administrativa",
      adminExplanation: "La organización aplicó una excepción o exclusión manual.",
      severity: "blocking",
      automaticOrHuman: "human",
      legalReview: true,
    },
    FOTORANK_SYNC_DELAY: {
      code: "FOTORANK_SYNC_DELAY",
      title: "Demora en FotoRank",
      adminExplanation:
        "La fotografía sigue guardada en Clickatón, pero el vínculo con FotoRank todavía no está listo.",
      severity: "warning",
      automaticOrHuman: "automatic",
    },
  };

  return (
    map[code] ?? {
      code,
      title: "Motivo de admisión a revisar",
      adminExplanation:
        "Hay un código interno de admisión. Revisá la información técnica sin usarlo como mensaje al participante.",
      severity: "warning",
      automaticOrHuman: "mixed",
      legalReview: true,
    }
  );
}

export function parseReasonCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return value.split(",").map((part) => part.trim()).filter(Boolean);
    }
  }
  return [];
}

export function presentAccreditationPolicy(policy: string | null | undefined): string {
  switch (policy) {
    case "NOT_REQUIRED":
      return "No requerida";
    case "REQUIRED":
      return "Obligatoria";
    case "OPTIONAL_WITH_REVIEW":
      return "Opcional con revisión";
    default:
      return "Política no informada";
  }
}

export const TECHNICAL_VALIDATION_DISCLAIMER =
  "La validación técnica comprueba que la fotografía cumpla los requisitos de archivo, fecha, consigna y entrega. No determina si la fotografía será finalista o ganadora.";

export const HUMAN_DECISION_HELP =
  "Las comprobaciones automáticas son una ayuda. Revisá los datos antes de confirmar una decisión manual.";
