import { createHash } from "node:crypto";

/**
 * El consentimiento del invitado.
 *
 * Antes de subir nada, el invitado acepta los términos. Se guarda **qué versión
 * del texto** aceptó, no un simple "sí": el día que un abogado pregunte a qué se
 * comprometió alguien en octubre, la respuesta tiene que ser el texto de octubre
 * y no el de hoy.
 *
 * Esta parte es pura para poder probarla. La escritura vive en `consentimiento-db.ts`.
 */

export type ConsentimientoGuardado = {
  documentVersion: string;
  accepted: boolean;
};

/** ¿Este invitado ya aceptó el texto que está vigente hoy? */
export function tieneConsentimientoVigente(
  guardados: readonly ConsentimientoGuardado[],
  versionVigente: string,
): boolean {
  return guardados.some((c) => c.accepted && c.documentVersion === versionVigente);
}

/**
 * Huella de la dirección IP, no la dirección.
 *
 * Se guarda para poder frenar a alguien que abusa, y para nada más. Guardar la
 * IP entera sería guardar un dato personal que no necesitamos: con el hash
 * alcanza para saber que dos subidas vienen del mismo lado.
 *
 * La sal viene del entorno. Sin ella el hash sería reversible con una tabla de
 * las cuatro mil millones de direcciones posibles, que es un rato de cómputo.
 */
export function hashDeIp(ip: string | null | undefined): string | null {
  const limpia = ip?.trim();
  if (!limpia) return null;

  const sal = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${sal}:${limpia}`).digest("hex");
}
