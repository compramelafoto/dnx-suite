import type { UploadPolicy } from "./upload-policy";
import type { DuplicateMatch } from "./hash";
import type { DeviceCompatibility, EntryExifResult } from "./exif";

export type CheckStatus = "PASS" | "WARNING" | "FAIL" | "NOT_AVAILABLE" | "REQUIRES_REVIEW";
export type CheckGroup =
  | "FILE"
  | "REGISTRATION"
  | "CONTEST"
  | "CATEGORY"
  | "METADATA"
  | "DUPLICATE"
  | "SECURITY"
  | "TIMING";

export type ChecklistItem = {
  checkCode: string;
  checkGroup: CheckGroup;
  status: CheckStatus;
  severity: string | null;
  title: string;
  message: string;
  detailsJson?: Record<string, unknown>;
};

export type TechnicalSummaryStatus =
  | "APPROVED"
  | "APPROVED_WITH_WARNINGS"
  | "REQUIRES_REVIEW"
  | "TECHNICALLY_REJECTED"
  | "NOT_EVALUATED";

export type TechnicalSummary = {
  status: TechnicalSummaryStatus;
  total: number;
  passed: number;
  warnings: number;
  failures: number;
  requiresReview: number;
  notAvailable: number;
  evaluatedAt: string;
  ruleVersion: string;
};

export const CHECKLIST_RULE_VERSION = "p0-06-v1";

export type BuildChecklistInput = {
  policy: UploadPolicy;
  mimeType: string;
  extension: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  decodable: boolean;
  registrationConfirmed: boolean;
  categoryMatches: boolean;
  userMatches: boolean;
  contestActive: boolean;
  categoryActive: boolean;
  withinUploadWindow: boolean;
  maxEntriesOk: boolean;
  exif: EntryExifResult;
  duplicate: DuplicateMatch;
  deviceCompatibility: DeviceCompatibility;
  storagePrivate: boolean;
  storageKeyValid: boolean;
};

function item(
  checkCode: string,
  checkGroup: CheckGroup,
  status: CheckStatus,
  title: string,
  message: string,
  details?: Record<string, unknown>,
): ChecklistItem {
  return {
    checkCode,
    checkGroup,
    status,
    severity: status === "FAIL" ? "blocking" : status === "WARNING" || status === "REQUIRES_REVIEW" ? "soft" : null,
    title,
    message,
    detailsJson: details,
  };
}

