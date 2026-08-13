/**
 * Validación de identidad canónica y assets para welcome (sin Prisma).
 */
import { PartnersDomainError } from "./types";
import { assertSafePartnerDestinationUrl } from "./tracking";

const CANONICAL_ID_RE = /^[a-z0-9]{20,36}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALBUM_INT_RE = /^\d{1,12}$/;

const ALLOWED_WELCOME_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type WelcomeCanonicalIdKind = "EDITION" | "CONTEST" | "ALBUM";

/**
 * Rechaza slugs/nombres: solo IDs canónicos (cuid/uuid para FR/CK; entero para álbum).
 */
export function assertWelcomeCanonicalContextIdFormat(
  kind: WelcomeCanonicalIdKind,
  raw: string | null | undefined,
): string {
  const id = raw?.trim() ?? "";
  if (!id) {
    throw new PartnersDomainError("VALIDATION", "Falta el ID canónico del contexto.");
  }
  if (/\s/.test(id) || id.includes("/") || id.includes(".") || id.includes("_")) {
    throw new PartnersDomainError(
      "VALIDATION",
      "El contexto debe ser un ID canónico, no un slug ni un nombre.",
    );
  }
  // Slugs tipicos: "santa-fe-2026", "mi-album"
  if (id.includes("-") && !UUID_RE.test(id)) {
    throw new PartnersDomainError(
      "VALIDATION",
      "Parece un slug. Seleccioná la entidad en el buscador para guardar el ID canónico.",
    );
  }
  if (kind === "ALBUM") {
    if (!ALBUM_INT_RE.test(id) || id === "0") {
      throw new PartnersDomainError(
        "VALIDATION",
        "El álbum debe identificarse por Album.id numérico canónico.",
      );
    }
    return id;
  }
  if (!CANONICAL_ID_RE.test(id) && !UUID_RE.test(id)) {
    throw new PartnersDomainError(
      "VALIDATION",
      kind === "EDITION"
        ? "La edición debe identificarse por su ID canónico, no por slug."
        : "El concurso debe identificarse por su ID canónico, no por slug.",
    );
  }
  return id;
}

export type WelcomeAssetPublishCheckInput = {
  partnerId: string;
  assetPartnerId: string;
  approvalStatus: string;
  status: string;
  archivedAt?: Date | string | null;
  fileUrl?: string | null;
  altText?: string | null;
  mimeType?: string | null;
  /** Si true, solo preview: no exige APPROVED. */
  previewDraft?: boolean;
};

export type WelcomeAssetPublishIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export function validateWelcomeAssetForPublish(
  input: WelcomeAssetPublishCheckInput,
): WelcomeAssetPublishIssue[] {
  const issues: WelcomeAssetPublishIssue[] = [];

  if (input.previewDraft) {
    issues.push({
      code: "PREVIEW_DRAFT",
      message: "Vista previa de borrador: no apto para publicar.",
      severity: "warning",
    });
    return issues;
  }

  if (input.assetPartnerId !== input.partnerId) {
    issues.push({
      code: "ASSET_PARTNER",
      message: "El asset no pertenece a este sponsor.",
      severity: "error",
    });
  }
  if (input.archivedAt) {
    issues.push({
      code: "ASSET_ARCHIVED",
      message: "El asset está archivado.",
      severity: "error",
    });
  }
  if (input.status !== "ACTIVE") {
    issues.push({
      code: "ASSET_STATUS",
      message: "El asset debe estar ACTIVE.",
      severity: "error",
    });
  }
  if (input.approvalStatus !== "APPROVED") {
    issues.push({
      code: "ASSET_APPROVAL",
      message:
        "El asset debe estar aprobado formalmente. Una URL pegada o un borrador PENDING no alcanza para publicar.",
      severity: "error",
    });
  }
  const alt = input.altText?.trim() ?? "";
  if (!alt) {
    issues.push({
      code: "ASSET_ALT",
      message: "El asset requiere texto alternativo.",
      severity: "error",
    });
  }
  const url = input.fileUrl?.trim() ?? "";
  if (!url) {
    issues.push({
      code: "ASSET_URL",
      message: "El asset no tiene URL pública disponible.",
      severity: "error",
    });
  } else {
    try {
      assertSafePartnerDestinationUrl(url);
    } catch (e) {
      issues.push({
        code: "ASSET_URL_UNSAFE",
        message: e instanceof Error ? e.message : "URL de asset insegura.",
        severity: "error",
      });
    }
    if (/\.svg(\?|$)/i.test(url) || (input.mimeType ?? "").toLowerCase().includes("svg")) {
      issues.push({
        code: "ASSET_SVG",
        message: "SVG no admitido para welcome (pipeline sin sanitizado).",
        severity: "error",
      });
    }
  }
  const mime = (input.mimeType ?? "").toLowerCase().trim();
  if (mime && !ALLOWED_WELCOME_MIME.has(mime) && mime !== "image/jpg") {
    if (!mime.startsWith("image/")) {
      issues.push({
        code: "ASSET_MIME",
        message: "Tipo de archivo no admitido. Usá PNG, WebP, JPG o GIF.",
        severity: "error",
      });
    }
  }

  return issues;
}

export function assertWelcomeAssetPublishable(input: WelcomeAssetPublishCheckInput): void {
  const issues = validateWelcomeAssetForPublish(input).filter((i) => i.severity === "error");
  if (issues.length) {
    throw new PartnersDomainError("VALIDATION", issues.map((i) => i.message).join(" · "));
  }
}
