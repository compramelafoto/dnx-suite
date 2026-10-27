import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { subirBuffer } from "@/lib/carpetas/subir-servidor";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import type { MediaGuardada } from "./archivo-de-mensaje";
import { detalleDeError } from "./registro";

/**
 * Archivos entrantes de WhatsApp (etapa 2 del bot): se bajan de Meta enseguida (la URL vence en
 * minutos) y se guardan en el R2 privado. El resultado queda en la misma columna `media` (sin
 * migración). Nunca loguea el token ni la URL de Meta.
 */

export const MAX_BYTES_MEDIO = 100 * 1024 * 1024;
/** Tiempos máximos: el webhook tiene 120 s y después todavía tiene que contestar el bot. */
const TIEMPO_GRAPH_MS = 15_000;
const TIEMPO_ARCHIVO_MS = 40_000;

export type DepsMedios = {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  leerToken?: (workspaceId: string) => Promise<string | null>;
  subir?: (clave: string, cuerpo: Buffer, tipo: string) => Promise<void>;
  medidas?: (cuerpo: Buffer) => Promise<{ ancho: number; alto: number } | null>;
  db?: typeof prisma;
};

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

/** Ancho y alto como se ven (una foto de celular "acostada" en EXIF se da vuelta). */
async function medidasConSharp(cuerpo: Buffer): Promise<{ ancho: number; alto: number } | null> {
  const { default: sharp } = await import("sharp");
  const m = await sharp(cuerpo).metadata();
  if (!m.width || !m.height) return null;
  const girada = (m.orientation ?? 1) >= 5;
  return girada ? { ancho: m.height, alto: m.width } : { ancho: m.width, alto: m.height };
}

class Grande extends Error {}

export async function descargarMedio(mensajeId: string, deps: DepsMedios = {}): Promise<"LISTO" | "FALLO" | "GRANDE" | "omitido"> {
  const db = deps.db ?? prisma;
  const m = (await db.fotofficeWaMensaje.findUnique({
    where: { id: mensajeId },
    select: { id: true, workspaceId: true, chatId: true, tipo: true, media: true },
  })) as { id: string; workspaceId: string; chatId: string; tipo: string; media: unknown } | null;
  const media = (m?.media && typeof m.media === "object" && !Array.isArray(m.media) ? m.media : null) as MediaGuardada | null;
  if (!m || !media || typeof media.id !== "string" || !media.id || media.descarga) return "omitido";
  const conexion = await db.fotofficeWaConexion.findUnique({ where: { workspaceId: m.workspaceId }, select: { modo: true } });
  if (conexion?.modo !== "REAL") return "omitido";

  const guardar = (extra: Partial<MediaGuardada>) =>
    db.fotofficeWaMensaje.update({ where: { id: m.id }, data: { media: { ...media, ...extra } as Prisma.InputJsonObject } });

  try {
    const token = await (deps.leerToken ?? leerTokenWhatsapp)(m.workspaceId);
    if (!token) throw new Error("sin token");
    const pedir = deps.fetch ?? fetch;
    const auth = { Authorization: `Bearer ${token}` };
    const version = process.env.WHATSAPP_API_VERSION || "v21.0";

    const info = await pedir(`https://graph.facebook.com/${version}/${encodeURIComponent(media.id)}`, { headers: auth, signal: AbortSignal.timeout(TIEMPO_GRAPH_MS) });
    if (!info.ok) throw new Error(`Graph ${info.status}`);
    const datos = (await info.json()) as { url?: unknown; mime_type?: unknown; file_size?: unknown };
    if (typeof datos.url !== "string") throw new Error("Graph sin url");
    if (typeof datos.file_size === "number" && datos.file_size > MAX_BYTES_MEDIO) throw new Grande();

    const archivo = await pedir(datos.url, { headers: auth, signal: AbortSignal.timeout(TIEMPO_ARCHIVO_MS) });
    if (!archivo.ok) throw new Error(`Descarga ${archivo.status}`);
    const cuerpo = Buffer.from(await archivo.arrayBuffer());
    if (cuerpo.length > MAX_BYTES_MEDIO) throw new Grande();

    const mime = media.mimeType ?? (typeof datos.mime_type === "string" ? datos.mime_type : "application/octet-stream");
    const base = mime.split(";")[0].trim();
    const clave = `bandeja/${m.workspaceId}/${m.chatId}/${m.id}.${EXTENSION[base] ?? "bin"}`;
    await (deps.subir ?? subirBuffer)(clave, cuerpo, base);

    const esImagen = m.tipo === "IMAGEN" || base.startsWith("image/");
    const medidas = esImagen ? await (deps.medidas ?? medidasConSharp)(cuerpo).catch(() => null) : null;
    await guardar({ descarga: "LISTO", clave, bytes: cuerpo.length, mimeType: mime, ...(medidas ?? {}) });
    return "LISTO";
  } catch (e) {
    if (e instanceof Grande) {
      await guardar({ descarga: "GRANDE" });
      return "GRANDE";
    }
    console.error("[fotoffice][whatsapp] no se pudo bajar un archivo", { mensajeId, ...detalleDeError(e) });
    await guardar({ descarga: "FALLO" });
    return "FALLO";
  }
}

/** Baja en serie (pocos por mensaje de Meta). Nunca lanza: el bot contesta igual. */
export async function descargarMedios(mensajeIds: readonly string[], deps: DepsMedios = {}): Promise<void> {
  for (const id of mensajeIds) {
    try {
      await descargarMedio(id, deps);
    } catch (e) {
      console.error("[fotoffice][whatsapp] no se pudo registrar la descarga de un archivo", { mensajeId: id, ...detalleDeError(e) });
    }
  }
}
