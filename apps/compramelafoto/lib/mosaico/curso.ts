import "server-only";
import { Prisma, type PrismaClient } from "@/lib/prisma";
import { rosterCourseKey } from "@/lib/design-v2/class-list";
import { courseDisplayName } from "@/lib/design-v2/values";
import { asignarRetrato, completarMediciones, urlDeVistaDelRetrato, type FuenteDelRetrato } from "./retratos";
import {
  hashDelTokenDelColegio,
  leerIdsDeFotos,
  leerIntegrantes,
  nuevoTokenDelColegio,
  type IntegranteDelCurso,
} from "./token-del-colegio";

/**
 * Los cursos del padrón de un álbum para el «Mosaico del curso»: quién tiene retrato, maestra y
 * directivos, retratos sin identificar, el enlace del colegio y el cierre.
 */

type Db = Prisma.TransactionClient;

export type Curso = { level: string; shift: string; courseName: string; division: string };

export class MosaicoError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** El curso a partir de su clave `padron|nivel|turno|curso|división`. */
export function cursoDeLaClave(courseKey: string): Curso | null {
  const partes = courseKey.split("|");
  if (partes.length !== 5 || partes[0] !== "padron") return null;
  const [, level, shift, courseName, division] = partes as [string, string, string, string, string];
  return { level, shift, courseName, division };
}

export function tituloDelCurso(c: Curso): string {
  return [courseDisplayName(c.courseName, c.division), c.shift ? `Turno ${c.shift.toLowerCase()}` : null, c.level || null]
    .filter(Boolean)
    .join(" · ");
}

async function estado(db: Db, albumId: number, courseKey: string) {
  return db.albumCourseMosaic.findUnique({ where: { albumId_courseKey: { albumId, courseKey } } });
}

async function asegurarEstado(db: Db, albumId: number, courseKey: string) {
  return db.albumCourseMosaic.upsert({
    where: { albumId_courseKey: { albumId, courseKey } },
    create: { albumId, courseKey },
    update: {},
  });
}

function exigirAbierto(e: { closedAt: Date | null } | null) {
  if (e?.closedAt) throw new MosaicoError("El curso está cerrado: reabrilo para cambiar algo.", 409);
}

/** Los cursos del padrón del álbum, con cuántos chicos tienen retrato. */
export async function cursosDelAlbum(db: Db, albumId: number) {
  const filas = await db.albumStudentRosterEntry.findMany({
    where: { albumId, isActive: true },
    select: { level: true, shift: true, courseName: true, division: true, mosaicPhotoId: true, mosaicPhotoNeedsReview: true },
  });
  const estados = await db.albumCourseMosaic.findMany({ where: { albumId }, select: { courseKey: true, closedAt: true } });
  const cerrados = new Map(estados.map((e) => [e.courseKey, e.closedAt]));
  const porCurso = new Map<string, { curso: Curso; total: number; conRetrato: number; aRevisar: number }>();
  for (const f of filas) {
    const key = rosterCourseKey(f);
    const c = porCurso.get(key) ?? { curso: { level: f.level, shift: f.shift, courseName: f.courseName, division: f.division }, total: 0, conRetrato: 0, aRevisar: 0 };
    c.total++;
    if (f.mosaicPhotoId != null) c.conRetrato++;
    if (f.mosaicPhotoNeedsReview) c.aRevisar++;
    porCurso.set(key, c);
  }
  return [...porCurso.entries()]
    .map(([courseKey, c]) => ({
      courseKey,
      titulo: tituloDelCurso(c.curso),
      total: c.total,
      conRetrato: c.conRetrato,
      aRevisar: c.aRevisar,
      cerradoEl: cerrados.get(courseKey)?.toISOString() ?? null,
    }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "es", { numeric: true }));
}

export type AlumnoDelMosaico = {
  rosterEntryId: number;
  nombre: string;
  apellido: string;
  retrato: { photoId: number; url: string | null; fuente: FuenteDelRetrato | null; revisar: boolean } | null;
};

export type ResumenDelCurso = {
  courseKey: string;
  titulo: string;
  cerradoEl: string | null;
  alumnos: AlumnoDelMosaico[];
  integrantes: Array<IntegranteDelCurso & { url: string | null }>;
  sinIdentificar: Array<{ photoId: number; url: string | null }>;
  enlaceVence: string | null;
};

