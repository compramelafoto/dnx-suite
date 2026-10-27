/**
 * Lo que se guarda del archivo de un mensaje de WhatsApp (columna `media`, Json) y su versión
 * segura para la pantalla y el bot: nunca expone la clave de R2 ni el id de Meta. Módulo PURO.
 */

export type EstadoDescarga = "LISTO" | "FALLO" | "GRANDE" | "PENDIENTE";

/** `media` después de la etapa 2: lo de Meta (`id`, `mimeType`, …) más el resultado de la descarga. */
export type MediaGuardada = {
  id?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  descarga?: Exclude<EstadoDescarga, "PENDIENTE">;
  clave?: string;
  bytes?: number;
  ancho?: number;
  alto?: number;
};

export type ArchivoDeMensaje = {
  estado: EstadoDescarga;
  mime: string | null;
  nombre: string;
  bytes: number | null;
  ancho: number | null;
  alto: number | null;
};

const CON_ARCHIVO = new Set(["IMAGEN", "DOCUMENTO", "VIDEO", "AUDIO"]);
const NOMBRE_POR_TIPO: Record<string, string> = { IMAGEN: "foto.jpg", VIDEO: "video.mp4", AUDIO: "audio.ogg", DOCUMENTO: "archivo" };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const cadena = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const positivo = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

function estadoDe(v: unknown): EstadoDescarga {
  return v === "LISTO" || v === "FALLO" || v === "GRANDE" ? v : "PENDIENTE";
}

export function archivoDeMensaje(tipo: string, media: unknown): ArchivoDeMensaje | null {
  if (!CON_ARCHIVO.has(tipo) || !esObjeto(media) || !cadena(media.id)) return null;
  return {
    estado: estadoDe(media.descarga),
    mime: cadena(media.mimeType),
    nombre: cadena(media.filename) ?? NOMBRE_POR_TIPO[tipo] ?? "archivo",
    bytes: positivo(media.bytes),
    ancho: positivo(media.ancho),
    alto: positivo(media.alto),
  };
}

/** Clave en el R2 privado, sólo si el archivo se bajó bien. */
export function claveDeMedia(media: unknown): string | null {
  if (!esObjeto(media) || media.descarga !== "LISTO") return null;
  return cadena(media.clave);
}
