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
