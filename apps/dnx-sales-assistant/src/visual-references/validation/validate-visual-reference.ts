import { existsSync, statSync } from "node:fs";
import { isEducationalPurpose } from "../domain/educational-purpose.js";
import type { VisualReference } from "../domain/visual-reference.js";
import { isVisualReferenceNiche } from "../domain/visual-reference-niche.js";
import {
  VISUAL_REFERENCE_MAX_BYTES,
  VISUAL_REFERENCE_MIME_BY_EXT,
} from "../catalog/paths.js";
import { resolveAllowedAssetPath } from "./resolve-asset-path.js";
import type { VisualReferenceValidationIssue } from "./validation-codes.js";

const ORIENTATIONS = new Set(["LANDSCAPE", "PORTRAIT", "SQUARE"]);
const STATUSES = new Set(["DRAFT", "APPROVED", "DISABLED"]);

export type ValidateVisualReferenceOptions = {
  /** Si true, exige que el archivo exista en disco. */
  requireFileExists?: boolean;
  /** Si true (default), falla si authorizedForPublicAssistant. */
  forbidPublicAuthorization?: boolean;
  now?: Date;
};

export function validateVisualReference(
  ref: VisualReference,
  options: ValidateVisualReferenceOptions = {},
): VisualReferenceValidationIssue[] {
  const issues: VisualReferenceValidationIssue[] = [];
  const id = ref.id?.trim() || undefined;
  const requireFile = options.requireFileExists !== false;
  const forbidPublic = options.forbidPublicAuthorization !== false;
  const now = options.now ?? new Date();

  if (!ref.id || !String(ref.id).trim()) {
    issues.push({
      code: "VISUAL_REFERENCE_ID_REQUIRED",
      message: "ID obligatorio.",
    });
  }

  if (!ref.title?.trim()) {
    issues.push({
      code: "VISUAL_REFERENCE_TITLE_REQUIRED",
      message: "Título obligatorio.",
      referenceId: id,
    });
  }

  if (!ref.description?.trim()) {
    issues.push({
      code: "VISUAL_REFERENCE_DESCRIPTION_REQUIRED",
      message: "Descripción obligatoria.",
      referenceId: id,
    });
  }

  if (!Array.isArray(ref.niches) || ref.niches.length === 0) {
    issues.push({
      code: "VISUAL_REFERENCE_NICHE_REQUIRED",
      message: "Al menos un nicho es obligatorio.",
      referenceId: id,
    });
  } else {
    for (const niche of ref.niches) {
      if (!isVisualReferenceNiche(niche)) {
        issues.push({
          code: "VISUAL_REFERENCE_INVALID_NICHE",
          message: `Nicho inválido: ${niche}`,
          referenceId: id,
        });
      }
    }
  }

  if (!Array.isArray(ref.educationalPurpose) || ref.educationalPurpose.length === 0) {
    issues.push({
      code: "VISUAL_REFERENCE_EDUCATIONAL_PURPOSE_REQUIRED",
      message: "Al menos un propósito educativo es obligatorio.",
      referenceId: id,
    });
  } else {
    for (const purpose of ref.educationalPurpose) {
      if (!isEducationalPurpose(purpose)) {
        issues.push({
          code: "VISUAL_REFERENCE_INVALID_EDUCATIONAL_PURPOSE",
          message: `Propósito educativo inválido: ${purpose}`,
          referenceId: id,
        });
      }
    }
  }

  if (!ORIENTATIONS.has(ref.orientation)) {
    issues.push({
      code: "VISUAL_REFERENCE_INVALID_ORIENTATION",
      message: `Orientación inválida: ${ref.orientation}`,
      referenceId: id,
    });
  }

  if (!STATUSES.has(ref.status)) {
    issues.push({
      code: "VISUAL_REFERENCE_INVALID_STATUS",
      message: `Estado inválido: ${ref.status}`,
      referenceId: id,
    });
  }

  if (!ref.imagePath?.trim()) {
    issues.push({
      code: "VISUAL_REFERENCE_IMAGE_PATH_REQUIRED",
      message: "imagePath obligatorio.",
      referenceId: id,
    });
  } else {
    const resolved = resolveAllowedAssetPath(ref.imagePath);
    if (!resolved.ok) {
      if (resolved.reason === "TRAVERSAL") {
        issues.push({
          code: "VISUAL_REFERENCE_PATH_TRAVERSAL",
          message: "Path traversal o ruta remota no permitida.",
          referenceId: id,
        });
      } else if (resolved.reason === "OUTSIDE") {
        issues.push({
          code: "VISUAL_REFERENCE_IMAGE_OUTSIDE_ALLOWED_DIRECTORY",
          message: "La imagen debe estar dentro de .local/visual-references/assets/.",
          referenceId: id,
        });
      } else if (resolved.reason === "INVALID_EXT") {
        issues.push({
          code: "VISUAL_REFERENCE_INVALID_MIME",
          message: "Formato no permitido (solo JPEG, PNG, WebP).",
          referenceId: id,
        });
      } else {
        issues.push({
          code: "VISUAL_REFERENCE_IMAGE_PATH_REQUIRED",
          message: "imagePath vacío.",
          referenceId: id,
        });
      }
    } else {
      if (!VISUAL_REFERENCE_MIME_BY_EXT[resolved.ext]) {
        issues.push({
          code: "VISUAL_REFERENCE_INVALID_MIME",
          message: "MIME no permitido.",
          referenceId: id,
        });
      }
      if (requireFile) {
        if (!existsSync(resolved.absolutePath)) {
          issues.push({
            code: "VISUAL_REFERENCE_IMAGE_NOT_FOUND",
            message: "Archivo de imagen no encontrado.",
            referenceId: id,
          });
        } else {
          const size = statSync(resolved.absolutePath).size;
          if (size > VISUAL_REFERENCE_MAX_BYTES) {
            issues.push({
              code: "VISUAL_REFERENCE_FILE_TOO_LARGE",
              message: `Archivo supera ${VISUAL_REFERENCE_MAX_BYTES} bytes.`,
              referenceId: id,
            });
          }
        }
      }
    }
  }

  if (ref.source?.kind !== "LOCAL_CURATED") {
    issues.push({
      code: "VISUAL_REFERENCE_UNSUPPORTED_SOURCE",
      message: "Sólo LOCAL_CURATED está soportado en esta etapa.",
      referenceId: id,
    });
  }

  const rights = ref.rights;
  if (!rights) {
    issues.push({
      code: "VISUAL_REFERENCE_USAGE_NOT_AUTHORIZED",
      message: "Derechos ausentes.",
      referenceId: id,
    });
    return issues;
  }

  if (rights.authorizationBasis === "UNKNOWN") {
    issues.push({
      code: "VISUAL_REFERENCE_UNKNOWN_RIGHTS",
      message: "authorizationBasis UNKNOWN no puede mostrarse.",
      referenceId: id,
    });
  }

  if (!rights.usageAuthorized) {
    issues.push({
      code: "VISUAL_REFERENCE_USAGE_NOT_AUTHORIZED",
      message: "usageAuthorized debe ser true.",
      referenceId: id,
    });
  }

  if (!rights.authorizedForInternalReview) {
    issues.push({
      code: "VISUAL_REFERENCE_INTERNAL_REVIEW_NOT_AUTHORIZED",
      message: "authorizedForInternalReview debe ser true.",
      referenceId: id,
    });
  }

  if (forbidPublic && rights.authorizedForPublicAssistant) {
    issues.push({
      code: "VISUAL_REFERENCE_PUBLIC_AUTHORIZATION_FORBIDDEN",
      message: "authorizedForPublicAssistant no permitido en esta etapa.",
      referenceId: id,
    });
  }

  if (rights.attributionRequired) {
    if (!rights.attributionText?.trim()) {
      issues.push({
        code: "VISUAL_REFERENCE_ATTRIBUTION_MISSING",
        message: "attributionText obligatorio cuando attributionRequired.",
        referenceId: id,
      });
    }
  }

  if (rights.expiresAt) {
    const exp = Date.parse(rights.expiresAt);
    if (!Number.isNaN(exp) && exp < now.getTime()) {
      issues.push({
        code: "VISUAL_REFERENCE_EXPIRED",
        message: "Autorización vencida.",
        referenceId: id,
      });
    }
  }

  return issues;
}

/** True si la referencia puede mostrarse en el laboratorio. */
export function isDisplayableVisualReference(
  ref: VisualReference,
  options?: ValidateVisualReferenceOptions,
): boolean {
  if (ref.status !== "APPROVED") return false;
  return validateVisualReference(ref, options).length === 0;
}