export function buildChecklist(input: BuildChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const mp = (input.width * input.height) / 1_000_000;

  // FILE
  items.push(
    item(
      "FILE_MIME",
      "FILE",
      input.policy.allowedMimeTypes.includes(input.mimeType) ? "PASS" : "FAIL",
      "Tipo MIME",
      input.policy.allowedMimeTypes.includes(input.mimeType)
        ? `MIME permitido: ${input.mimeType}`
        : `MIME no permitido: ${input.mimeType}`,
      { mimeType: input.mimeType },
    ),
  );
  items.push(
    item(
      "FILE_EXTENSION",
      "FILE",
      input.policy.allowedExtensions.includes(input.extension) ? "PASS" : "FAIL",
      "Extensión",
      input.policy.allowedExtensions.includes(input.extension)
        ? `Extensión permitida: .${input.extension}`
        : `Extensión no permitida: .${input.extension}`,
    ),
  );
  items.push(
    item(
      "FILE_SIZE",
      "FILE",
      input.fileSizeBytes <= input.policy.maxFileSizeBytes ? "PASS" : "FAIL",
      "Tamaño de archivo",
      input.fileSizeBytes <= input.policy.maxFileSizeBytes
        ? "El tamaño está dentro del límite."
        : `El archivo supera el máximo de ${input.policy.maxFileSizeBytes} bytes.`,
      { fileSizeBytes: input.fileSizeBytes },
    ),
  );
  items.push(
    item(
      "FILE_DECODABLE",
      "FILE",
      input.decodable ? "PASS" : "FAIL",
      "Archivo decodificable",
      input.decodable ? "La imagen se pudo leer." : "El archivo está corrupto o no es una imagen válida.",
    ),
  );
  if (input.decodable) {
    items.push(
      item(
        "FILE_MIN_WIDTH",
        "FILE",
        input.width >= input.policy.minWidth ? "PASS" : "FAIL",
        "Ancho mínimo",
        `${input.width}px (mín. ${input.policy.minWidth})`,
      ),
    );
    items.push(
      item(
        "FILE_MIN_HEIGHT",
        "FILE",
        input.height >= input.policy.minHeight ? "PASS" : "FAIL",
        "Alto mínimo",
        `${input.height}px (mín. ${input.policy.minHeight})`,
      ),
    );
    items.push(
      item(
        "FILE_MAX_DIM",
        "FILE",
        input.width <= input.policy.maxWidth && input.height <= input.policy.maxHeight ? "PASS" : "FAIL",
        "Dimensiones máximas",
        `${input.width}×${input.height}`,
      ),
    );
    items.push(
      item(
        "FILE_MIN_MP",
        "FILE",
        mp >= input.policy.minMegapixels ? "PASS" : "FAIL",
        "Megapíxeles mínimos",
        `${mp.toFixed(2)} MP (mín. ${input.policy.minMegapixels})`,
      ),
    );
  }

  // REGISTRATION / CONTEST
  items.push(
    item(
      "REG_CONFIRMED",
      "REGISTRATION",
      input.registrationConfirmed ? "PASS" : "FAIL",
      "Inscripción confirmada",
      input.registrationConfirmed ? "Inscripción válida." : "La inscripción no está confirmada.",
    ),
  );
  items.push(
    item(
      "REG_CATEGORY",
      "REGISTRATION",
      input.categoryMatches ? "PASS" : "FAIL",
      "Categoría coincidente",
      input.categoryMatches ? "La categoría coincide con la inscripción." : "Categoría inválida.",
    ),
  );
  items.push(
    item(
      "REG_USER",
      "REGISTRATION",
      input.userMatches ? "PASS" : "FAIL",
      "Participante coincidente",
      input.userMatches ? "El usuario es el dueño de la inscripción." : "Usuario no autorizado.",
    ),
  );
  items.push(
    item(
      "REG_MAX_ENTRIES",
      "REGISTRATION",
      input.maxEntriesOk ? "PASS" : "FAIL",
      "Cantidad de obras",
      input.maxEntriesOk ? "Dentro del cupo de obras." : "Se superó el máximo de obras por inscripción.",
    ),
  );
  items.push(
    item(
      "CONTEST_ACTIVE",
      "CONTEST",
      input.contestActive ? "PASS" : "FAIL",
      "Concurso activo",
      input.contestActive ? "El concurso admite carga." : "El concurso no admite carga.",
    ),
  );
  items.push(
    item(
      "CONTEST_CATEGORY_ACTIVE",
      "CONTEST",
      input.categoryActive ? "PASS" : "FAIL",
      "Categoría activa",
      input.categoryActive ? "Categoría activa." : "Categoría archivada.",
    ),
  );
  items.push(
    item(
      "TIMING_WINDOW",
      "TIMING",
      input.withinUploadWindow ? "PASS" : "FAIL",
      "Ventana de carga",
      input.withinUploadWindow ? "Dentro del plazo." : "Fuera de la ventana de carga.",
    ),
  );

  // METADATA — EXIF ausente NUNCA es FAIL
  if (input.exif.metadataStatus === "NOT_AVAILABLE") {
    items.push(
      item(
        "META_EXIF",
        "METADATA",
        input.policy.requireExif ? "REQUIRES_REVIEW" : "WARNING",
        "Metadatos EXIF",
        "No se encontraron metadatos EXIF. Esto no implica rechazo automático.",
        { status: input.exif.metadataStatus },
      ),
    );
  } else if (input.exif.metadataStatus === "FAILED" || input.exif.metadataStatus === "INVALID") {
    items.push(
      item(
        "META_EXIF",
        "METADATA",
        "WARNING",
        "Metadatos EXIF",
        "No se pudieron leer los metadatos EXIF de forma confiable.",
        { status: input.exif.metadataStatus },
      ),
    );
  } else {
    items.push(
      item("META_EXIF", "METADATA", "PASS", "Metadatos EXIF", `Estado: ${input.exif.metadataStatus}.`),
    );
  }

  items.push(
    item(
      "META_CAPTURE_DATE",
      "METADATA",
      input.exif.captureDate
        ? "PASS"
        : input.policy.requireCaptureDate
          ? "REQUIRES_REVIEW"
          : "NOT_AVAILABLE",
      "Fecha de captura",
      input.exif.captureDate
        ? `Fecha: ${input.exif.captureDate.toISOString()}`
        : "Fecha de captura no disponible.",
    ),
  );
  items.push(
    item(
      "META_GPS",
      "METADATA",
      input.exif.gpsLatitude != null
        ? "PASS"
        : input.policy.requireGps
          ? "REQUIRES_REVIEW"
          : "NOT_AVAILABLE",
      "GPS",
      input.exif.gpsLatitude != null ? "Coordenadas presentes (uso interno)." : "GPS no disponible.",
    ),
  );

  const deviceStatus: CheckStatus =
    input.deviceCompatibility === "compatible"
      ? "PASS"
      : input.deviceCompatibility === "probable"
        ? "WARNING"
        : input.deviceCompatibility === "inconsistent"
          ? "REQUIRES_REVIEW"
          : input.deviceCompatibility === "requires_review"
            ? "REQUIRES_REVIEW"
            : "NOT_AVAILABLE";
  items.push(
    item(
      "CATEGORY_DEVICE",
      "CATEGORY",
      deviceStatus,
      "Compatibilidad de dispositivo",
      `Evaluación: ${input.deviceCompatibility}. No descalifica automáticamente.`,
      { deviceCompatibility: input.deviceCompatibility },
    ),
  );

  // DUPLICATE
  if (input.duplicate.scope === "SAME_REGISTRATION") {
    items.push(
      item(
        "DUP_REGISTRATION",
        "DUPLICATE",
        "PASS",
        "Duplicado en inscripción",
        "Mismo archivo en la misma inscripción (idempotencia).",
      ),
    );
  } else if (input.duplicate.scope === "SAME_CONTEST") {
    items.push(
      item(
        "DUP_CONTEST",
        "DUPLICATE",
        "REQUIRES_REVIEW",
        "Duplicado en concurso",
        "Hay otra obra con el mismo hash en este concurso. Requiere revisión humana.",
        { matchingEntryId: input.duplicate.matchingEntryId },
      ),
    );
  } else {
    items.push(
      item("DUP_CONTEST", "DUPLICATE", "PASS", "Duplicado en concurso", "Sin duplicado exacto en el concurso."),
    );
  }

  // SECURITY
  items.push(
    item(
      "SEC_PRIVATE_STORAGE",
      "SECURITY",
      input.storagePrivate ? "PASS" : "FAIL",
      "Almacenamiento privado",
      input.storagePrivate ? "Original en storage privado." : "Storage no privado.",
    ),
  );
  items.push(
    item(
      "SEC_KEY",
      "SECURITY",
      input.storageKeyValid ? "PASS" : "FAIL",
      "Key de storage",
      input.storageKeyValid ? "Key válida sin PII." : "Key inválida.",
    ),
  );

  return items;
}

