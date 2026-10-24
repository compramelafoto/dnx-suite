import "server-only";
import sharp from "sharp";
import type { CourseMosaicStudent } from "@repo/template-engine";
import { Prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-public-url";
import { normalizePreviewUrl } from "@/lib/r2-client";
import { rosterCourseKey } from "@/lib/design-v2/class-list";
import { armarCompaneros } from "./companeros";
import { encuadreDeCara, type CajaDeCara } from "./encuadre-de-cara";

/**
 * El padrón y los retratos del «Mosaico del curso»: quiénes son los compañeros de una carpeta,
 * qué retrato tiene cada uno y si su curso ya está cerrado.
 */

export type FuenteDelRetrato = "FAMILY" | "PHOTOGRAPHER" | "SCHOOL";

type Db = Prisma.TransactionClient;

const SELECT_FILA = {
  id: true,
  snapshotFirstName: true,
  snapshotLastName: true,
  mosaicPhotoId: true,
  mosaicPhotoAspect: true,
  mosaicPhotoCrop: true,
  mosaicPhoto: { select: { previewUrl: true, originalKey: true, previewWatermarkedKey: true } },
} as const;

/** La vista pública del retrato, con marca de agua si está generada. */
export function urlDeVistaDelRetrato(
  photo: { previewUrl: string | null; originalKey: string | null; previewWatermarkedKey: string | null } | null,
): string | null {
  if (!photo) return null;
  if (photo.previewWatermarkedKey) return getR2PublicUrl(photo.previewWatermarkedKey);
  return normalizePreviewUrl(photo.previewUrl, photo.originalKey);
}

/** El curso de una fila del padrón: la clave y si está cerrado. */
export async function cursoDeLaFila(db: Db, albumId: number, rosterEntryId: number) {
  const fila = await db.albumStudentRosterEntry.findFirst({
    where: { id: rosterEntryId, albumId },
    select: { level: true, shift: true, courseName: true, division: true },
  });
  if (!fila) return null;
  const courseKey = rosterCourseKey(fila);
  const estado = await db.albumCourseMosaic.findUnique({
    where: { albumId_courseKey: { albumId, courseKey } },
    select: { closedAt: true, staffJson: true },
  });
  return { ...fila, courseKey, cerrado: estado?.closedAt != null, staffJson: estado?.staffJson ?? null };
}

/** Las filas activas de un curso del padrón (sin dueño excluido). */
export async function filasDelCurso(
  db: Db,
  albumId: number,
  curso: { level: string; shift: string; courseName: string; division: string },
) {
  return db.albumStudentRosterEntry.findMany({
    where: { albumId, isActive: true, level: curso.level, shift: curso.shift, courseName: curso.courseName, division: curso.division },
    orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }],
    select: SELECT_FILA,
  });
}

/**
 * Los compañeros del mosaico de la carpeta de `rosterEntryId`: los activos de su curso menos él.
 * Null si el dueño no está en el padrón (sin padrón no hay mosaico).
 */
export async function cargarCompanerosDelMosaico(
  db: Db,
  input: { albumId: number; rosterEntryId: number | null | undefined },
): Promise<CourseMosaicStudent[] | null> {
  if (!input.rosterEntryId) return null;
  const curso = await cursoDeLaFila(db, input.albumId, input.rosterEntryId);
  if (!curso) return null;
  const filas = await filasDelCurso(db, input.albumId, curso);
  return armarCompaneros(
    filas.map((f) => ({ ...f, urlDeVista: urlDeVistaDelRetrato(f.mosaicPhoto) })),
    input.rosterEntryId,
  );
}

/** El dueño de la carpeta como figurita (para los bloques con «Incluir al dueño»). */
export async function cargarDuenoDelMosaico(
  db: Db,
  input: { albumId: number; rosterEntryId: number | null | undefined },
): Promise<CourseMosaicStudent | null> {
  if (!input.rosterEntryId) return null;
  const f = await db.albumStudentRosterEntry.findFirst({ where: { id: input.rosterEntryId, albumId: input.albumId }, select: SELECT_FILA });
  if (!f) return null;
  return armarCompaneros([{ ...f, urlDeVista: urlDeVistaDelRetrato(f.mosaicPhoto) }], -1)[0] ?? null;
}

/**
 * Proporción y encuadre de cara de una foto. La proporción sale de la vista (es liviana); la cara,
 * de la detección guardada si la foto ya se analizó.
 */
