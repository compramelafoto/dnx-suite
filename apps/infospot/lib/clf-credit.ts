import {
  buildEditorialPhotoCopyright,
  buildEditorialPhotoCredit,
} from "./editorial-photos/credit";

/** Crédito público estándar Info Spot × CLF. */
export function buildClfPhotoCredit(
  photographerName: string | null | undefined,
  companyName?: string | null,
): string {
  return buildEditorialPhotoCredit({ photographerName, companyName });
}

export function buildClfCopyright(photographerName: string | null | undefined): string {
  return buildEditorialPhotoCopyright(photographerName);
}