async function urlsDeFotos(db: Db, albumId: number, ids: number[]): Promise<Map<number, string | null>> {
  if (ids.length === 0) return new Map();
  const fotos = await db.photo.findMany({
    where: { id: { in: ids }, albumId, isRemoved: false },
    select: { id: true, previewUrl: true, originalKey: true, previewWatermarkedKey: true },
  });
  return new Map(fotos.map((f) => [f.id, urlDeVistaDelRetrato(f)]));
}

export async function resumenDelCurso(db: Db, albumId: number, courseKey: string): Promise<ResumenDelCurso> {
  const curso = cursoDeLaClave(courseKey);
  if (!curso) throw new MosaicoError("Ese curso no existe.", 404);
  const [filas, e] = await Promise.all([
    db.albumStudentRosterEntry.findMany({
      where: { albumId, isActive: true, ...curso },
      orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }],
      select: {
        id: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        mosaicPhotoId: true,
        mosaicPhotoSource: true,
        mosaicPhotoNeedsReview: true,
        mosaicPhoto: { select: { previewUrl: true, originalKey: true, previewWatermarkedKey: true } },
      },
    }),
    estado(db, albumId, courseKey),
  ]);
  if (filas.length === 0) throw new MosaicoError("Ese curso no tiene alumnos en el padrón.", 404);
  const integrantes = leerIntegrantes(e?.staffJson);
  const sinIdentificar = leerIdsDeFotos(e?.unidentifiedPhotoIdsJson);
  const urls = await urlsDeFotos(db, albumId, [...sinIdentificar, ...integrantes.flatMap((i) => (i.photoId ? [i.photoId] : []))]);
  return {
    courseKey,
    titulo: tituloDelCurso(curso),
    cerradoEl: e?.closedAt?.toISOString() ?? null,
    alumnos: filas.map((f) => ({
      rosterEntryId: f.id,
      nombre: f.snapshotFirstName,
      apellido: f.snapshotLastName,
      retrato:
        f.mosaicPhotoId == null
          ? null
          : {
              photoId: f.mosaicPhotoId,
              url: urlDeVistaDelRetrato(f.mosaicPhoto),
              fuente: (f.mosaicPhotoSource as FuenteDelRetrato | null) ?? null,
              revisar: f.mosaicPhotoNeedsReview,
            },
    })),
    integrantes: integrantes.map((i) => ({ ...i, url: i.photoId ? (urls.get(i.photoId) ?? null) : null })),
    sinIdentificar: sinIdentificar.map((photoId) => ({ photoId, url: urls.get(photoId) ?? null })),
    enlaceVence: e?.schoolTokenHash && e.schoolTokenExpiresAt && e.schoolTokenExpiresAt > new Date() ? e.schoolTokenExpiresAt.toISOString() : null,
  };
}

/** Comprueba que la fila del padrón sea de ese curso del álbum. */
async function filaDelCurso(db: Db, albumId: number, courseKey: string, rosterEntryId: number) {
  const curso = cursoDeLaClave(courseKey);
  const fila = curso
    ? await db.albumStudentRosterEntry.findFirst({ where: { id: rosterEntryId, albumId, isActive: true, ...curso }, select: { id: true } })
    : null;
  if (!fila) throw new MosaicoError("Ese alumno no es de este curso.", 404);
}

/** El fotógrafo pone, cambia o saca el retrato de un chico. */
export async function ponerRetratoDelFotografo(
  db: Db,
  input: { albumId: number; courseKey: string; rosterEntryId: number; photoId: number | null },
) {
  exigirAbierto(await estado(db, input.albumId, input.courseKey));
  await filaDelCurso(db, input.albumId, input.courseKey, input.rosterEntryId);
  const ok = await asignarRetrato(db, { ...input, fuente: "PHOTOGRAPHER" });
  if (!ok) throw new MosaicoError("No se pudo poner esa foto: tiene que ser una foto de este álbum.", 422);
}

/** El fotógrafo confirma un retrato que puso el colegio. */
export async function confirmarRetrato(db: Db, input: { albumId: number; courseKey: string; rosterEntryId: number }) {
  await filaDelCurso(db, input.albumId, input.courseKey, input.rosterEntryId);
  await db.albumStudentRosterEntry.update({ where: { id: input.rosterEntryId }, data: { mosaicPhotoNeedsReview: false } });
}

