/**
 * Claves de almacenamiento de las imágenes de concurso.
 *
 * Van al mismo storage privado que ya usan las obras (local en desarrollo, R2
 * cuando hay credenciales). No se agrega ningún proveedor nuevo.
 *
 * La clave incluye el id del asset y no el nombre original del archivo: dos
 * personas subiendo "flyer.jpg" no se pisan, y el nombre que eligió alguien en
 * su computadora no termina siendo parte de una URL.
 */

import type { ContestMediaKind } from "./specs";

const ROOT = "fotorank/contests";

export function contestMediaStorageKey(input: {
  contestId: string;
  kind: ContestMediaKind;
  assetId: string;
  extension: string;
}): string {
  const ext = input.extension.replace(/^\.+/, "").toLowerCase();
  return `${ROOT}/${input.contestId}/media/${input.kind.toLowerCase()}/${input.assetId}.${ext}`;
}

/** Prefijo de todas las imágenes de presentación de un concurso. */
export function contestMediaStoragePrefix(contestId: string): string {
  return `${ROOT}/${contestId}/media/`;
}

/**
 * Comprueba que una clave pertenezca al concurso indicado.
 * Defensa contra una fila manipulada que apunte al material de otro concurso.
 */
export function storageKeyBelongsToContest(key: string, contestId: string): boolean {
  return key.startsWith(contestMediaStoragePrefix(contestId)) && !key.includes("..");
}
