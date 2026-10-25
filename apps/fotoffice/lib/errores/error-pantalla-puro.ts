/**
 * Lo que el navegador manda cuando una pantalla de FOTOFFICE se cae, y cómo se limpia antes de
 * guardarlo. Puro, para probarlo sin base ni navegador.
 *
 * El aviso llega sin sesión obligatoria (una falla puede pasar en el login o en el sitio público),
 * así que todo lo que trae se trata como texto ajeno: se recorta y lo que no tiene la forma
 * esperada se descarta.
 */

export type AlcanceError = "PAGINA" | "GLOBAL";

export type AvisoDeError = {
  alcance: AlcanceError;
  ruta: string;
  mensaje: string;
  nombre: string | null;
  digest: string | null;
  pila: string | null;
};

const TOPE = { ruta: 500, mensaje: 2000, nombre: 200, digest: 200, pila: 8000 } as const;

function texto(v: unknown, tope: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, tope) : null;
}

/** null si el cuerpo no es un aviso de error. */
export function leerAvisoDeError(cuerpo: unknown): AvisoDeError | null {
  if (typeof cuerpo !== "object" || cuerpo === null) return null;
  const c = cuerpo as Record<string, unknown>;
  const alcance = c.alcance === "GLOBAL" ? "GLOBAL" : c.alcance === "PAGINA" ? "PAGINA" : null;
  const ruta = texto(c.ruta, TOPE.ruta);
  if (!alcance || !ruta) return null;
  return {
    alcance,
    ruta,
    mensaje: texto(c.mensaje, TOPE.mensaje) ?? "(sin mensaje)",
    nombre: texto(c.nombre, TOPE.nombre),
    digest: texto(c.digest, TOPE.digest),
    pila: texto(c.pila, TOPE.pila),
  };
}

/**
 * ¿La falla es de una pestaña vieja que quedó abierta mientras se publicaba una versión nueva?
 * Pasa cuando el navegador pide un pedazo de la aplicación que la versión nueva ya no tiene. No
 * se arregla reintentando: hace falta recargar la página entera.
 */
export function esVersionVieja(error: { name?: string; message?: string }): boolean {
  const t = `${error.name ?? ""} ${error.message ?? ""}`;
  return /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed|Failed to find Server Action/i.test(t);
}

/** Código corto para que la persona lo pase por WhatsApp o correo: alcanza para encontrar la fila. */
export function codigoDeError(id: string): string {
  return id.slice(-8).toUpperCase();
}