export async function medirRetrato(db: Db, photoId: number): Promise<{ aspect: number | null; crop: { zoom: number; x: number; y: number } }> {
  const foto = await db.photo.findUnique({
    where: { id: photoId },
    select: { previewUrl: true, originalKey: true, previewWatermarkedKey: true },
  });
  let aspect: number | null = null;
  const url = urlDeVistaDelRetrato(foto);
  if (url && /^https?:\/\//.test(url)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const meta = await sharp(new Uint8Array(await res.arrayBuffer()), { failOn: "none" }).metadata();
        const rotada = (meta.orientation ?? 1) >= 5;
        const w = rotada ? meta.height : meta.width;
        const h = rotada ? meta.width : meta.height;
        if (w && h) aspect = w / h;
      }
    } catch {
      // Sin proporción: el encuadre usa la de una foto carné.
    }
  }
  const cara = await db.faceDetection.findFirst({
    where: { photoId },
    orderBy: { confidence: "desc" },
    select: { bbox: true },
  });
  const bbox = cara?.bbox && typeof cara.bbox === "object" ? (cara.bbox as unknown as CajaDeCara) : null;
  return { aspect, crop: encuadreDeCara({ bbox, aspectoFoto: aspect ?? 0.75 }) };
}

/**
 * Pone (o saca, con `photoId: null`) el retrato oficial de un chico. No toca un curso cerrado.
 * Devuelve false si no hizo nada.
 */
export async function asignarRetrato(
  db: Db,
  input: {
    albumId: number;
    rosterEntryId: number;
    photoId: number | null;
    fuente: FuenteDelRetrato;
    revisar?: boolean;
    /**
     * Medir la foto (baja la vista y busca la cara). Dentro de la transacción de un canje no se
     * mide: queda para `completarMediciones`, fuera de la transacción.
     */
    medir?: boolean;
  },
): Promise<boolean> {
  const curso = await cursoDeLaFila(db, input.albumId, input.rosterEntryId);
  if (!curso || curso.cerrado) return false;
  if (input.photoId == null) {
    await db.albumStudentRosterEntry.update({
      where: { id: input.rosterEntryId },
      data: { mosaicPhotoId: null, mosaicPhotoAspect: null, mosaicPhotoCrop: Prisma.DbNull, mosaicPhotoSource: null, mosaicPhotoNeedsReview: false },
    });
    return true;
  }
  const foto = await db.photo.findFirst({ where: { id: input.photoId, albumId: input.albumId, isRemoved: false }, select: { id: true } });
  if (!foto) return false;
  const { aspect, crop } =
    input.medir === false ? { aspect: null, crop: null } : await medirRetrato(db, input.photoId);
  await db.albumStudentRosterEntry.update({
    where: { id: input.rosterEntryId },
    data: {
      mosaicPhotoId: input.photoId,
      mosaicPhotoAspect: aspect,
      mosaicPhotoCrop: crop ?? Prisma.DbNull,
      mosaicPhotoSource: input.fuente,
      mosaicPhotoNeedsReview: input.revisar === true,
    },
  });
  return true;
}

/**
 * La foto que eligió la familia para la carpeta pasa a ser el retrato del chico. No pisa uno que
 * puso el fotógrafo ni toca un curso cerrado.
 */
export async function registrarRetratoDeLaFamilia(
  db: Db,
  input: { albumId: number; rosterEntryId: number | null | undefined; photoId: number | null | undefined },
): Promise<boolean> {
  if (!input.rosterEntryId || !input.photoId) return false;
  const fila = await db.albumStudentRosterEntry.findFirst({
    where: { id: input.rosterEntryId, albumId: input.albumId },
    select: { mosaicPhotoSource: true, mosaicPhotoId: true },
  });
  if (!fila || fila.mosaicPhotoSource === "PHOTOGRAPHER") return false;
  if (fila.mosaicPhotoSource === "FAMILY" && fila.mosaicPhotoId === input.photoId) return false;
  return asignarRetrato(db, {
    albumId: input.albumId,
    rosterEntryId: input.rosterEntryId,
    photoId: input.photoId,
    fuente: "FAMILY",
    medir: false,
  });
}

/**
 * Mide los retratos de un curso que todavía no tienen encuadre (los puso la familia al canjear o
 * el colegio). Cuatro a la vez; una foto que no se pudo medir queda con el encuadre de plano medio
 * y no se vuelve a intentar.
 */
export async function completarMediciones(
  db: Db,
  albumId: number,
  curso: { level: string; shift: string; courseName: string; division: string },
): Promise<number> {
  const pendientes = await db.albumStudentRosterEntry.findMany({
    where: {
      albumId,
      isActive: true,
      level: curso.level,
      shift: curso.shift,
      courseName: curso.courseName,
      division: curso.division,
      mosaicPhotoId: { not: null },
      mosaicPhotoCrop: { equals: Prisma.DbNull },
    },
    select: { id: true, mosaicPhotoId: true },
  });
  const cola = [...pendientes];
  const trabajar = async () => {
    for (let p = cola.shift(); p; p = cola.shift()) {
      const { aspect, crop } = await medirRetrato(db, p.mosaicPhotoId!);
      await db.albumStudentRosterEntry.update({ where: { id: p.id }, data: { mosaicPhotoAspect: aspect, mosaicPhotoCrop: crop } });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, cola.length) }, trabajar));
  return pendientes.length;
}
