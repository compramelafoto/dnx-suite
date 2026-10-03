import { createHash, randomBytes } from "node:crypto";

/**
 * Huella estable de un identificador: mismo id, mismo resultado, siempre.
 * Evita colisiones y hace que el largo del id deje de importar.
 */
function huella(valor: string, largo: number): string {
  return createHash("sha256")
    .update(valor)
    .digest("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, largo)
    .toUpperCase();
}

/**
 * Seis caracteres que identifican a la edición dentro del código del diploma.
 *
 * Sale del `id` de la edición y no de su slug ni de su prefijo visible, por
 * dos motivos: el id no cambia nunca (el slug sí se puede editar) y es único
 * de verdad (el prefijo del código visible, `visibleCodePrefix`, es `"CK"`
 * por defecto para TODAS las ediciones y además se copia al clonar una).
 */
function huellaDeEdicion(editionId: string): string {
  return huella(editionId, 6);
}

/** Seis caracteres estables derivados del id completo de la inscripción. */
function huellaDeInscripcion(registrationId: string): string {
  return huella(registrationId, 6);
}

/**
 * Código legible del diploma, con la edición adentro.
 *
 * Forma: `DIP-<huella de la edición>-<código visible de la inscripción>`, y
 * si la inscripción no tiene código visible, `DIP-<huella de la edición>-<huella
 * de la inscripción>`.
 *
 * Por qué lleva la edición: `ClickatonDiplomaIssue.diplomaCode` tiene índice
 * único GLOBAL, pero el código visible de la inscripción (`CK1-0042`) sólo es
 * único DENTRO de su edición — el prefijo por defecto es `"CK"` para todas
 * (ver `prisma-checkout-mutations.ts`) y se copia al clonar una edición. Sin
 * la huella de la edición, el participante 1 de la 2ª edición chocaba contra
 * el de la 1ª y su diploma terminaba en un error genérico.
 *
 * Estabilidad de los ya emitidos: esta función NO se llama para un diploma
 * que ya existe. `issueDiploma` la invoca sólo cuando `findExistingIssue`
 * no devolvió una emisión vigente (`existing?.diplomaCode ?? buildDiplomaCode(...)`);
 * si ya hay una, se reusa el código guardado tal cual y nunca se recalcula.
 * Por eso cambiar la forma del código sólo afecta a los diplomas que todavía
 * no se emitieron: los que ya salieron conservan el suyo, impreso y en el QR.
 */
export function buildDiplomaCode(input: {
  visibleCode: string | null;
  registrationId: string;
  editionId: string;
}): string {
  const edicion = huellaDeEdicion(input.editionId);
  const visible = input.visibleCode?.trim();
  const cola = visible || huellaDeInscripcion(input.registrationId);
  return `DIP-${edicion}-${cola}`;
}

/** Token de verificación: aleatorio, no derivable del número de inscripción. */
export function generateVerificationToken(): string {
  return randomBytes(24).toString("base64url");
}
