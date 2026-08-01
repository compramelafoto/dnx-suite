/**
 * Presentación administrativa de entregas fotográficas (Etapa 02 Imp. 05).
 * Solo deriva etiquetas y síntesis visuales; no cambia validadores ni estados persistidos.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";

export type SubmissionAttention = "ok" | "watch" | "action" | "blocked";

export type SubmissionStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: SubmissionAttention;
  nextAction?: string;
  needsHumanReview: boolean;
  canContinueToFotoRank: boolean;
  reversible: boolean;
  participantSees?: string;
};

export type SubmissionOperationalSummary = {
  key:
    | "ready_to_continue"
    | "needs_review"
    | "missing_info"
    | "does_not_meet"
    | "fotorank_pending"
    | "processing"
    | "pending_validation"
    | "withdrawn"
    | "replaced";
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: SubmissionAttention;
  nextAction?: string;
};

export type ValidationCheckItem = {
  key: string;
  label: string;
  status: "pass" | "fail" | "warning" | "review" | "unknown";
  explanation: string;
  resultLabel: string;
  needsReview: boolean;
};

export type HumanReason = {
  code: string;
  title: string;
  adminExplanation: string;
  participantMessage?: string;
  severity: "info" | "warning" | "blocking";
  automaticOrHuman: "automatic" | "human" | "mixed";
  correctableHint?: string;
  legalReview?: boolean;
};

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function submissionToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

export function formatSubmissionDateTime(
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

export function formatFileSizeBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "No informado";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function presentMimeAsFormat(mime: string | null | undefined): string {
  if (!mime) return "No informado";
  const normalized = mime.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "JPEG";
  if (normalized.includes("png")) return "PNG";
  if (normalized.includes("heic") || normalized.includes("heif")) return "HEIC";
  if (normalized.includes("webp")) return "WebP";
  if (normalized.includes("tiff")) return "TIFF";
  return "Formato no reconocido";
}

/** Estado de la entrega (ClickatonPhotoSubmissionStatus). */
export function presentSubmissionStatus(
  status: string | null | undefined,
): SubmissionStatusPresentation {
  switch (status) {
    case "UPLOAD_PENDING":
      return {
        key: "upload_pending",
        label: "Pendiente de carga",
        description: "Todavía no se completó la carga del archivo.",
        tone: "neutral",
        attention: "watch",
        nextAction: "Esperá a que el participante termine de enviar la fotografía.",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
        participantSees: "Todavía no terminaste de enviar la fotografía.",
      };
    case "UPLOADING":
      return {
        key: "uploading",
        label: "Cargando",
        description: "El archivo se está recibiendo.",
        tone: "info",
        attention: "watch",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "UPLOADED":
      return {
        key: "uploaded",
        label: "Archivo recibido",
        description: "El archivo llegó y espera procesamiento.",
        tone: "info",
        attention: "watch",
        nextAction: "Esperá el análisis automático.",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "PROCESSING":
      return {
        key: "processing",
        label: "Analizando fotografía",
        description: "El sistema está comprobando el archivo y sus datos.",
        tone: "info",
        attention: "watch",
        nextAction: "Esperá a que termine el análisis.",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "READY_FOR_REVIEW":
      return {
        key: "ready_for_review",
        label: "Lista para revisión",
        description: "La fotografía está lista para una revisión técnica.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá los requisitos técnicos.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "PENDING_CONFIRMATION":
      return {
        key: "pending_confirmation",
        label: "Pendiente de confirmación",
        description: "El archivo fue revisado por el sistema y espera confirmación del proceso.",
        tone: "warning",
        attention: "watch",
        nextAction: "Revisá el resultado técnico si aparece alguna alerta.",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
        participantSees: "Recibimos tu fotografía y estamos completando la validación.",
      };
    case "CONFIRMED":
      return {
        key: "confirmed",
        label: "Aceptada técnicamente",
        description:
          "La fotografía cumple los requisitos técnicos y puede continuar. Esto no es una decisión del jurado.",
        tone: "success",
        attention: "ok",
        nextAction: "Verificá el envío a FotoRank si corresponde.",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
        participantSees: "Tu fotografía fue aceptada en la validación técnica.",
      };
    case "REJECTED":
      return {
        key: "rejected",
        label: "No cumple los requisitos",
        description: "La entrega no puede continuar con el estado actual. Revisá el motivo.",
        tone: "danger",
        attention: "blocked",
        nextAction: "Revisá el motivo antes de confirmar o revertir una decisión.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
        participantSees: "Tu fotografía no cumplió los requisitos técnicos.",
      };
    case "FAILED":
      return {
        key: "failed",
        label: "Error al procesar",
        description: "Hubo un problema al analizar el archivo. La entrega sigue registrada.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá el motivo y, si corresponde, pedí una nueva carga.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "REPLACED":
      return {
        key: "replaced",
        label: "Reemplazada",
        description: "Esta versión fue reemplazada por otra entrega.",
        tone: "neutral",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "WITHDRAWN":
      return {
        key: "withdrawn",
        label: "Retirada",
        description: "La entrega fue retirada y no continúa.",
        tone: "neutral",
        attention: "blocked",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: false,
      };
    default:
      return {
        key: "unknown",
        label: "Estado no reconocido",
        description: "Hay un estado interno que necesita revisión de soporte.",
        tone: "warning",
        attention: "action",
        nextAction: "Abrí la información técnica y contactá soporte si hace falta.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
  }
}

/** Resultado de validación automática (ClickatonPhotoValidationResult). */
export function presentValidationResult(
  result: string | null | undefined,
): SubmissionStatusPresentation {
  switch (result) {
    case "PASS":
      return {
        key: "validation_pass",
        label: "Cumple requisitos técnicos",
        description:
          "Las comprobaciones automáticas no detectaron bloqueos. Revisá los datos antes de una decisión manual.",
        tone: "success",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: true,
      };
    case "WARNING":
      return {
        key: "validation_warning",
        label: "Advertencias técnicas",
        description: "Hay alertas que no bloquean automáticamente, pero conviene revisarlas.",
        tone: "warning",
        attention: "watch",
        nextAction: "Revisá las advertencias antes de continuar.",
        needsHumanReview: true,
        canContinueToFotoRank: true,
        reversible: true,
      };
    case "FAIL":
      return {
        key: "validation_fail",
        label: "No cumple los requisitos técnicos",
        description: "Una o más comprobaciones automáticas fallaron.",
        tone: "danger",
        attention: "blocked",
        nextAction: "Revisá el motivo antes de confirmar la decisión.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case "MANUAL_REVIEW":
      return {
        key: "validation_manual",
        label: "Requiere revisión técnica",
        description: "Hay información que no pudo verificarse automáticamente.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá captura, ubicación y posibles duplicados.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: true,
      };
    case null:
    case undefined:
    case "":
      return {
        key: "validation_pending",
        label: "Pendiente de validación",
        description: "El archivo todavía no fue revisado por completo.",
        tone: "neutral",
        attention: "watch",
        needsHumanReview: false,
        canContinueToFotoRank: false,
        reversible: true,
      };
    default:
      return {
        key: "validation_unknown",
        label: "Validación no reconocida",
        description: "El resultado de validación necesita revisión de soporte.",
        tone: "warning",
        attention: "action",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
  }
}

export function presentExifStatus(status: string | null | undefined): SubmissionStatusPresentation {
  switch (status) {
    case "OK":
    case "PRESENT":
    case "PASS":
      return {
        key: "exif_ok",
        label: "Datos de captura disponibles",
        description: "El archivo incluye información de captura registrada por el dispositivo.",
        tone: "success",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: false,
      };
    case "MISSING":
    case "ABSENT":
      return {
        key: "exif_missing",
        label: "Sin datos de captura",
        description: "No pudimos comprobar la fecha de captura a partir del archivo.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá si el archivo conserva la información original de la cámara.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "FAIL":
    case "INVALID":
      return {
        key: "exif_fail",
        label: "Datos de captura no válidos",
        description: "Los datos de captura del archivo no pudieron validarse.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá el archivo antes de decidir.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "WARNING":
    case "PARTIAL":
      return {
        key: "exif_warning",
        label: "Datos de captura incompletos",
        description: "Hay información parcial de captura. Conviene revisión humana.",
        tone: "warning",
        attention: "watch",
        needsHumanReview: true,
        canContinueToFotoRank: true,
        reversible: false,
      };
    default:
      return {
        key: "exif_unknown",
        label: status ? "Datos de captura a revisar" : "Datos de captura no informados",
        description: "No hay un resultado claro sobre la información de captura.",
        tone: "neutral",
        attention: "watch",
        needsHumanReview: Boolean(status),
        canContinueToFotoRank: false,
        reversible: false,
      };
  }
}

export function presentGpsStatus(status: string | null | undefined): SubmissionStatusPresentation {
  switch (status) {
    case "OK":
    case "WITHIN":
    case "PASS":
    case "PRESENT":
      return {
        key: "gps_ok",
        label: "Ubicación registrada válida",
        description:
          "Según los datos del archivo, la fotografía fue tomada dentro del área permitida o con ubicación aceptable.",
        tone: "success",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: false,
      };
    case "OUTSIDE":
    case "OUT_OF_BOUNDS":
    case "FAIL":
      return {
        key: "gps_outside",
        label: "Ubicación fuera del área",
        description: "La ubicación registrada está fuera del área permitida.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá el caso antes de confirmar una decisión.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "MISSING":
    case "ABSENT":
    case "REQUIRED_MISSING":
      return {
        key: "gps_missing",
        label: "Ubicación no verificable",
        description: "No pudimos verificar la ubicación a partir del archivo.",
        tone: "warning",
        attention: "action",
        nextAction: "Revisá si la consigna exige ubicación.",
        needsHumanReview: true,
        canContinueToFotoRank: false,
        reversible: false,
      };
    case "OPTIONAL_MISSING":
    case "NOT_REQUIRED":
      return {
        key: "gps_optional",
        label: "Ubicación no requerida",
        description: "No hay ubicación registrada y no es obligatoria para esta consigna.",
        tone: "neutral",
        attention: "ok",
        needsHumanReview: false,
        canContinueToFotoRank: true,
        reversible: false,
      };
    default:
      return {
        key: "gps_unknown",
        label: status ? "Ubicación a revisar" : "Ubicación no informada",
        description: "No hay un resultado claro sobre la ubicación.",
        tone: "neutral",
        attention: "watch",
        needsHumanReview: Boolean(status),
        canContinueToFotoRank: false,
        reversible: false,
      };
  }
}

export function presentFotoRankLink(input: {
  fotorankEntryId: string | null | undefined;
  status: string | null | undefined;
}): SubmissionStatusPresentation {
  if (input.fotorankEntryId) {
    return {
      key: "fr_linked",
      label: "Disponible en FotoRank",
      description:
        "La fotografía fue enviada a FotoRank para continuar el proceso. Esto no implica evaluación artística.",
      tone: "success",
      attention: "ok",
      needsHumanReview: false,
      canContinueToFotoRank: true,
      reversible: false,
    };
  }
  if (
    input.status === "PROCESSING" ||
    input.status === "UPLOADING" ||
    input.status === "UPLOADED" ||
    input.status === "UPLOAD_PENDING"
  ) {
    return {
      key: "fr_pending_process",
      label: "Pendiente de envío",
      description: "Cuando termine el análisis, Clickatón intentará vincular la fotografía con FotoRank.",
      tone: "info",
      attention: "watch",
      needsHumanReview: false,
      canContinueToFotoRank: false,
      reversible: true,
    };
  }
  if (input.status === "REJECTED" || input.status === "FAILED" || input.status === "WITHDRAWN") {
    return {
      key: "fr_not_applicable",
      label: "Sin envío a FotoRank",
      description: "Con el estado actual la fotografía no continúa hacia FotoRank.",
      tone: "neutral",
      attention: "blocked",
      needsHumanReview: false,
      canContinueToFotoRank: false,
      reversible: true,
    };
  }
  return {
    key: "fr_missing",
    label: "Pendiente de enviar a FotoRank",
    description:
      "La fotografía sigue guardada en Clickatón, pero todavía no hay vínculo con FotoRank.",
    tone: "warning",
    attention: "action",
    nextAction: "Revisá el procesamiento o el estado técnico.",
    needsHumanReview: true,
    canContinueToFotoRank: true,
    reversible: true,
  };
}

export function presentFailureOrCaptureReason(
  code: string | null | undefined,
): HumanReason | null {
  if (!code) return null;
  const map: Record<string, HumanReason> = {
    EXIF_CAPTURE_DATE_ABSENT: {
      code: "EXIF_CAPTURE_DATE_ABSENT",
      title: "No pudimos comprobar la fecha de captura",
      adminExplanation:
        "El archivo no trae una fecha de captura utilizable. No afirma fraude automáticamente.",
      participantMessage:
        "No pudimos validar la fecha de captura. Revisá que el archivo original conserve la información registrada por la cámara.",
      severity: "warning",
      automaticOrHuman: "automatic",
      correctableHint: "Solo si la ventana de entrega sigue abierta y la lógica lo permite.",
      legalReview: true,
    },
    CAPTURE_WINDOW_NOT_CONFIGURED: {
      code: "CAPTURE_WINDOW_NOT_CONFIGURED",
      title: "Ventana de captura no configurada",
      adminExplanation: "No hay horario de captura definido para evaluar esta fotografía.",
      severity: "warning",
      automaticOrHuman: "mixed",
    },
    WITHIN_CAPTURE_WINDOW: {
      code: "WITHIN_CAPTURE_WINDOW",
      title: "Fecha de captura dentro del horario",
      adminExplanation: "Según la fecha registrada en el archivo, la fotografía está dentro de la ventana.",
      severity: "info",
      automaticOrHuman: "automatic",
    },
    WITHIN_TOLERANCE: {
      code: "WITHIN_TOLERANCE",
      title: "Fecha de captura dentro de la tolerancia",
      adminExplanation:
        "Según la fecha registrada en el archivo, la fotografía está cerca del límite y entró por tolerancia.",
      severity: "warning",
      automaticOrHuman: "automatic",
    },
    CAPTURE_OUTSIDE_WINDOW: {
      code: "CAPTURE_OUTSIDE_WINDOW",
      title: "Fecha de captura fuera del horario permitido",
      adminExplanation:
        "Según la información registrada en el archivo, la fotografía parece haber sido tomada fuera de la ventana establecida.",
      participantMessage: "La obra quedó fuera de la ventana permitida.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    CAPTURE_OUTSIDE_WINDOW_EXTREME: {
      code: "CAPTURE_OUTSIDE_WINDOW_EXTREME",
      title: "Fecha de captura muy fuera del horario",
      adminExplanation:
        "Según la fecha registrada en el archivo, la fotografía parece haber sido tomada claramente fuera del horario permitido.",
      participantMessage: "La obra quedó fuera de la ventana permitida.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    INVALID_MIME: {
      code: "INVALID_MIME",
      title: "Formato no permitido",
      adminExplanation:
        "El tipo de archivo no coincide con los formatos aceptados para esta consigna.",
      participantMessage: "El archivo tiene un formato que Clickatón no admite para esta consigna.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    CORRUPT_IMAGE: {
      code: "CORRUPT_IMAGE",
      title: "Archivo no legible",
      adminExplanation: "No pudimos analizar el archivo como imagen válida.",
      participantMessage: "No pudimos leer el archivo enviado.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
    DUPLICATE_SAME_PROMPT: {
      code: "DUPLICATE_SAME_PROMPT",
      title: "Posible fotografía duplicada",
      adminExplanation:
        "Encontramos otra entrega con un archivo idéntico o muy similar para la misma consigna.",
      participantMessage: "Ya enviaste este archivo para esta consigna.",
      severity: "blocking",
      automaticOrHuman: "automatic",
      legalReview: true,
    },
    DUPLICATE_OTHER_PROMPT: {
      code: "DUPLICATE_OTHER_PROMPT",
      title: "Posible fotografía duplicada",
      adminExplanation:
        "Encontramos otra entrega con un archivo idéntico o muy similar en otra consigna.",
      severity: "warning",
      automaticOrHuman: "mixed",
      legalReview: true,
    },
    DUPLICATE_OTHER_PARTICIPANT: {
      code: "DUPLICATE_OTHER_PARTICIPANT",
      title: "Posible fotografía duplicada",
      adminExplanation:
        "Encontramos otra entrega con un archivo idéntico o muy similar de otro participante.",
      participantMessage: "El archivo quedó en revisión.",
      severity: "blocking",
      automaticOrHuman: "mixed",
      legalReview: true,
    },
    PROCESSING_FAILED: {
      code: "PROCESSING_FAILED",
      title: "No pudimos analizar el archivo",
      adminExplanation: "La entrega sigue registrada, pero necesita revisión manual.",
      severity: "blocking",
      automaticOrHuman: "automatic",
    },
  };

  if (map[code]) return map[code];

  if (code.startsWith("DUPLICATE_")) {
    return {
      code,
      title: "Posible fotografía duplicada",
      adminExplanation:
        "Encontramos otra entrega con un archivo idéntico o muy similar.",
      severity: "warning",
      automaticOrHuman: "automatic",
      legalReview: true,
    };
  }

  return {
    code,
    title: "Motivo técnico a revisar",
    adminExplanation:
      "Hay un código interno de validación. Revisá la información técnica sin exponerlo al participante.",
    severity: "warning",
    automaticOrHuman: "mixed",
    legalReview: true,
  };
}

export type SubmissionTechnicalSummary = {
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  software?: string | null;
  captureEval?: { result?: string; reason?: string } | null;
  gpsEval?: { status?: string; result?: string } | null;
  duplicate?: { scope?: string | null } | null;
  privateOriginal?: boolean | null;
};

export function parseTechnicalSummary(value: unknown): SubmissionTechnicalSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const captureEval =
    raw.captureEval && typeof raw.captureEval === "object"
      ? (raw.captureEval as { result?: string; reason?: string })
      : null;
  const gpsEval =
    raw.gpsEval && typeof raw.gpsEval === "object"
      ? (raw.gpsEval as { status?: string; result?: string })
      : null;
  const duplicate =
    raw.duplicate && typeof raw.duplicate === "object"
      ? (raw.duplicate as { scope?: string | null })
      : null;
  return {
    mime: typeof raw.mime === "string" ? raw.mime : null,
    width: typeof raw.width === "number" ? raw.width : null,
    height: typeof raw.height === "number" ? raw.height : null,
    cameraMake: typeof raw.cameraMake === "string" ? raw.cameraMake : null,
    cameraModel: typeof raw.cameraModel === "string" ? raw.cameraModel : null,
    software: typeof raw.software === "string" ? raw.software : null,
    captureEval,
    gpsEval,
    duplicate,
    privateOriginal: typeof raw.privateOriginal === "boolean" ? raw.privateOriginal : null,
  };
}

export function deriveSubmissionOperationalSummary(input: {
  status: string | null | undefined;
  validationResult: string | null | undefined;
  failureCode?: string | null;
  fotorankEntryId?: string | null;
  exifStatus?: string | null;
  gpsStatus?: string | null;
  technicalSummary?: SubmissionTechnicalSummary;
}): SubmissionOperationalSummary {
  const status = presentSubmissionStatus(input.status);
  const validation = presentValidationResult(input.validationResult);
  const duplicateScope = input.technicalSummary?.duplicate?.scope;
  const hasDuplicate = Boolean(duplicateScope && duplicateScope !== "NONE");

  if (input.status === "WITHDRAWN") {
    return {
      key: "withdrawn",
      label: "Retirada",
      description: "La entrega no continúa.",
      tone: "neutral",
      attention: "blocked",
    };
  }
  if (input.status === "REPLACED") {
    return {
      key: "replaced",
      label: "Reemplazada",
      description: "Hay una versión posterior de esta entrega.",
      tone: "neutral",
      attention: "ok",
    };
  }
  if (
    input.status === "PROCESSING" ||
    input.status === "UPLOADING" ||
    input.status === "UPLOADED"
  ) {
    return {
      key: "processing",
      label: "Analizando fotografía",
      description: status.description,
      tone: "info",
      attention: "watch",
      nextAction: status.nextAction,
    };
  }
  if (
    input.validationResult === "FAIL" ||
    input.status === "REJECTED" ||
    input.status === "FAILED"
  ) {
    return {
      key: "does_not_meet",
      label: "No cumple los requisitos",
      description: validation.description,
      tone: "danger",
      attention: "blocked",
      nextAction: "Revisá el motivo antes de confirmar la decisión.",
    };
  }
  if (
    input.validationResult === "MANUAL_REVIEW" ||
    input.status === "READY_FOR_REVIEW" ||
    hasDuplicate ||
    input.exifStatus === "MISSING" ||
    input.exifStatus === "ABSENT"
  ) {
    return {
      key: "needs_review",
      label: "Requiere revisión",
      description: "Hay información que necesita una mirada humana antes de continuar.",
      tone: "warning",
      attention: "action",
      nextAction: "Revisá captura, ubicación y posibles duplicados.",
    };
  }
  if (!input.validationResult) {
    return {
      key: "pending_validation",
      label: "Pendiente de validación",
      description: "El archivo todavía no fue revisado por completo.",
      tone: "neutral",
      attention: "watch",
    };
  }
  if (
    (input.status === "CONFIRMED" || input.validationResult === "PASS") &&
    !input.fotorankEntryId
  ) {
    return {
      key: "fotorank_pending",
      label: "Pendiente de FotoRank",
      description: "La fotografía fue aceptada técnicamente, pero todavía no hay vínculo con FotoRank.",
      tone: "warning",
      attention: "action",
      nextAction: "Revisá el estado de envío a FotoRank.",
    };
  }
  if (input.validationResult === "WARNING") {
    return {
      key: "missing_info",
      label: "Falta información",
      description: "Hay advertencias técnicas. Conviene revisarlas antes de continuar.",
      tone: "warning",
      attention: "watch",
      nextAction: "Revisá las advertencias.",
    };
  }
  return {
    key: "ready_to_continue",
    label: "Lista para continuar",
    description:
      "La fotografía cumple los requisitos técnicos visibles. La validación técnica no determina si será finalista o ganadora.",
    tone: "success",
    attention: "ok",
  };
}

export function buildValidationChecklist(input: {
  status: string | null | undefined;
  validationResult: string | null | undefined;
  failureCode?: string | null;
  exifStatus?: string | null;
  gpsStatus?: string | null;
  captureDateInterpreted?: Date | string | null;
  confirmedAt?: Date | string | null;
  createdAt?: Date | string | null;
  technicalSummary?: SubmissionTechnicalSummary;
  hasOriginal?: boolean;
  hasPreview?: boolean;
}): ValidationCheckItem[] {
  const summary = input.technicalSummary ?? {};
  const captureReason = summary.captureEval?.reason ?? input.failureCode;
  const capturePresented = presentFailureOrCaptureReason(captureReason ?? null);
  const duplicateScope = summary.duplicate?.scope;
  const hasDuplicate = Boolean(duplicateScope && duplicateScope !== "NONE");

  const fileReadable: ValidationCheckItem = {
    key: "readable",
    label: "Archivo legible",
    status:
      input.status === "FAILED"
        ? "fail"
        : input.hasOriginal || input.hasPreview || input.status === "CONFIRMED"
          ? "pass"
          : input.status === "PROCESSING"
            ? "unknown"
            : "unknown",
    explanation: "Comprueba si el archivo pudo leerse como imagen.",
    resultLabel:
      input.status === "FAILED"
        ? "No pudimos leer el archivo"
        : input.hasOriginal || input.hasPreview
          ? "Archivo registrado"
          : "Sin archivo asociado",
    needsReview: input.status === "FAILED",
  };

  const formatItem: ValidationCheckItem = {
    key: "format",
    label: "Formato permitido",
    status:
      input.failureCode === "INVALID_MIME"
        ? "fail"
        : summary.mime
          ? "pass"
          : "unknown",
    explanation: "Comprueba si el tipo de archivo es admitido para la consigna.",
    resultLabel:
      input.failureCode === "INVALID_MIME"
        ? "Formato no compatible"
        : summary.mime
          ? presentMimeAsFormat(summary.mime)
          : "Sin dato de formato",
    needsReview: input.failureCode === "INVALID_MIME",
  };

  const resolutionOk =
    typeof summary.width === "number" &&
    typeof summary.height === "number" &&
    summary.width > 0 &&
    summary.height > 0;
  const resolutionItem: ValidationCheckItem = {
    key: "resolution",
    label: "Resolución suficiente",
    status: resolutionOk ? "pass" : "unknown",
    explanation: "Comprueba ancho y alto en píxeles cuando están disponibles.",
    resultLabel: resolutionOk
      ? `${summary.width} × ${summary.height} px`
      : "Dimensiones no informadas",
    needsReview: false,
  };

  const captureResult = summary.captureEval?.result ?? null;
  const captureItem: ValidationCheckItem = {
    key: "capture_date",
    label: "Fecha de captura válida",
    status:
      captureResult === "PASS"
        ? "pass"
        : captureResult === "WARNING"
          ? "warning"
          : captureResult === "FAIL"
            ? "fail"
            : captureResult === "MANUAL_REVIEW" || !input.captureDateInterpreted
              ? "review"
              : "unknown",
    explanation:
      "Es la fecha registrada por la cámara o el dispositivo al tomar la fotografía.",
    resultLabel: capturePresented?.title
      ?? (input.captureDateInterpreted
        ? "Fecha de captura disponible"
        : "No pudimos comprobar la fecha de captura."),
    needsReview: captureResult === "MANUAL_REVIEW" || captureResult === "FAIL",
  };

  const deliveryItem: ValidationCheckItem = {
    key: "delivery",
    label: "Entrega registrada",
    status: input.createdAt ? "pass" : "unknown",
    explanation: "Es el momento en que la fotografía fue enviada a Clickatón.",
    resultLabel: input.createdAt
      ? "La entrega se registró en el sistema"
      : "Sin fecha de entrega",
    needsReview: false,
  };

  const duplicateItem: ValidationCheckItem = {
    key: "duplicate",
    label: "Sin duplicados detectados",
    status: hasDuplicate ? "review" : duplicateScope === "NONE" ? "pass" : "unknown",
    explanation: "Compara el archivo con otras entregas ya registradas.",
    resultLabel: hasDuplicate
      ? "Posible fotografía duplicada"
      : duplicateScope === "NONE"
        ? "Sin coincidencias detectadas"
        : "Sin dato de duplicados",
    needsReview: hasDuplicate,
  };

  const gpsPresented = presentGpsStatus(input.gpsStatus ?? summary.gpsEval?.status);
  const gpsItem: ValidationCheckItem = {
    key: "location",
    label: "Ubicación válida",
    status:
      gpsPresented.attention === "ok"
        ? "pass"
        : gpsPresented.attention === "blocked"
          ? "fail"
          : gpsPresented.attention === "action"
            ? "review"
            : "unknown",
    explanation: "Cuando aplica, comprueba la ubicación registrada en el archivo.",
    resultLabel: gpsPresented.label,
    needsReview: gpsPresented.needsHumanReview,
  };

  const validationItem: ValidationCheckItem = {
    key: "overall",
    label: "Resultado técnico general",
    status:
      input.validationResult === "PASS"
        ? "pass"
        : input.validationResult === "WARNING"
          ? "warning"
          : input.validationResult === "FAIL"
            ? "fail"
            : input.validationResult === "MANUAL_REVIEW"
              ? "review"
              : "unknown",
    explanation:
      "Comprueba que la fotografía cumpla los requisitos de archivo, fecha, consigna y entrega. No evalúa calidad artística.",
    resultLabel: presentValidationResult(input.validationResult).label,
    needsReview: presentValidationResult(input.validationResult).needsHumanReview,
  };

  return [
    fileReadable,
    formatItem,
    resolutionItem,
    captureItem,
    deliveryItem,
    duplicateItem,
    gpsItem,
    validationItem,
  ];
}

export const SUBMISSION_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PENDING_CONFIRMATION", label: "Pendiente de confirmación" },
  { value: "CONFIRMED", label: "Aceptada técnicamente" },
  { value: "REJECTED", label: "No cumple los requisitos" },
  { value: "FAILED", label: "Error al procesar" },
  { value: "PROCESSING", label: "Analizando fotografía" },
  { value: "READY_FOR_REVIEW", label: "Lista para revisión" },
  { value: "UPLOAD_PENDING", label: "Pendiente de carga" },
  { value: "REPLACED", label: "Reemplazada" },
  { value: "WITHDRAWN", label: "Retirada" },
];

export const VALIDATION_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PASS", label: "Cumple requisitos técnicos" },
  { value: "WARNING", label: "Advertencias técnicas" },
  { value: "FAIL", label: "No cumple requisitos" },
  { value: "MANUAL_REVIEW", label: "Requiere revisión técnica" },
];

export function presentAdminReviewActionLabel(
  decision: "APPROVE" | "REJECT" | "MANUAL_REVIEW",
): string {
  if (decision === "APPROVE") return "Aceptar técnicamente";
  if (decision === "REJECT") return "Marcar como no válida";
  return "Solicitar revisión";
}

export function containsForbiddenSubmissionOpsJargon(text: string): boolean {
  return /\b(EXIF|MIME|SHA|hash|fingerprint|Admission|entry ID|sync state|storageKey|objectKey|payload)\b/i.test(
    text,
  );
}
