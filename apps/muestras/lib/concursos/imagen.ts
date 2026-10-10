import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@repo/db";
import { contestWorkInGallery } from "@repo/muestras";
import { signEntryImageUrl } from "./firma";
import { ImagenInvalida, procesarImagen } from "@/lib/imagenes/procesar";
import { borrarDeR2, subirAR2 } from "@/lib/imagenes/r2";

/**
 * Copia el original de una obra de FotoRank al bucket de Muestras (etapa 7, D12). Muestras no tiene
 * llaves del bucket privado de FotoRank: pide la imagen a `/api/fotorank/external/entry-image` con un
 * enlace firmado de 10 minutos (como la tienda de FOTOFFICE). FotoRank no revisa permisos: **firmar es
 * autorizar**, así que sólo se llama con obras de un resultado cerrado por el jurado que ya leyó
 * `fotorank.ts`. La URL firmada nunca se registra ni llega al navegador.
 *
 * Sólo se copia una obra **leída de la base** (`CulturalContestWork`, nunca un id que llegue del
 * pedido) y sólo cuando va a entrar a la muestra: marcada y con el permiso del autor resuelto (las
 * bases lo autorizan o el autor aceptó). Antes de eso la imagen no sale de FotoRank. Si el autor
 * después la saca o quien organiza la quita, se borra la copia (`borrarImagenDeConcurso`).
 *
 * La clave es fija por obra (copiar dos veces pisa el mismo objeto) pero no se adivina: lleva una
 * huella con el secreto, porque el bucket es público y el id de la obra viaja por FotoRank.
 */
const BASE_POR_OMISION = "https://fotorank.dnxsuite.com";
const VIGENCIA_MS = 10 * 60 * 1000;
const ESPERA_MS = 30_000;
const MAX_BYTES = 30 * 1024 * 1024;

export type CodigoImagenDeConcurso = "NOT_CONFIGURED" | "FETCH_FAILED" | "INVALID" | "NOT_ALLOWED";

export class ImagenDeConcursoError extends Error {
  constructor(
    readonly code: CodigoImagenDeConcurso,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ImagenDeConcursoError";
  }
}

const NO_CONFIGURADO = "Falta configurar la conexión con FotoRank (avisale a la administración).";

/** `muestras/<autor>/fr-<obra>-<huella>.webp`: fija por obra y sin adivinar sin el secreto. */
export function claveDeObraDeConcurso(authorUserId: number | null, entryId: string, secret: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(entryId)) throw new ImagenDeConcursoError("INVALID", "Obra inválida.");
  if (!secret) throw new ImagenDeConcursoError("NOT_CONFIGURED", NO_CONFIGURADO);
  const huella = createHmac("sha256", secret).update(`muestras-key|${entryId}`).digest("base64url").slice(0, 22);
  const archivo = `fr-${entryId}-${huella}.webp`;
  return authorUserId != null ? `muestras/${authorUserId}/${archivo}` : `muestras/concursos/${archivo}`;
}

export type DepsImagenDeConcurso = {
  fetch: typeof globalThis.fetch;
  now: () => Date;
  procesar: typeof procesarImagen;
  subir: typeof subirAR2;
  /** La obra del concurso, leída de la base. */
  leerObra: (contestWorkId: string) => Promise<ObraParaCopiar | null>;
};

type ObraParaCopiar = { entryId: string; authorUserId: number | null; include: boolean; imageStatus: string; imageUrl: string | null; exhibitConsent: string };

const DEPS: DepsImagenDeConcurso = {
  fetch: (...args) => globalThis.fetch(...args),
  now: () => new Date(),
  procesar: procesarImagen,
  subir: subirAR2,
  leerObra: (id) =>
    prisma.culturalContestWork.findUnique({
      where: { id },
      select: { entryId: true, authorUserId: true, include: true, imageStatus: true, imageUrl: true, exhibitConsent: true },
    }),
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

/**
 * Copia la imagen de una obra del concurso (por el id de su fila en `CulturalContestWork`). Sólo si
 * va a entrar a la muestra: marcada y con permiso (la regla `contestWorkInGallery`, sin mirar la imagen).
 */
export async function copiarImagenDeConcurso(
  contestWorkId: string,
  deps: DepsImagenDeConcurso = DEPS,
): Promise<{ url: string; width: number; height: number }> {
  if (typeof contestWorkId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(contestWorkId)) throw new ImagenDeConcursoError("INVALID", "Obra inválida.");
  const obra = await deps.leerObra(contestWorkId);
  if (!obra) throw new ImagenDeConcursoError("INVALID", "Obra inválida.");
  if (!contestWorkInGallery({ ...obra, imageStatus: "COPIED", imageUrl: "pendiente" })) {
    throw new ImagenDeConcursoError("NOT_ALLOWED", "Todavía no hay permiso para exponer esta obra: la imagen se copia cuando lo haya.");
  }
  const secret = process.env.DNX_FOTORANK_LINK_SECRET?.trim();
  if (!secret) throw new ImagenDeConcursoError("NOT_CONFIGURED", NO_CONFIGURADO);
  const clave = claveDeObraDeConcurso(obra.authorUserId, obra.entryId, secret);
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

/**
 * Borra la copia de una obra del concurso que salió de la muestra (el autor no quiso, la sacó o
 * quien organiza la quitó). A mejor esfuerzo: si falla, queda registrado y la muestra sigue igual
 * (la URL ya no está en ninguna página).
 */
export async function borrarImagenDeConcurso(url: string | null, borrar: typeof borrarDeR2 = borrarDeR2): Promise<void> {
  if (!url) return;
  // Sólo copias de concursos: nunca otra imagen del bucket.
  if (!/\/muestras\/(?:\d+|concursos)\/fr-[A-Za-z0-9_-]+\.webp$/.test(url)) return;
  try {
    await borrar(url);
  } catch (err) {
    console.error("[muestras] concurso borrar imagen:", err instanceof Error ? err.message : String(err));
  }
}
