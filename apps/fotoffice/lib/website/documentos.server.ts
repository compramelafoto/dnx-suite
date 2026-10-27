import "server-only";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@repo/db";
import {
  deleteFotofficeR2Object,
  generateFotofficeR2Key,
  getFotofficeR2Bucket,
  getFotofficeR2Client,
  isFotofficeR2Configured,
} from "@/lib/images/r2-client";
import { assertFotofficeDeletableR2Key } from "@/lib/images/r2-key-policy";
import {
  AVISO_TABLA_DOCUMENTOS_FALTANTE,
  MAX_BYTES_DOCUMENTO,
  MAX_DOCUMENTOS_POR_SITIO,
  MB,
  SEGUNDOS_ENLACE_DOCUMENTO,
  esKeyDeDocumento,
  esPdfPorFirma,
  nombreDeArchivoDocumento,
  prefijoDocumentos,
  validarSlugDocumento,
  validarTituloDocumento,
} from "./documentos";

/**
 * Documentos del sitio, del lado del servidor. Mismo camino que los archivos de la comisión:
 *
 * 1. `prepararSubidaDocumento`: firma un permiso de escritura de un minuto, bajo el prefijo de la
 *    institución (lo arma el servidor, nunca el navegador). El PDF sube directo a R2 porque las
 *    funciones de Vercel no aceptan pedidos de más de 4,5 MB.
 * 2. `confirmarDocumento`: mira el objeto YA subido —peso real y primeros bytes (`%PDF-`)— y recién
 *    ahí registra la fila. Lo que no es PDF o pesa de más se borra de R2.
 *
 * La dirección pública del bucket no se muestra nunca: el visitante entra por `/w/<slug>/d/<doc>`,
 * que suma una descarga y lo manda a un enlace firmado de minutos (`enlaceParaVer`).
 *
 * La tabla se crea con SQL a mano: sin ella, Prisma avisa P2021 y acá se devuelve un aviso o
 * `null`; nunca se rompe una página. Quién puede llamar a esto lo decide la acción.
 */

export function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

export type DocumentoDelPanel = {
  id: string;
  slug: string;
  titulo: string;
  tamanoBytes: number;
  publicado: boolean;
  descargas: number;
  createdAt: Date;
};

/** Los documentos del sitio, del más nuevo al más viejo. `null` = falta la tabla. */
export async function listarDocumentos(workspaceId: string): Promise<DocumentoDelPanel[] | null> {
  try {
    return await prisma.fotofficeSitioDocumento.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, titulo: true, tamanoBytes: true, publicado: true, descargas: true, createdAt: true },
      take: MAX_DOCUMENTOS_POR_SITIO,
    });
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };
const fallo = (error: string): Resultado<never> => ({ ok: false, error });

export async function prepararSubidaDocumento(workspaceId: string, bytes: number): Promise<Resultado<{ uploadUrl: string; key: string }>> {
  if (!isFotofficeR2Configured()) return fallo("El almacenamiento de archivos no está configurado. Avisale a la administración.");
  if (!Number.isFinite(bytes) || bytes <= 0) return fallo("El archivo está vacío.");
  if (bytes > MAX_BYTES_DOCUMENTO) return fallo(`El PDF pesa más de ${MAX_BYTES_DOCUMENTO / MB} MB.`);
  try {
    const cantidad = await prisma.fotofficeSitioDocumento.count({ where: { workspaceId } });
    if (cantidad >= MAX_DOCUMENTOS_POR_SITIO) return fallo(`El sitio admite hasta ${MAX_DOCUMENTOS_POR_SITIO} documentos. Borrá alguno para subir otro.`);
  } catch (err) {
    if (esTablaFaltante(err)) return fallo(AVISO_TABLA_DOCUMENTOS_FALTANTE);
    throw err;
  }
  const key = generateFotofficeR2Key("documento.pdf", prefijoDocumentos(workspaceId));
  assertFotofficeDeletableR2Key(key);
  const uploadUrl = await getSignedUrl(
    getFotofficeR2Client(),
    new PutObjectCommand({ Bucket: getFotofficeR2Bucket(), Key: key, ContentType: "application/pdf" }),
    { expiresIn: 60 },
  );
  return { ok: true, valor: { uploadUrl, key } };
}

/** Peso real y firma del objeto subido. Lo que no sirve se borra. */
async function verificarPdfSubido(key: string): Promise<Resultado<number>> {
  const client = getFotofficeR2Client();
  const bucket = getFotofficeR2Bucket();
  let tamano: number;
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    tamano = head.ContentLength ?? 0;
  } catch {
    return fallo("No encontramos el archivo subido. Probá de nuevo.");
  }
  if (tamano <= 0) {
    await borrarObjeto(key);
    return fallo("El archivo llegó vacío. Probá de nuevo.");
  }
  if (tamano > MAX_BYTES_DOCUMENTO) {
    await borrarObjeto(key);
    return fallo(`El PDF pesa más de ${MAX_BYTES_DOCUMENTO / MB} MB.`);
  }
  try {
    const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-15" }));
    const primeros = await (r.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    if (!esPdfPorFirma(primeros)) {
      await borrarObjeto(key);
      return fallo("El archivo no es un PDF.");
    }
  } catch {
    return fallo("No pudimos revisar el archivo subido. Probá de nuevo.");
  }
  return { ok: true, valor: tamano };
}

async function borrarObjeto(key: string): Promise<void> {
  const r = await deleteFotofficeR2Object(key);
  if (!r.ok) console.error("[fotoffice][sitio-documentos] no se pudo borrar de R2:", key, r.error);
}

