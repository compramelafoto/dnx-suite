/**
 * Checklist de publicación con fotos CLF editoriales.
 */

import type { PublishChecklistItem } from "../launch-content";

export type EditorialPhotoChecklistInput = {
  processStatus: string;
  photographerName: string | null;
  credit: string | null;
  editorialLicenseStatus: string;
  hasDerivative: boolean;
  commercialStatus: string;
  usageType: string;
  altText?: string | null;
};

export function evaluateEditorialPhotosForPublish(
  photos: EditorialPhotoChecklistInput[],
): PublishChecklistItem[] {
  if (photos.length === 0) return [];

  const allReady = photos.every((p) => p.processStatus === "READY");
  const noneProcessing = photos.every(
    (p) => p.processStatus !== "PROCESSING" && p.processStatus !== "PENDING",
  );
  const noneFailed = photos.every((p) => p.processStatus !== "FAILED");
  const allAuthors = photos.every((p) => Boolean(p.photographerName?.trim()));
  const allCredits = photos.every((p) => Boolean(p.credit?.trim()));
  const allLicensed = photos.every((p) => p.editorialLicenseStatus === "AUTHORIZED");
  const allDerivatives = photos.every((p) => p.hasDerivative);
  const allAlt = photos.every((p) => Boolean(p.altText?.trim()));
  const deletedWithoutLicense = photos.some(
    (p) =>
      p.commercialStatus === "DELETED" && p.editorialLicenseStatus !== "AUTHORIZED",
  );

  return [
    {
      id: "clf-photos-ready",
      label: "Fotos CLF listas (READY)",
      ok: allReady && noneProcessing && noneFailed,
      required: true,
    },
    {
      id: "clf-photos-author",
      label: "Autor en todas las fotos CLF",
      ok: allAuthors,
      required: true,
    },
    {
      id: "clf-photos-credit",
      label: "Crédito en todas las fotos CLF",
      ok: allCredits,
      required: true,
    },
    {
      id: "clf-photos-alt",
      label: "Alt text en todas las fotos CLF",
      ok: allAlt,
      required: true,
    },
    {
      id: "clf-photos-license",
      label: "Licencia editorial autorizada en todas las fotos",
      ok: allLicensed && !deletedWithoutLicense,
      required: true,
    },
    {
      id: "clf-photos-derivative",
      label: "Derivados editoriales generados",
      ok: allDerivatives,
      required: true,
    },
  ];
}

const FAIL_HINTS: Record<string, string> = {
  "clf-photos-ready":
    "Hay fotos CLF que aún no están listas (PROCESSING/PENDING/FAILED).",
  "clf-photos-author": "Falta el nombre del fotógrafo en alguna foto CLF.",
  "clf-photos-credit": "Falta el crédito en alguna foto CLF.",
  "clf-photos-alt":
    "Falta la descripción (alt text) en alguna foto CLF. Completala en Biblioteca.",
  "clf-photos-license":
    "Hay fotos CLF con licencia pendiente (PENDING). En producción las fotos importadas quedan PENDING hasta que Dirección las autorice, o hasta activar el contrato editorial automático.",
  "clf-photos-derivative":
    "Faltan derivados editoriales en alguna foto CLF (reprocesar / esperar el job).",
};

export function assertEditorialPhotosPublishable(
  photos: EditorialPhotoChecklistInput[],
): { ok: true } | { ok: false; error: string } {
  const items = evaluateEditorialPhotosForPublish(photos);
  const failed = items.find((i) => i.required && !i.ok);
  if (failed) {
    const hint = FAIL_HINTS[failed.id] ?? failed.label;
    return { ok: false, error: `Checklist fotos CLF: ${hint}` };
  }
  return { ok: true };
}
