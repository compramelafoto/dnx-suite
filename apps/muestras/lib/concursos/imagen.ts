import "server-only";
import { signEntryImageUrl } from "./firma";
import { ImagenInvalida, procesarImagen } from "@/lib/imagenes/procesar";
import { subirAR2 } from "@/lib/imagenes/r2";

/**
 * Copia el original de una obra de FotoRank al bucket de Muestras (etapa 7, D12). Muestras no tiene
 * llaves del bucket privado de FotoRank: pide la imagen a `/api/fotorank/external/entry-image` con un
 * enlace firmado de 10 minutos (como la tienda de FOTOFFICE). FotoRank no revisa permisos: **firmar es
 * autorizar**, así que sólo se llama con obras de un resultado cerrado por el jurado que ya leyó
 * `fotorank.ts`. La URL firmada nunca se registra ni llega al navegador. La clave es fija por obra:
 * copiar dos veces pisa el mismo objeto.
 */
const BASE_POR_OMISION = "https://fotorank.dnxsuite.com";
const VIGENCIA_MS = 10 * 60 * 1000;
const ESPERA_MS = 30_000;
const MAX_BYTES = 30 * 1024 * 1024;

export type CodigoImagenDeConcurso = "NOT_CONFIGURED" | "FETCH_FAILED" | "INVALID";

export class ImagenDeConcursoError extends Error {
  constructor(
    readonly code: CodigoImagenDeConcurso,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ImagenDeConcursoError";
  }
}

export function claveDeObraDeConcurso(authorUserId: number | null, entryId: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(entryId)) throw new ImagenDeConcursoError("INVALID", "Obra inválida.");
  return authorUserId != null ? `muestras/${authorUserId}/fr-${entryId}.webp` : `muestras/concursos/fr-${entryId}.webp`;
}

export type DepsImagenDeConcurso = {
  fetch: typeof globalThis.fetch;
  now: () => Date;
  procesar: typeof procesarImagen;
  subir: typeof subirAR2;
};

const DEPS: DepsImagenDeConcurso = {
  fetch: (...args) => globalThis.fetch(...args),
  now: () => new Date(),
  procesar: procesarImagen,
  subir: subirAR2,
};

/** Lee el cuerpo cortando apenas pasa el tope (sin `content-length` no se confía en el tamaño). */
async function leerConTope(r: Response): Promise<Buffer> {
  if (!r.body) return Buffer.alloc(0);
  const lector = r.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await lector.cancel().catch(() => {});
      throw new Error("tamaño");
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

export async function copiarImagenDeConcurso(
  obra: { entryId: string; authorUserId: number | null },
  deps: DepsImagenDeConcurso = DEPS,
): Promise<{ url: string; width: number; height: number }> {
  const clave = claveDeObraDeConcurso(obra.authorUserId, obra.entryId);
  const secret = process.env.DNX_FOTORANK_LINK_SECRET?.trim();
  if (!secret) throw new ImagenDeConcursoError("NOT_CONFIGURED", "Falta configurar la conexión con FotoRank (avisale a la administración).");
  const baseUrl = process.env.FOTORANK_PUBLIC_BASE_URL?.trim() || BASE_POR_OMISION;
  const url = signEntryImageUrl({
    baseUrl,
    entryId: obra.entryId,
    variant: "original",
    expiresAt: new Date(deps.now().getTime() + VIGENCIA_MS),
    secret,
  });

  let bytes: Buffer;
  try {
    const r = await deps.fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ESPERA_MS), cache: "no-store" });
    const largo = Number(r.headers.get("content-length") ?? 0);
    if (!r.ok || largo > MAX_BYTES) {
      await r.body?.cancel().catch(() => {});
      throw new Error(`estado ${r.status}${largo > MAX_BYTES ? " (demasiado grande)" : ""}`);
    }
    bytes = await leerConTope(r);
    if (bytes.length === 0) throw new Error("vacía");
  } catch (err) {
    // Sin la URL: lleva la firma (y algunos errores de red la repiten en el mensaje).
    const motivo = (err instanceof Error ? err.message : String(err)).replace(/https?:\/\/\S+/g, "[url]");
    console.error("[muestras] concurso imagen:", obra.entryId, motivo);
    throw new ImagenDeConcursoError("FETCH_FAILED", "No pudimos traer la imagen de FotoRank. Probá de nuevo en un rato.");
  }

  try {
    const img = await deps.procesar(bytes, "obra");
    return { url: await deps.subir(img.bytes, clave, img.contentType), width: img.width, height: img.height };
  } catch (err) {
    if (err instanceof ImagenInvalida) throw new ImagenDeConcursoError("INVALID", err.message);
    throw err;
  }
}
