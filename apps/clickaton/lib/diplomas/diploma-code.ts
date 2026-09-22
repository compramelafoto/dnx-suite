import { randomBytes } from "node:crypto";

/**
 * Código legible del diploma. Estable: se calcula una vez y se guarda.
 * El código visible de la inscripción ya lleva el prefijo de su edición
 * (`CK1-0042`), así que alcanza para identificar de qué maratón salió.
 */
export function buildDiplomaCode(input: {
  visibleCode: string | null;
  registrationId: string;
  editionSlug: string;
}): string {
  const visible = input.visibleCode?.trim();
  if (visible) return `DIP-${visible}`;
  const tag =
    input.editionSlug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 7).toUpperCase() || "EDICION";
  const tail = input.registrationId.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, "0");
  return `DIP-${tag}-${tail}`;
}

/** Token de verificación: aleatorio, no derivable del número de inscripción. */
export function generateVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}
