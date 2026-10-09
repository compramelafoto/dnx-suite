import { CALL_TEXT_LIMITS } from "@repo/muestras";
import { baseImagenesPublicas } from "@/lib/actividades/mapear";

export type ObraEnviada = { imageUrl: string; title: string; year: number | null; technique: string | null; statement: string | null };
export type EnvioForm = { callId: string; authorName: string; basesAccepted: boolean; rightsAccepted: boolean; works: ObraEnviada[] };

/**
 * Sólo imágenes que subió esta misma persona por nuestra ruta de subida, que las procesa (saca
 * los metadatos EXIF, incluida la ubicación) y las guarda como `<base>/muestras/<userId>/<id>.webp`.
 * Sin esto, alguien podría mandar como propia la imagen de otra persona, o una sin procesar.
 */
export function esImagenDeUsuario(url: string, base: string | null, userId: number): boolean {
  if (!base) return false;
  const prefijo = `${base}/muestras/${userId}/`;
  if (!url.startsWith(prefijo)) return false;
  return /^[A-Za-z0-9_-]+\.webp$/.test(url.slice(prefijo.length));
}

const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max).trim();
const anioActual = () => new Date().getUTCFullYear();

function obras(raw: string, base: string | null, userId: number): ObraEnviada[] {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 20).flatMap((o) => {
      if (!o || typeof o !== "object") return [];
      const r = o as Record<string, unknown>;
      if (typeof r.imageUrl !== "string" || !esImagenDeUsuario(r.imageUrl, base, userId)) return [];
      const anio = typeof r.year === "number" && Number.isInteger(r.year) && r.year >= 1826 && r.year <= anioActual() + 1 ? r.year : null;
      return [{
        imageUrl: r.imageUrl,
        title: corto(r.title, CALL_TEXT_LIMITS.workTitle),
        year: anio,
        technique: corto(r.technique, CALL_TEXT_LIMITS.technique) || null,
        statement: corto(r.statement, CALL_TEXT_LIMITS.statement) || null,
      }];
    });
  } catch {
    return [];
  }
}

export function envioDesdeFormData(fd: FormData, userId: number, baseImagenes: string | null = baseImagenesPublicas()): EnvioForm {
  return {
    callId: corto(fd.get("callId"), 40),
    authorName: corto(fd.get("authorName"), CALL_TEXT_LIMITS.authorName),
    basesAccepted: fd.get("basesAccepted") === "on",
    rightsAccepted: fd.get("rightsAccepted") === "on",
    works: obras(String(fd.get("works") ?? "[]"), baseImagenes, userId),
  };
}
