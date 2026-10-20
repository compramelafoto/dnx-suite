/** Claves de R2 de la digitalización. Las arma SIEMPRE el servidor; el navegador nunca elige una. */

export const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
export type Extension = "mp4" | "webm" | "vob";

const REGEX_CLAVE_PARTE = /^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/t\d{1,3}\/\d{6}\.(mp4|webm|vob)$/;

/** "video/dvd" es el mime interno con que la estación pide una grabación de DVD. */
export function extensionDeMime(mime: string): Extension | null {
  const base = mime.split(";")[0]?.trim().toLowerCase();
  if (base === "video/mp4") return "mp4";
  if (base === "video/webm") return "webm";
  if (base === "video/dvd") return "vob";
  return null;
}

export function tipoContenido(ext: Extension): string {
  return ext === "vob" ? "application/octet-stream" : `video/${ext}`;
}

export function prefijoDeGrabacion(workspaceId: string, grabacionId: string): string {
  if (!ID_VALIDO.test(workspaceId) || !ID_VALIDO.test(grabacionId)) throw new Error("Id no válido");
  return `digitalizacion/${workspaceId}/${grabacionId}/`;
}

export function claveDeParte(p: { workspaceId: string; grabacionId: string; tramo: number; indice: number; extension: Extension }): string {
  if (!Number.isInteger(p.tramo) || p.tramo < 1 || p.tramo > 999) throw new Error("Tramo no válido");
  if (!Number.isInteger(p.indice) || p.indice < 0 || p.indice > 999_999) throw new Error("Índice no válido");
  const clave = `${prefijoDeGrabacion(p.workspaceId, p.grabacionId)}t${p.tramo}/${String(p.indice).padStart(6, "0")}.${p.extension}`;
  if (!REGEX_CLAVE_PARTE.test(clave)) throw new Error("Clave no válida");
  return clave;
}

export function esClaveDeParte(k: string): boolean {
  return REGEX_CLAVE_PARTE.test(k);
}
