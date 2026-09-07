import type { WorkDataForm } from "./types";

/**
 * Declaraciones y elegibilidad tal como viajan al servidor.
 *
 * Antes se armaban inline como `FormData` dentro del wizard. Ahora hay dos
 * transportes — JSON para la subida directa, multipart para el fallback — y
 * duplicar el armado sería la forma más fácil de que una declaración se pierda
 * en un solo camino: el participante recibiría `DECLARATIONS_REQUIRED` sin
 * entender por qué, y sólo en producción.
 */
export type EligibilityPayload = {
  captureLocality: string;
  captureDepartment: string | null;
  territoryConfirmedSantaFe: boolean;
  declaredDeviceKind: string;
  declaredDeviceMake: string | null;
  declaredDeviceModel: string | null;
  captureWithinPeriodDeclared: boolean;
  authorshipDeclared: boolean;
  editingPolicyDeclared: boolean;
  noGenerativeAiDeclared: boolean;
  droneRegulationAcknowledged: boolean;
  instagramHandle: string | null;
};

function trimmedOrNull(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

export function buildEligibilityPayload(workData: WorkDataForm): EligibilityPayload {
  return {
    captureLocality: workData.captureLocality.trim(),
    captureDepartment: trimmedOrNull(workData.captureDepartment),
    territoryConfirmedSantaFe: workData.territoryConfirmed,
    declaredDeviceKind: workData.declaredDeviceKind,
    declaredDeviceMake: trimmedOrNull(workData.declaredDeviceMake),
    declaredDeviceModel: trimmedOrNull(workData.declaredDeviceModel),
    captureWithinPeriodDeclared: workData.captureWithinPeriod,
    authorshipDeclared: workData.authorshipDeclared,
    editingPolicyDeclared: workData.editingPolicyDeclared,
    noGenerativeAiDeclared: workData.noGenerativeAiDeclared,
    droneRegulationAcknowledged: workData.droneAck,
    instagramHandle: trimmedOrNull(workData.instagramHandle),
  };
}
