/**
 * Reglas de los adjuntos privados de la ficha (DNI, contratos, planillas...).
 * Funciones puras: sirven igual en el servidor y para avisar antes de subir.
 */

export const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type TipoPermitido = (typeof TIPOS_PERMITIDOS)[number];

/** 10 MB exactos. */
export const TAMANO_MAXIMO = 10_485_760;
/** Vida del enlace de descarga. */
export const SEGUNDOS_ENLACE = 300;
/** Vida del enlace de subida. */
export const SEGUNDOS_SUBIDA = 600;
/** Días que un adjunto borrado se puede restaurar antes de la purga. */
export const DIAS_PURGA = 30;
/** Una subida que no se confirmó en este plazo se limpia. */
export const HORAS_PENDIENTE = 24;

export const MAX_NOMBRE = 180;
export const ERROR_TIPO = "Ese tipo de archivo no se puede adjuntar.";
export const ERROR_TAMANO = "El archivo supera los 10 MB.";
export const ERROR_VACIO = "El archivo está vacío.";

export function esTipoPermitido(tipo: unknown): tipo is TipoPermitido {
  return typeof tipo === "string" && (TIPOS_PERMITIDOS as readonly string[]).includes(tipo);
}

export function esTamanoValido(tamano: unknown): tamano is number {
  return typeof tamano === "number" && Number.isInteger(tamano) && tamano > 0 && tamano <= TAMANO_MAXIMO;
}

/** Sin barras (ni / ni \), sin caracteres de control y hasta 180 caracteres. */
export function limpiarNombre(nombre: unknown): string {
  const base = typeof nombre === "string" ? nombre : "";
  // eslint-disable-next-line no-control-regex
  const limpio = base.replace(/[\u0000-\u001f\u007f-\u009f/\\]/g, "").trim().slice(0, MAX_NOMBRE).trim();
  return limpio.length > 0 ? limpio : "archivo";
}

export function validarArchivo(input: {
  nombre: unknown;
  tipo: unknown;
  tamano: unknown;
}): { ok: true; nombre: string } | { ok: false; error: string } {
  if (!esTipoPermitido(input.tipo)) return { ok: false, error: ERROR_TIPO };
  const t = input.tamano;
  if (typeof t !== "number" || !Number.isInteger(t) || t <= 0) return { ok: false, error: ERROR_VACIO };
  if (t > TAMANO_MAXIMO) return { ok: false, error: ERROR_TAMANO };
  return { ok: true, nombre: limpiarNombre(input.nombre) };
}

/** La clave nunca lleva el nombre original: sólo el workspace y un uuid. */
export function claveDeAdjunto(workspaceId: string, uuid: string): string {
  return `adjuntos/${workspaceId}/${uuid}`;
}

const CLAVE_VALIDA = /^adjuntos\/[A-Za-z0-9_-]{1,100}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Defensa extra: ninguna operación del bucket privado sale de `adjuntos/<ws>/<uuid>`. */
export function esClaveDeAdjunto(clave: unknown): clave is string {
  return typeof clave === "string" && CLAVE_VALIDA.test(clave);
}