export async function guardarIntegrantes(db: Db, input: { albumId: number; courseKey: string; integrantes: unknown }) {
  if (!cursoDeLaClave(input.courseKey)) throw new MosaicoError("Ese curso no existe.", 404);
  const integrantes = leerIntegrantes(input.integrantes).slice(0, 8);
  const ids = integrantes.flatMap((i) => (i.photoId ? [i.photoId] : []));
  if (ids.length) {
    const n = await db.photo.count({ where: { id: { in: ids }, albumId: input.albumId, isRemoved: false } });
    if (n !== new Set(ids).size) throw new MosaicoError("Alguna foto no es de este álbum.", 422);
  }
  exigirAbierto(await asegurarEstado(db, input.albumId, input.courseKey));
  await db.albumCourseMosaic.update({
    where: { albumId_courseKey: { albumId: input.albumId, courseKey: input.courseKey } },
    data: { staffJson: integrantes as unknown as Prisma.InputJsonValue },
  });
}

/** Agrega (o saca) retratos sin identificar: fotos del álbum que el colegio va a nombrar. */
export async function cambiarSinIdentificar(
  db: PrismaClient,
  input: { albumId: number; courseKey: string; agregar?: number[]; quitar?: number[] },
) {
  if (!cursoDeLaClave(input.courseKey)) throw new MosaicoError("Ese curso no existe.", 404);
  const agregar = leerIdsDeFotos(input.agregar ?? []);
  if (agregar.length) {
    const n = await db.photo.count({ where: { id: { in: agregar }, albumId: input.albumId, isRemoved: false } });
    if (n !== agregar.length) throw new MosaicoError("Alguna foto no es de este álbum.", 422);
  }
  const quitar = new Set(leerIdsDeFotos(input.quitar ?? []));
  await db.$transaction(async (tx) => {
    const creado = await asegurarEstado(tx, input.albumId, input.courseKey);
    // Bloqueada mientras se reescribe la lista: el colegio puede estar nombrando al mismo tiempo.
    await tx.$queryRaw`SELECT id FROM "AlbumCourseMosaic" WHERE id = ${creado.id} FOR UPDATE`;
    const e = (await tx.albumCourseMosaic.findUnique({ where: { id: creado.id } }))!;
    exigirAbierto(e);
    const lista = [...new Set([...leerIdsDeFotos(e.unidentifiedPhotoIdsJson), ...agregar])].filter((id) => !quitar.has(id)).slice(0, 200);
    await tx.albumCourseMosaic.update({ where: { id: e.id }, data: { unidentifiedPhotoIdsJson: lista } });
  });
}

/** Un enlace nuevo para el colegio (el anterior deja de andar). Devuelve el token una sola vez. */
export async function generarEnlaceDelColegio(db: Db, input: { albumId: number; courseKey: string }) {
  if (!cursoDeLaClave(input.courseKey)) throw new MosaicoError("Ese curso no existe.", 404);
  const e = await asegurarEstado(db, input.albumId, input.courseKey);
  exigirAbierto(e);
  const t = nuevoTokenDelColegio();
  await db.albumCourseMosaic.update({ where: { id: e.id }, data: { schoolTokenHash: t.hash, schoolTokenExpiresAt: t.vence } });
  return { token: t.token, vence: t.vence.toISOString() };
}

export async function cerrarCurso(db: Db, input: { albumId: number; courseKey: string; userId: number }) {
  const curso = cursoDeLaClave(input.courseKey);
  if (!curso) throw new MosaicoError("Ese curso no existe.", 404);
  const e = await asegurarEstado(db, input.albumId, input.courseKey);
  if (e.closedAt) return;
  await completarMediciones(db, input.albumId, curso);
  // Al cerrar, el enlace del colegio deja de andar: ya nadie cambia retratos.
  await db.albumCourseMosaic.update({
    where: { id: e.id },
    data: { closedAt: new Date(), closedByUserId: input.userId, schoolTokenHash: null, schoolTokenExpiresAt: null },
  });
}

export async function reabrirCurso(db: Db, input: { albumId: number; courseKey: string }) {
  await db.albumCourseMosaic.updateMany({
    where: { albumId: input.albumId, courseKey: input.courseKey },
    data: { closedAt: null, closedByUserId: null },
  });
}

/* ------------------------------- Lo que hace el colegio con su enlace ------------------------------- */

/** El curso de un enlace del colegio, si está vigente y el curso sigue abierto. */
export async function cursoDelEnlace(db: Db, token: string) {
  if (!token || token.length < 20) return null;
  const e = await db.albumCourseMosaic.findUnique({
    where: { schoolTokenHash: hashDelTokenDelColegio(token) },
    select: { id: true, albumId: true, courseKey: true, closedAt: true, schoolTokenExpiresAt: true, album: { select: { title: true } } },
  });
  if (!e || e.closedAt || !e.schoolTokenExpiresAt || e.schoolTokenExpiresAt <= new Date()) return null;
  return e;
}