export async function confirmarDocumento(args: {
  workspaceId: string;
  key: string;
  titulo: string;
  slug: string;
}): Promise<Resultado<{ id: string }>> {
  const { workspaceId, key } = args;
  // Una key que no firmamos para este sitio no se registra ni se borra: no es nuestra.
  if (!esKeyDeDocumento(key, workspaceId)) return fallo("El archivo no es de este sitio.");
  const titulo = args.titulo.trim();
  const errorTitulo = validarTituloDocumento(titulo);
  const errorSlug = validarSlugDocumento(args.slug);
  if (errorTitulo || errorSlug) {
    await borrarObjeto(key);
    return fallo((errorTitulo ?? errorSlug) as string);
  }

  const verificado = await verificarPdfSubido(key);
  if (!verificado.ok) return verificado;

  try {
    const fila = await prisma.fotofficeSitioDocumento.create({
      data: { workspaceId, slug: args.slug, titulo, r2Key: key, tamanoBytes: verificado.valor },
      select: { id: true },
    });
    return { ok: true, valor: fila };
  } catch (err) {
    await borrarObjeto(key);
    if ((err as { code?: unknown })?.code === "P2002") return fallo("Ya hay otro documento con esa dirección. Elegí otra.");
    if (esTablaFaltante(err)) return fallo(AVISO_TABLA_DOCUMENTOS_FALTANTE);
    throw err;
  }
}

export async function cambiarDocumento(
  workspaceId: string,
  id: string,
  cambios: { titulo?: string; slug?: string; publicado?: boolean },
): Promise<Resultado<null>> {
  const data: { titulo?: string; slug?: string; publicado?: boolean } = {};
  if (cambios.titulo !== undefined) {
    const t = cambios.titulo.trim();
    const e = validarTituloDocumento(t);
    if (e) return fallo(e);
    data.titulo = t;
  }
  if (cambios.slug !== undefined) {
    const e = validarSlugDocumento(cambios.slug);
    if (e) return fallo(e);
    data.slug = cambios.slug;
  }
  if (cambios.publicado !== undefined) data.publicado = cambios.publicado;
  try {
    const r = await prisma.fotofficeSitioDocumento.updateMany({ where: { id, workspaceId }, data });
    if (r.count === 0) return fallo("No encontramos ese documento.");
    return { ok: true, valor: null };
  } catch (err) {
    if ((err as { code?: unknown })?.code === "P2002") return fallo("Ya hay otro documento con esa dirección. Elegí otra.");
    if (esTablaFaltante(err)) return fallo(AVISO_TABLA_DOCUMENTOS_FALTANTE);
    throw err;
  }
}

/** Borra la fila y después el archivo de R2. */
export async function borrarDocumento(workspaceId: string, id: string): Promise<Resultado<null>> {
  try {
    const doc = await prisma.fotofficeSitioDocumento.findFirst({ where: { id, workspaceId }, select: { id: true, r2Key: true } });
    if (!doc) return fallo("No encontramos ese documento.");
    await prisma.fotofficeSitioDocumento.deleteMany({ where: { id: doc.id, workspaceId } });
    // Sólo se borra una key que sea de los documentos de este sitio.
    if (esKeyDeDocumento(doc.r2Key, workspaceId)) await borrarObjeto(doc.r2Key);
    return { ok: true, valor: null };
  } catch (err) {
    if (esTablaFaltante(err)) return fallo(AVISO_TABLA_DOCUMENTOS_FALTANTE);
    throw err;
  }
}

/**
 * Lo que necesita el enlace público: el documento PUBLICADO de esa dirección en ese sitio.
 * `null` = no existe, está despublicado o falta la tabla.
 */
export async function documentoPublico(
  workspaceSlug: string,
  slug: string,
): Promise<{ id: string; workspaceId: string; titulo: string; slug: string; r2Key: string } | null> {
  if (validarSlugDocumento(slug)) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: workspaceSlug }, select: { workspaceId: true } });
  if (!branding) return null;
  try {
    const doc = await prisma.fotofficeSitioDocumento.findUnique({
      where: { workspaceId_slug: { workspaceId: branding.workspaceId, slug } },
      select: { id: true, workspaceId: true, titulo: true, slug: true, r2Key: true, publicado: true },
    });
    if (!doc || !doc.publicado || !esKeyDeDocumento(doc.r2Key, doc.workspaceId)) return null;
    return { id: doc.id, workspaceId: doc.workspaceId, titulo: doc.titulo, slug: doc.slug, r2Key: doc.r2Key };
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

/** Suma una descarga (incremento atómico). Si falla, sólo queda en el log. */
export async function sumarDescarga(workspaceId: string, id: string): Promise<void> {
  try {
    await prisma.fotofficeSitioDocumento.updateMany({ where: { id, workspaceId }, data: { descargas: { increment: 1 } } });
  } catch (err) {
    console.error("[fotoffice][sitio-documentos] no se pudo contar la descarga:", err);
  }
}

/** Enlace firmado de minutos para ver el PDF en el navegador (no como descarga forzada). */
export async function enlaceParaVer(doc: { r2Key: string; titulo: string; slug: string }): Promise<string> {
  const nombre = nombreDeArchivoDocumento(doc.titulo, doc.slug);
  return getSignedUrl(
    getFotofficeR2Client(),
    new GetObjectCommand({
      Bucket: getFotofficeR2Bucket(),
      Key: assertFotofficeDeletableR2Key(doc.r2Key),
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `inline; filename="${nombre}"`,
    }),
    { expiresIn: SEGUNDOS_ENLACE_DOCUMENTO },
  );
}
