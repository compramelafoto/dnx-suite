/**
 * Allowlist explícita para respuestas del panel jurado.
 * Nunca construir el DTO desde el modelo Prisma completo.
 */

export const JURY_FORBIDDEN_FIELD_NAMES = [
  "participantUserId",
  "authorUserId",
  "registrationId",
  "email",
  // "name" no está en la lista: la rúbrica expone `criteria[].name` (etiqueta del criterio).
  // Identidad del participante viaja como participantName / authorName / etc. (bloqueados abajo).
  "participantName",
  "authorName",
  "fullName",
  "firstName",
  "lastName",
  "phone",
  "instagram",
  "rulesAcceptanceIp",
  "rulesAcceptanceUserAgent",
  "paymentOrderId",
  "financialPolicySnapshot",
  "originalFileName",
  "storageKey",
  "sha256",
  "rawMetadataJson",
  "gpsLatitude",
  "gpsLongitude",
  "gpsAltitude",
] as const;

export type JuryAllowedCheck = {
  checkCode: string;
  checkGroup: string;
  status: string;
  title: string;
  message: string;
};

export type JuryTechnicalSummaryView = {
  technicalSummaryStatus: string;
  fileValid: boolean;
  width: number | null;
  height: number | null;
  orientation: string | null;
  exifAvailable: boolean;
  deviceCompatibility: string | null;
  editingSoftwareWarning: boolean;
  manualReviewApproved: boolean;
  requiresReview: boolean;
  warningCount: number;
  allowedChecks: JuryAllowedCheck[];
  evaluationStatus: "NOT_STARTED" | "IN_PROGRESS" | "POSTPONED" | "COMPLETED" | "CONFLICT_DECLARED";
  evaluationEnabled: false;
  evaluationMessage: string;
};

export type JuryEntryListItem = {
  entryId: string;
  snapshotId: string | null;
  anonymousCode: string;
  categoryId: string;
  categoryName: string;
  promptSequence: number | null;
  promptTitle: string | null;
  technicalSummaryStatus: string;
  warningCount: number;
  evaluationStatus: JuryTechnicalSummaryView["evaluationStatus"];
  conflictDeclared: boolean;
  previewUrl: string | null;
  sortKey: string;
};

export type JuryEntryDetail = JuryEntryListItem & {
  technical: JuryTechnicalSummaryView;
  judgingEndsAt: string | null;
  promptInstructions: string | null;
  rubric: {
    id: string;
    name: string;
    version: number;
    criteria: Array<{
      key: string;
      name: string;
      description: string | null;
      minScore: number;
      maxScore: number;
      step: number;
      weight: number;
      required: boolean;
      helpText: string | null;
    }>;
  } | null;
  evaluation: {
    id: string;
    status: string;
    expectedVersion: number;
    totalScore: number | null;
    privateComment: string | null;
    scores: Record<string, number>;
  } | null;
  scoringSessionOpen: boolean;
};

/** Checks que el jurado puede ver (sin detailsJson). */
export const JURY_ALLOWED_CHECK_CODES = new Set([
  "FILE_MIME",
  "FILE_EXT",
  "FILE_SIZE",
  "FILE_DECODE",
  "FILE_MIN_WIDTH",
  "FILE_MIN_HEIGHT",
  "FILE_MAX_DIMS",
  "FILE_MIN_MP",
  "FILE_ORIENTATION",
  "META_EXIF",
  "META_CAPTURE_DATE",
  "META_DEVICE",
  "META_SOFTWARE",
  "CAT_DEVICE",
  "DUPLICATE_CONTEST",
  "SEC_MAGIC",
  "SEC_PRIVATE",
]);

export function assertNoForbiddenJuryFields(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof value !== "object") return;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${k}` : k;
      if ((JURY_FORBIDDEN_FIELD_NAMES as readonly string[]).includes(k)) {
        found.push(next);
      }
      walk(v, next);
    }
  };
  walk(payload, "");
  return found;
}