export function summarizeChecklist(items: ChecklistItem[], now = new Date()): TechnicalSummary {
  const failures = items.filter((i) => i.status === "FAIL").length;
  const warnings = items.filter((i) => i.status === "WARNING").length;
  const requiresReview = items.filter((i) => i.status === "REQUIRES_REVIEW").length;
  const notAvailable = items.filter((i) => i.status === "NOT_AVAILABLE").length;
  const passed = items.filter((i) => i.status === "PASS").length;

  let status: TechnicalSummaryStatus = "APPROVED";
  if (failures > 0) status = "TECHNICALLY_REJECTED";
  else if (requiresReview > 0) status = "REQUIRES_REVIEW";
  else if (warnings > 0) status = "APPROVED_WITH_WARNINGS";

  return {
    status,
    total: items.length,
    passed,
    warnings,
    failures,
    requiresReview,
    notAvailable,
    evaluatedAt: now.toISOString(),
    ruleVersion: CHECKLIST_RULE_VERSION,
  };
}

export function entryStatusFromSummary(
  summary: TechnicalSummary,
): "READY_TO_CONFIRM" | "REQUIRES_REVIEW" | "REJECTED" {
  if (summary.status === "TECHNICALLY_REJECTED") return "REJECTED";
  if (summary.status === "REQUIRES_REVIEW") return "REQUIRES_REVIEW";
  return "READY_TO_CONFIRM";
}
