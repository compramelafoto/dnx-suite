import type { DeviceKind } from "../eligibility";
import type { EntryEligibilityFormInput } from "./entry-service";

function formStr(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === "string" ? v : null;
}

function formFlag(form: FormData, key: string): boolean {
  const v = formStr(form, key);
  return v === "1" || v === "true";
}

/**
 * Parsea elegibilidad / declaraciones enviadas por el wizard de carga (FormData).
 * Debe incluir autoría, edición e IA: si se omiten, processUploadedFile rechaza con DECLARATIONS_REQUIRED.
 */
export function parseEntryEligibilityFormData(form: FormData): EntryEligibilityFormInput {
  return {
    captureLocality: formStr(form, "captureLocality"),
    captureDepartment: formStr(form, "captureDepartment"),
    territoryConfirmedSantaFe: formFlag(form, "territoryConfirmedSantaFe"),
    declaredDeviceKind: (formStr(form, "declaredDeviceKind") as DeviceKind | null) ?? null,
    declaredDeviceMake: formStr(form, "declaredDeviceMake"),
    declaredDeviceModel: formStr(form, "declaredDeviceModel"),
    captureWithinPeriodDeclared: formFlag(form, "captureWithinPeriodDeclared"),
    authorshipDeclared: formFlag(form, "authorshipDeclared"),
    editingPolicyDeclared: formFlag(form, "editingPolicyDeclared"),
    noGenerativeAiDeclared: formFlag(form, "noGenerativeAiDeclared"),
    droneRegulationAcknowledged: formFlag(form, "droneRegulationAcknowledged"),
    instagramHandle: formStr(form, "instagramHandle"),
  };
}

function jsonStr(src: Record<string, unknown>, key: string): string | null {
  const v = src[key];
  return typeof v === "string" ? v : null;
}

/** Los flags viajan como booleanos en JSON, pero se tolera el "1"/"true" del FormData. */
function jsonFlag(src: Record<string, unknown>, key: string): boolean {
  const v = src[key];
  return v === true || v === "1" || v === "true";
}

/**
 * Misma elegibilidad que `parseEntryEligibilityFormData`, para el cierre de la
 * subida directa: ahí el pedido es JSON porque el archivo ya viajó al bucket.
 * Ambos parsers deben producir lo mismo ante el mismo formulario — lo fija
 * `eligibility-form.selfcheck.ts`.
 */
export function parseEntryEligibilityJson(raw: unknown): EntryEligibilityFormInput {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    captureLocality: jsonStr(src, "captureLocality"),
    captureDepartment: jsonStr(src, "captureDepartment"),
    territoryConfirmedSantaFe: jsonFlag(src, "territoryConfirmedSantaFe"),
    declaredDeviceKind: (jsonStr(src, "declaredDeviceKind") as DeviceKind | null) ?? null,
    declaredDeviceMake: jsonStr(src, "declaredDeviceMake"),
    declaredDeviceModel: jsonStr(src, "declaredDeviceModel"),
    captureWithinPeriodDeclared: jsonFlag(src, "captureWithinPeriodDeclared"),
    authorshipDeclared: jsonFlag(src, "authorshipDeclared"),
    editingPolicyDeclared: jsonFlag(src, "editingPolicyDeclared"),
    noGenerativeAiDeclared: jsonFlag(src, "noGenerativeAiDeclared"),
    droneRegulationAcknowledged: jsonFlag(src, "droneRegulationAcknowledged"),
    instagramHandle: jsonStr(src, "instagramHandle"),
  };
}
