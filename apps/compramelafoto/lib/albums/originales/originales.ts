/**
 * «Descargar originales» del álbum: reglas puras (sin base ni R2) para poder probarlas.
 *
 * - Solo el fotógrafo dueño del álbum (`Album.userId`). Ni colaboradores, ni otros
 *   fotógrafos, ni admins: son las fotos de su trabajo, no un recurso de la plataforma.
 * - El álbum se baja en partes de a `FOTOS_POR_PARTE` fotos. Un álbum escolar pesa varios GB
 *   y un único ZIP no entra en el tiempo de una función; varias partes chicas sí, y si una
 *   se corta se vuelve a bajar solo esa.
 */

import { safeFilename } from "@/lib/safe-filename";

/** ~100 originales de 3–8 MB ≈ 300–800 MB por parte. */
export const FOTOS_POR_PARTE = 100;

export type AlbumParaOriginales = { userId: number; deletedAt?: Date | null };

export type AccesoOriginales =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string };

export function accesoAOriginales(
  album: AlbumParaOriginales | null | undefined,
  userId: number | null | undefined,
): AccesoOriginales {
  if (!album || album.deletedAt) return { ok: false, status: 404, error: "Álbum no encontrado" };
  if (userId == null || album.userId !== userId) {
    return {
      ok: false,
      status: 403,
      error: "Solo el fotógrafo dueño del álbum puede descargar los originales",
    };
  }
  return { ok: true };
}

export type ParteDeOriginales = {
  /** Número de parte, empieza en 1. */
  parte: number;
  /** Posición (1-based) de la primera y la última foto de la parte dentro del álbum. */
  desde: number;
  hasta: number;
  cantidad: number;
};

export function armarPartes(totalFotos: number, porParte = FOTOS_POR_PARTE): ParteDeOriginales[] {
  const partes: ParteDeOriginales[] = [];
  for (let inicio = 0; inicio < totalFotos; inicio += porParte) {
    const fin = Math.min(inicio + porParte, totalFotos);
    partes.push({ parte: partes.length + 1, desde: inicio + 1, hasta: fin, cantidad: fin - inicio });
  }
  return partes;
}

/** Lee `?parte=N`. Devuelve null si no es un número de parte válido para el álbum. */
export function leerNumeroDeParte(valor: string | null, totalPartes: number): number | null {
  if (valor == null || !/^\d+$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  return n >= 1 && n <= totalPartes ? n : null;
}

/** Qué ids van en la parte N (los ids ya vienen ordenados). */
export function idsDeLaParte<T>(ids: T[], parte: number, porParte = FOTOS_POR_PARTE): T[] {
  return ids.slice((parte - 1) * porParte, parte * porParte);
}

/**
 * Nombre de cada foto dentro del ZIP: número de orden (para que se vean en el orden del álbum)
 * + el nombre original si lo tenemos, o el id de la foto.
 */
export function nombreDeFotoEnZip(
  posicion: number,
  foto: { id: number; originalFilename?: string | null },
): string {
  const orden = String(posicion).padStart(4, "0");
  const original = foto.originalFilename?.trim();
  if (original) {
    const limpio = safeFilename(original.split(/[\\/]/).pop() ?? original, `foto-${foto.id}.jpg`);
    const conExtension = /\.[a-z0-9]{2,5}$/i.test(limpio) ? limpio : `${limpio}.jpg`;
    return `${orden}-${conExtension}`;
  }
  return `${orden}-foto-${foto.id}.jpg`;
}

export function nombreDelZip(tituloAlbum: string, parte: number, totalPartes: number): string {
  const base = safeFilename(tituloAlbum || "album", "album").replace(/\s+/g, "-");
  return totalPartes > 1 ? `${base}-originales-parte-${parte}-de-${totalPartes}` : `${base}-originales`;
}
