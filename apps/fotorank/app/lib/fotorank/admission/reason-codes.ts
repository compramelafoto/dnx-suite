/**
 * Catálogo central de reason codes de admisión técnica (multi-concurso).
 * BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR
 */

export type AdmissionReasonSeverity = "info" | "warning" | "blocking" | "critical";
export type AdmissionRecommendedAction =
  | "AUTO_PASS"
  | "MANUAL_REVIEW"
  | "REQUEST_EVIDENCE"
  | "ALLOW_REPLACEMENT"
  | "ADMIT"
  | "REJECT"
  | "FREEZE"
  | "NONE";

export type AdmissionReasonVisibility = "public" | "internal" | "both";

export type AdmissionReasonDefinition = {
  code: string;
  publicMessage: string;
  internalMessage: string;
  severity: AdmissionReasonSeverity;
  recommendedAction: AdmissionRecommendedAction;
  evidenceHint: string;
  visibility: AdmissionReasonVisibility;
  allowsReplacement: boolean;
  blocksJury: boolean;
};

const def = (
  code: string,
  partial: Omit<AdmissionReasonDefinition, "code">,
): AdmissionReasonDefinition => ({ code, ...partial });

export const ADMISSION_REASON_CODES = {
  // Archivo
  FILE_INVALID_FORMAT: def("FILE_INVALID_FORMAT", {
    publicMessage: "El formato del archivo no está permitido.",
    internalMessage: "MIME/extensión no admitidos por la política del concurso.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Reemplazar con JPEG/PNG según política.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  FILE_CORRUPTED: def("FILE_CORRUPTED", {
    publicMessage: "El archivo no se pudo leer correctamente.",
    internalMessage: "Decodificación fallida o magic bytes inválidos.",
    severity: "blocking",
    recommendedAction: "ALLOW_REPLACEMENT",
    evidenceHint: "Solicitar nuevo archivo original.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  FILE_TOO_LARGE: def("FILE_TOO_LARGE", {
    publicMessage: "El archivo supera el tamaño máximo permitido.",
    internalMessage: "fileSizeBytes > policy.maxFileSizeBytes.",
    severity: "blocking",
    recommendedAction: "ALLOW_REPLACEMENT",
    evidenceHint: "Reemplazar con archivo dentro del límite.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  IMAGE_DIMENSIONS_INVALID: def("IMAGE_DIMENSIONS_INVALID", {
    publicMessage: "Las dimensiones de la imagen no cumplen los requisitos.",
    internalMessage: "width/height fuera de política.",
    severity: "blocking",
    recommendedAction: "ALLOW_REPLACEMENT",
    evidenceHint: "Reemplazar con dimensiones válidas.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  DUPLICATE_FILE_SUSPECTED: def("DUPLICATE_FILE_SUSPECTED", {
    publicMessage: "La obra requiere revisión por posible duplicado.",
    internalMessage: "Checksum coincidente con otra obra del concurso.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Comparar assets y versiones.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),

  // Categoría / dispositivo
  PROFESSIONAL_PHONE_NOT_ALLOWED: def("PROFESSIONAL_PHONE_NOT_ALLOWED", {
    publicMessage: "En Fotógrafo Profesional el celular requiere revisión o reemplazo.",
    internalMessage: "Categoría profesional + dispositivo SMARTPHONE declarado/detectado.",
    severity: "warning",
    recommendedAction: "ALLOW_REPLACEMENT",
    evidenceHint: "Solicitar captura con cámara DSLR/mirrorless.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  PROFESSIONAL_CAMERA_NOT_IDENTIFIED: def("PROFESSIONAL_CAMERA_NOT_IDENTIFIED", {
    publicMessage: "No se identificó una cámara profesional; la obra queda en revisión.",
    internalMessage: "EXIF/dispositivo desconocido en categoría profesional.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original + EXIF o declaración de equipo.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  AMATEUR_DRONE_NOT_ALLOWED: def("AMATEUR_DRONE_NOT_ALLOWED", {
    publicMessage: "En Amateur no se admite dron.",
    internalMessage: "Categoría amateur + DRONE.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Cambiar categoría o reemplazar archivo (política).",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  ARGRA_NUMBER_MISSING: def("ARGRA_NUMBER_MISSING", {
    publicMessage: "Falta el número de socio ARGRA para Reportero Gráfico.",
    internalMessage: "answersJson.argraMembershipNumber vacío.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Completar inscripción con ARGRA.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  ARGRA_VERIFICATION_PENDING: def("ARGRA_VERIFICATION_PENDING", {
    publicMessage: "Tu número ARGRA está pendiente de verificación institucional.",
    internalMessage: "PENDING_VERIFICATION — sin integración externa automática.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Verificación manual del organizador. PENDING_INSTITUTIONAL_APPROVAL.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  ARGRA_VERIFICATION_REJECTED: def("ARGRA_VERIFICATION_REJECTED", {
    publicMessage: "El número ARGRA declarado no fue aceptado.",
    internalMessage: "Organizador marcó ARGRA REJECTED.",
    severity: "blocking",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Corrección ARGRA o evidencia de afiliación.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  AERIAL_DRONE_REQUIRED: def("AERIAL_DRONE_REQUIRED", {
    publicMessage: "Fotografía Aérea requiere captura con dron.",
    internalMessage: "Categoría aérea sin dispositivo dron.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Reemplazar con captura de dron o cambiar categoría.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  AERIAL_DEVICE_NOT_IDENTIFIED: def("AERIAL_DEVICE_NOT_IDENTIFIED", {
    publicMessage: "No se identificó el dron; la obra queda en revisión.",
    internalMessage: "Aérea + dron declarado sin evidencia EXIF/modelo.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "EXIF, modelo o captura de software del dron.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  DEVICE_EXIF_MISMATCH: def("DEVICE_EXIF_MISMATCH", {
    publicMessage: "Hay inconsistencia entre el dispositivo declarado y los metadatos.",
    internalMessage: "declaredDeviceKind vs EXIF make/model.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Aclaración de dispositivo u original.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  DEVICE_UNKNOWN: def("DEVICE_UNKNOWN", {
    publicMessage: "No se pudo identificar el dispositivo; requiere revisión.",
    internalMessage: "DEVICE_UNKNOWN / EXIF ausente.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original o declaración detallada.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),

  // Territorio
  TERRITORY_DECLARATION_MISSING: def("TERRITORY_DECLARATION_MISSING", {
    publicMessage: "Falta la declaración de territorio (Provincia de Santa Fe).",
    internalMessage: "territoryConfirmedSantaFe=false.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Completar declaración territorial.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  CAPTURE_LOCATION_MISSING: def("CAPTURE_LOCATION_MISSING", {
    publicMessage: "Falta indicar la localidad de captura.",
    internalMessage: "captureLocality vacío.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Completar localidad.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  GPS_SUPPORTS_SANTA_FE: def("GPS_SUPPORTS_SANTA_FE", {
    publicMessage: "Los metadatos de ubicación son compatibles con la declaración.",
    internalMessage: "GPS dentro de bounding box aproximado Santa Fe (evidencia, no geofence legal).",
    severity: "info",
    recommendedAction: "AUTO_PASS",
    evidenceHint: "N/A",
    visibility: "internal",
    allowsReplacement: false,
    blocksJury: false,
  }),
  GPS_OUTSIDE_SANTA_FE: def("GPS_OUTSIDE_SANTA_FE", {
    publicMessage: "La ubicación técnica requiere revisión territorial.",
    internalMessage: "GPS fuera del bounding box aproximado — no es rechazo automático definitivo.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Evidencia de ubicación / aclaración.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  GPS_INCONCLUSIVE: def("GPS_INCONCLUSIVE", {
    publicMessage: "No hay GPS en el archivo; se usa la declaración territorial.",
    internalMessage: "GPS ausente — no auto-rechazo.",
    severity: "info",
    recommendedAction: "AUTO_PASS",
    evidenceHint: "Opcional: evidencia de ubicación si se observa.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: false,
  }),
  TERRITORY_EVIDENCE_REQUIRED: def("TERRITORY_EVIDENCE_REQUIRED", {
    publicMessage: "Se solicita evidencia adicional de ubicación de captura.",
    internalMessage: "Operador pidió evidencia territorial.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Captura de mapa, ticket, o aclaración.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),

  // Período
  CAPTURE_DATE_WITHIN_WINDOW: def("CAPTURE_DATE_WITHIN_WINDOW", {
    publicMessage: "La fecha de captura está dentro del período oficial.",
    internalMessage: "DateTimeOriginal dentro de ventana.",
    severity: "info",
    recommendedAction: "AUTO_PASS",
    evidenceHint: "N/A",
    visibility: "internal",
    allowsReplacement: false,
    blocksJury: false,
  }),
  CAPTURE_DATE_MISSING: def("CAPTURE_DATE_MISSING", {
    publicMessage: "No hay fecha de captura en los metadatos; requiere revisión.",
    internalMessage: "EXIF DateTimeOriginal ausente — no auto-rechazo.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original / RAW / aclaración de fecha.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  CAPTURE_DATE_BEFORE_WINDOW: def("CAPTURE_DATE_BEFORE_WINDOW", {
    publicMessage: "La fecha de captura parece anterior al período oficial.",
    internalMessage: "captureDate < window start — revisión / excepción auditada.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original o evidencia de reloj incorrecto.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  CAPTURE_DATE_AFTER_WINDOW: def("CAPTURE_DATE_AFTER_WINDOW", {
    publicMessage: "La fecha de captura parece posterior al período oficial.",
    internalMessage: "captureDate >= window end exclusive.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original o evidencia.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  CAPTURE_DATE_INVALID: def("CAPTURE_DATE_INVALID", {
    publicMessage: "La fecha de captura es inválida o ilegible.",
    internalMessage: "Fecha parseada inconsistente.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original / RAW.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  CAMERA_CLOCK_INCONSISTENT: def("CAMERA_CLOCK_INCONSISTENT", {
    publicMessage: "Posible inconsistencia de reloj de cámara; requiere revisión.",
    internalMessage: "Digitized vs Original o declaración vs EXIF.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Aceptar con evidencia auditada.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),

  // Autoría / edición / IA (sin afirmar detección confiable de IA)
  ORIGINAL_REQUIRED: def("ORIGINAL_REQUIRED", {
    publicMessage: "Se solicita el archivo original para continuar la admisión.",
    internalMessage: "Operador pidió original.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Original sin recomprimir.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  RAW_REQUIRED: def("RAW_REQUIRED", {
    publicMessage: "Se solicita archivo RAW como evidencia (si la política lo permite).",
    internalMessage: "Solicitud RAW — LEGAL REVIEW REQUIRED.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "RAW protegido en R2 privado.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  EDITING_DECLARATION_REQUIRED: def("EDITING_DECLARATION_REQUIRED", {
    publicMessage: "Se solicita aclaración sobre el software de edición informado.",
    internalMessage: "Software EXIF presente → revisión, no auto-rechazo.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Declaración / captura de software.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  AI_DECLARATION_REQUIRED: def("AI_DECLARATION_REQUIRED", {
    publicMessage: "Se solicita declaración sobre uso de herramientas generativas.",
    internalMessage: "Sin detección automática confiable de IA.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Declaración del participante.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  POSSIBLE_GENERATIVE_EDIT: def("POSSIBLE_GENERATIVE_EDIT", {
    publicMessage: "La obra requiere revisión adicional de autoría.",
    internalMessage: "Señal débil / declaración — NO afirmar detección IA.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "Original / proceso / declaración.",
    visibility: "internal",
    allowsReplacement: true,
    blocksJury: true,
  }),
  AUTHORSHIP_EVIDENCE_REQUIRED: def("AUTHORSHIP_EVIDENCE_REQUIRED", {
    publicMessage: "Se solicita evidencia de autoría.",
    internalMessage: "Pedido operativo de autoría.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Original / RAW / secuencia.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),

  // Operación
  MANUAL_REVIEW_REQUIRED: def("MANUAL_REVIEW_REQUIRED", {
    publicMessage: "Tu obra está en revisión manual.",
    internalMessage: "Cola de admisión técnica.",
    severity: "warning",
    recommendedAction: "MANUAL_REVIEW",
    evidenceHint: "N/A",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  EVIDENCE_REQUESTED: def("EVIDENCE_REQUESTED", {
    publicMessage: "Se solicitó evidencia adicional para tu obra.",
    internalMessage: "Estado operativo evidenceRequest OPEN.",
    severity: "warning",
    recommendedAction: "REQUEST_EVIDENCE",
    evidenceHint: "Ver tipo de evidencia y deadline.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  REPLACEMENT_ALLOWED: def("REPLACEMENT_ALLOWED", {
    publicMessage: "Podés reemplazar el archivo de tu obra.",
    internalMessage: "manualReviewStatus=REPLACEMENT_REQUESTED.",
    severity: "warning",
    recommendedAction: "ALLOW_REPLACEMENT",
    evidenceHint: "Nuevo upload invalida análisis anterior.",
    visibility: "both",
    allowsReplacement: true,
    blocksJury: true,
  }),
  REPLACEMENT_DEADLINE_EXPIRED: def("REPLACEMENT_DEADLINE_EXPIRED", {
    publicMessage: "El plazo para reemplazar la obra venció.",
    internalMessage: "Deadline de reemplazo expirado.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "No permitir replace.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  ADMISSION_APPROVED: def("ADMISSION_APPROVED", {
    publicMessage: "Tu obra fue admitida técnicamente.",
    internalMessage: "admissionStatus=ADMITTED.",
    severity: "info",
    recommendedAction: "ADMIT",
    evidenceHint: "Checklist + versión de reglas.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: false,
  }),
  ADMISSION_REJECTED: def("ADMISSION_REJECTED", {
    publicMessage: "Tu obra no fue admitida.",
    internalMessage: "admissionStatus=REJECTED con reason obligatorio.",
    severity: "blocking",
    recommendedAction: "REJECT",
    evidenceHint: "Motivo público; notas internas ocultas.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: true,
  }),
  ENTRY_FROZEN: def("ENTRY_FROZEN", {
    publicMessage: "Tu obra quedó congelada para el jurado.",
    internalMessage: "admissionStatus=FROZEN_FOR_JURY.",
    severity: "info",
    recommendedAction: "FREEZE",
    evidenceHint: "Sin replace ni cambio de categoría.",
    visibility: "both",
    allowsReplacement: false,
    blocksJury: false,
  }),
} as const;

export type AdmissionReasonCode = keyof typeof ADMISSION_REASON_CODES;

export function isAdmissionReasonCode(code: string): code is AdmissionReasonCode {
  return Object.prototype.hasOwnProperty.call(ADMISSION_REASON_CODES, code);
}

export function getAdmissionReason(code: string): AdmissionReasonDefinition | null {
  if (!isAdmissionReasonCode(code)) return null;
  return ADMISSION_REASON_CODES[code];
}

export function assertAdmissionReasonCode(code: string): AdmissionReasonCode {
  if (!isAdmissionReasonCode(code)) {
    throw new Error(`REASON_CODE_UNKNOWN:${code}`);
  }
  return code;
}

export function publicMessageForReason(code: string, fallback?: string): string {
  return getAdmissionReason(code)?.publicMessage ?? fallback ?? "Observación técnica.";
}