/**
 * ¿Esta foto la puede ver el colegio con su enlace? Sólo los retratos sin identificar y las fotos
 * de los docentes: nunca los retratos que eligieron las familias.
 */
export async function fotoVisibleParaElColegio(db: Db, token: string, photoId: number): Promise<boolean> {
  const e = await cursoDelEnlace(db, token);
  if (!e) return false;
  const estado = await db.albumCourseMosaic.findUnique({ where: { id: e.id }, select: { unidentifiedPhotoIdsJson: true, staffJson: true } });
  const visibles = new Set([
    ...leerIdsDeFotos(estado?.unidentifiedPhotoIdsJson),
    ...leerIntegrantes(estado?.staffJson).flatMap((i) => (i.photoId ? [i.photoId] : [])),
  ]);
  if (!visibles.has(photoId)) return false;
  return (await db.photo.count({ where: { id: photoId, albumId: e.albumId, isRemoved: false } })) === 1;
}

/**
 * El colegio dice de quién es un retrato sin identificar. Queda a confirmar por el fotógrafo. No
 * pisa a un chico que ya tiene retrato (el que eligió la familia o puso el fotógrafo), y la fila
 * del curso se bloquea para que la misma foto no termine en dos chicos.
 */
export async function asignarDesdeElColegio(db: PrismaClient, input: { token: string; photoId: number; rosterEntryId: number }) {
  const e = await cursoDelEnlace(db, input.token);
  if (!e) throw new MosaicoError("Este enlace venció o el curso ya se cerró. Pedile uno nuevo al fotógrafo.", 410);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AlbumCourseMosaic" WHERE id = ${e.id} FOR UPDATE`;
    const fila = await tx.albumCourseMosaic.findUnique({ where: { id: e.id }, select: { unidentifiedPhotoIdsJson: true, closedAt: true } });
    if (fila?.closedAt) throw new MosaicoError("El curso ya se cerró.", 410);
    const sinIdentificar = leerIdsDeFotos(fila?.unidentifiedPhotoIdsJson);
    if (!sinIdentificar.includes(input.photoId)) throw new MosaicoError("Esa foto ya no está para nombrar.", 409);
    await filaDelCurso(tx, e.albumId, e.courseKey, input.rosterEntryId);
    const chico = await tx.albumStudentRosterEntry.findUnique({ where: { id: input.rosterEntryId }, select: { mosaicPhotoId: true } });
    if (chico?.mosaicPhotoId != null) throw new MosaicoError("Ese chico ya tiene su retrato.", 409);
    const ok = await asignarRetrato(tx, {
      albumId: e.albumId,
      rosterEntryId: input.rosterEntryId,
      photoId: input.photoId,
      fuente: "SCHOOL",
      revisar: true,
      medir: false,
    });
    if (!ok) throw new MosaicoError("No se pudo guardar.", 422);
    await tx.albumCourseMosaic.update({
      where: { id: e.id },
      data: { unidentifiedPhotoIdsJson: sinIdentificar.filter((id) => id !== input.photoId) },
    });
  });
}

/** El colegio corrige los nombres y cargos de la maestra y los directivos (no las fotos). */
export async function corregirIntegrantesDesdeElColegio(db: Db, input: { token: string; integrantes: unknown }) {
  const e = await cursoDelEnlace(db, input.token);
  if (!e) throw new MosaicoError("Este enlace venció o el curso ya se cerró. Pedile uno nuevo al fotógrafo.", 410);
  const actuales = leerIntegrantes(
    (await db.albumCourseMosaic.findUnique({ where: { id: e.id }, select: { staffJson: true } }))?.staffJson,
  );
  // Mismo orden y mismas fotos: el colegio sólo cambia el texto. Se empareja por posición con lo
  // que llegó tal cual (sin filtrar), así una fila vacía no corre a las demás.
  const crudos = Array.isArray(input.integrantes) ? input.integrantes : [];
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : null);
  const corregidos = actuales.map((a, i) => {
    const r = crudos[i] && typeof crudos[i] === "object" ? (crudos[i] as Record<string, unknown>) : {};
    return { ...a, role: texto(r.role, 60) || a.role, name: texto(r.name, 120) || a.name };
  });
  await db.albumCourseMosaic.update({ where: { id: e.id }, data: { staffJson: corregidos as unknown as Prisma.InputJsonValue } });
}
