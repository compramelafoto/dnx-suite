/**
 * Claves de los objetos de la galería en el bucket PRIVADO de los adjuntos (R2). Módulo PURO.
 * Imita `lib/ficha/adjuntos-reglas.ts`: la clave nunca lleva el nombre del archivo, sólo ids, y ninguna
 * operación sale de `galerias/<workspaceId>/<galeriaId>/<fotoId>/{original,vista.jpg,mini.jpg}`.
 */

export const TIPOS_OBJETO = ["original", "vista", "mini"] as const;
export type TipoObjeto = (typeof TIPOS_OBJETO)[number];

const ARCHIVO: Record<TipoObjeto, string> = { original: "original", vista: "vista.jpg", mini: "mini.jpg" };

/** Un id (cuid, uuid o "ws-1" en las pruebas): sin barras, puntos ni nada raro. */
const ID = "[A-Za-z0-9_-]{1,100}";
const CLAVE_VALIDA = new RegExp(`^galerias/(${ID})/(${ID})/(${ID})/(original|vista\\.jpg|mini\\.jpg)$`);
const PREFIJO_VALIDO = new RegExp(`^galerias/(${ID})/(${ID})/$`);

function idValido(v: unknown): v is string {
  return typeof v === "string" && new RegExp(`^${ID}$`).test(v);
}

function exigir(...ids: unknown[]): void {
  for (const id of ids) if (!idValido(id)) throw new Error("Id de galería inválido para armar la clave.");
}

/** Prefijo (con barra final) de todas las fotos de una galería: sirve para listar o limpiar. */
export function prefijoDeGaleria(workspaceId: string, galeriaId: string): string {
  exigir(workspaceId, galeriaId);
  return `galerias/${workspaceId}/${galeriaId}/`;
}

export function claveDeObjeto(workspaceId: string, galeriaId: string, fotoId: string, tipo: TipoObjeto): string {
  exigir(workspaceId, galeriaId, fotoId);
  return `galerias/${workspaceId}/${galeriaId}/${fotoId}/${ARCHIVO[tipo]}`;
}

export const claveOriginal = (workspaceId: string, galeriaId: string, fotoId: string) => claveDeObjeto(workspaceId, galeriaId, fotoId, "original");
export const claveVista = (workspaceId: string, galeriaId: string, fotoId: string) => claveDeObjeto(workspaceId, galeriaId, fotoId, "vista");
export const claveMini = (workspaceId: string, galeriaId: string, fotoId: string) => claveDeObjeto(workspaceId, galeriaId, fotoId, "mini");

/** Las tres claves de una foto (para borrarla entera). */
export function clavesDeFoto(workspaceId: string, galeriaId: string, fotoId: string): { original: string; vista: string; mini: string } {
  return {
    original: claveOriginal(workspaceId, galeriaId, fotoId),
    vista: claveVista(workspaceId, galeriaId, fotoId),
    mini: claveMini(workspaceId, galeriaId, fotoId),
  };
}

/** Defensa extra: ¿tiene la forma de una clave de galería? */
export function esClaveDeGaleria(clave: unknown): clave is string {
  return typeof clave === "string" && CLAVE_VALIDA.test(clave);
}

export function esPrefijoDeGaleria(prefijo: unknown): prefijo is string {
  return typeof prefijo === "string" && PREFIJO_VALIDO.test(prefijo);
}

export type ClaveAnalizada = { workspaceId: string; galeriaId: string; fotoId: string; tipo: TipoObjeto };

/** Las partes de una clave válida, o null. */
export function analizarClave(clave: unknown): ClaveAnalizada | null {
  if (typeof clave !== "string") return null;
  const m = CLAVE_VALIDA.exec(clave);
  if (!m) return null;
  const tipo = (Object.keys(ARCHIVO) as TipoObjeto[]).find((t) => ARCHIVO[t] === m[4]);
  return tipo ? { workspaceId: m[1], galeriaId: m[2], fotoId: m[3], tipo } : null;
}

/** ¿La clave es de ese workspace y esa galería? (Una foto de otra galería no se toca.) */
export function claveEsDe(clave: unknown, workspaceId: string, galeriaId: string): boolean {
  const a = analizarClave(clave);
  return a !== null && a.workspaceId === workspaceId && a.galeriaId === galeriaId;
}
