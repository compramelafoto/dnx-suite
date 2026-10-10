"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import {
  EXHIBITOR_TEXT_LIMITS, MAX_WORKS, canEdit, exhibitorWorkProblems, exhibitorWorkTransition, toActivityWork, type ActivityRole, type ReviewStatus,
} from "@repo/muestras";
import { conPermiso, puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { OBRA_DE_EXPOSITOR_QUITADA } from "./copiar";
import { obraDesdeFormData } from "./mapear";

export type ResultadoRevision = { ok: true; aviso?: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoRevision => ({ ok: false, errores: [texto] });
const TEXTO_NO_EXISTE = "La obra no existe.";
const TEXTO_CAMBIO = "La obra cambió mientras tanto. Recargá la página.";
const SIN_SESION = error("Tenés que ingresar.");
const NO_EXISTE = error(TEXTO_NO_EXISTE);
const NO_EXISTE_EXPOSITOR = error("No encontramos a esa persona en la muestra.");
const MUCHAS = error("Hiciste muchos cambios seguidos. Esperá unos minutos.");

const EN_REVISION = "La muestra está en revisión: esperá a que se revise para cambiar sus obras.";
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;

class Corte extends Error {}

const OBRA = {
  id: true, status: true, activityId: true, activityWorkId: true, imageUrl: true, title: true, year: true, technique: true,
  imageWidthCm: true, imageHeightCm: true, frameWidthCm: true, frameHeightCm: true, edition: true, editionNumber: true,
  editionSize: true, statement: true, forSale: true, priceArs: true, hangingNotes: true,
  exhibitor: { select: { id: true, userId: true, profileId: true, displayName: true, status: true, activityId: true } },
} as const;
type Obra = Prisma.CulturalExhibitorWorkGetPayload<{ select: typeof OBRA }>;

/** Lo que piden las reglas de estado de la muestra (`canEdit`). */
const MUESTRA = { id: true, slug: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true } as const;
type Muestra = Prisma.CulturalActivityGetPayload<{ select: typeof MUESTRA }>;

type Preparado =
  | { listo: false; error: ResultadoRevision }
  | { listo: true; usuario: Usuario; w: Obra; a: Muestra; rol: ActivityRole | null };

/**
 * Sesión, freno, la obra y el permiso `exhibitors` en la muestra **de esa obra**, leído en la base
 * en cada acción (sacar a alguien del equipo corta en el próximo pedido). Una obra cuya muestra no
 * coincide con la de su expositor no existe para nadie.
 */
async function preparar(workId: unknown): Promise<Preparado> {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false, error: SIN_SESION };
  if (typeof workId !== "string" || !ES_ID.test(workId)) return { listo: false, error: NO_EXISTE };
  if (!frenarPorUsuario("revisarExpositores", usuario.id).allowed) return { listo: false, error: MUCHAS };
  const w = await prisma.culturalExhibitorWork.findUnique({ where: { id: workId }, select: OBRA });
  if (!w || w.activityId !== w.exhibitor.activityId) return { listo: false, error: NO_EXISTE };
  const rol = await rolEnMuestra(w.activityId, usuario);
  if (!rol || !puede(usuario, "exhibitors", rol.role)) return { listo: false, error: NO_EXISTE };
  const a = await prisma.culturalActivity.findUnique({ where: { id: w.activityId }, select: MUESTRA });
  if (!a) return { listo: false, error: NO_EXISTE };
  return { listo: true, usuario, w, a, rol: rol.role };
}

const editable = (a: Muestra, usuario: Usuario, rol: ActivityRole | null) =>
  canEdit({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: rol });

function refrescar(a: { id: string; slug: string }) {
  revalidatePath(`/panel/muestras/${a.id}`, "layout");
  revalidatePath(`/m/${a.slug}`, "layout");
  revalidatePath("/fotografos", "layout");
  revalidatePath("/panel/expositor", "layout");
}

/** Bloquea la muestra y vuelve a leer el permiso con la fila bloqueada. */
async function bloquear(tx: Prisma.TransactionClient, activityId: string, usuario: Usuario) {
  await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${activityId} FOR UPDATE`;
  if ((await tx.culturalActivity.count({ where: conPermiso({ id: activityId }, usuario, "exhibitors") })) === 0) throw new Corte(TEXTO_NO_EXISTE);
}

/**
 * Aprobar (spec D8): la obra entra a la muestra como cualquier otra, al final. Volver a aprobar
 * una que ya estaba (después de pedir cambios) actualiza esa misma obra por id: su QR sigue igual.
 */
export async function aprobarObraDeExpositor(workId: string): Promise<ResultadoRevision> {
  const r = await preparar(workId);
  if (!r.listo) return r.error;
  const { usuario, a, rol } = r;
  if (r.w.exhibitor.status !== "ACTIVE") return error("Esa persona ya no está en la muestra.");
  const t = exhibitorWorkTransition("approve", r.w.status, { activityEditable: editable(a, usuario, rol) });
  if (!t.ok) return error(t.reason);
  try {
    await prisma.$transaction(async (tx) => {
      // Como al armar desde la convocatoria: contar y sumar sin que el editor reescriba en el medio.
      await bloquear(tx, a.id, usuario);
      const w = await tx.culturalExhibitorWork.findFirst({ where: { id: r.w.id, activityId: a.id }, select: OBRA });
      if (!w || w.status !== r.w.status) throw new Corte(TEXTO_CAMBIO);
      let activityWorkId: string | null = null;
      if (w.activityWorkId) {
        const { count } = await tx.culturalActivityWork.updateMany({
          where: { id: w.activityWorkId, activityId: a.id },
          data: { imageUrl: w.imageUrl ?? "", title: w.title.trim(), year: w.year, technique: w.technique?.trim() || null },
        });
        if (count > 0) activityWorkId = w.activityWorkId;
      }
      if (!activityWorkId) {
        // Nueva (o la anterior ya no está, p. ej. la quitaron desde el editor): al final del orden.
        const cuantas = await tx.culturalActivityWork.count({ where: { activityId: a.id } });
        if (cuantas >= MAX_WORKS) throw new Corte(`La muestra llegó al máximo técnico de ${MAX_WORKS} obras.`);
        const ultimo = await tx.culturalActivityWork.aggregate({ where: { activityId: a.id }, _max: { sortOrder: true } });
        const creada = await tx.culturalActivityWork.create({
          data: { ...toActivityWork(w, w.exhibitor, (ultimo._max.sortOrder ?? -1) + 1), activityId: a.id },
          select: { id: true },
        });
        activityWorkId = creada.id;
      }
      const { count } = await tx.culturalExhibitorWork.updateMany({
        where: { id: w.id, activityId: a.id, status: w.status },
        data: { status: t.next, activityWorkId, reviewNote: null, reviewedAt: new Date(), reviewedByUserId: usuario.id },
      });
      if (count === 0) throw new Corte(TEXTO_CAMBIO);
    }, { timeout: 30_000, maxWait: 10_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(a);
  return { ok: true };
}

/** Pedir cambios con una nota. Una obra ya aprobada sigue en la muestra con sus datos anteriores (D7). */
export async function pedirCambiosObraDeExpositor(workId: string, nota: string): Promise<ResultadoRevision> {
  const texto = typeof nota === "string" ? nota.trim() : "";
  if (!texto) return error("Escribí qué hay que cambiar.");
  if (texto.length > EXHIBITOR_TEXT_LIMITS.reviewNote) return error(`La nota puede tener hasta ${EXHIBITOR_TEXT_LIMITS.reviewNote} caracteres.`);
  const r = await preparar(workId);
  if (!r.listo) return r.error;
  const t = exhibitorWorkTransition("requestChanges", r.w.status, {});
  if (!t.ok) return error(t.reason);
  const { count } = await prisma.culturalExhibitorWork.updateMany({
    where: { id: r.w.id, activityId: r.a.id, status: r.w.status },
    data: { status: t.next, reviewNote: texto, reviewedAt: new Date(), reviewedByUserId: r.usuario.id },
  });
  if (count === 0) return error(TEXTO_CAMBIO);
  refrescar(r.a);
  return { ok: true };
}

/**
 * Corregir datos (texto y medidas; nunca la foto, el precio ni la decisión de vender, que son de
 * quien expone). Si la obra está en la muestra, título, año y técnica se copian a la ficha.
 */
export async function corregirObraDeExpositor(fd: FormData): Promise<ResultadoRevision> {
  const r = await preparar(fd.get("id"));
  if (!r.listo) return r.error;
  const { w, a, usuario, rol } = r;
  if (w.status !== "SUBMITTED" && w.status !== "CHANGES_REQUESTED" && w.status !== "APPROVED") {
    return error("Esa obra no se puede corregir en este estado.");
  }
  if (w.activityWorkId && !editable(a, usuario, rol)) return error(EN_REVISION);
  const leida = obraDesdeFormData(fd, null, usuario.id).datos;
  const cambios = {
    title: leida.title, year: leida.year, technique: leida.technique,
    imageWidthCm: leida.imageWidthCm, imageHeightCm: leida.imageHeightCm, frameWidthCm: leida.frameWidthCm, frameHeightCm: leida.frameHeightCm,
    edition: leida.edition, editionNumber: leida.editionNumber ?? null, editionSize: leida.editionSize ?? null,
    statement: leida.statement, hangingNotes: leida.hangingNotes,
  };
  // Enviada o aprobada: tiene que seguir completa.
  const problemas = exhibitorWorkProblems({ ...w, ...cambios }, { forSubmit: w.status !== "CHANGES_REQUESTED" });
  if (problemas.length) return { ok: false, errores: problemas };
  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.culturalExhibitorWork.updateMany({ where: { id: w.id, activityId: a.id, status: w.status }, data: cambios });
      if (count === 0) throw new Corte(TEXTO_CAMBIO);
      if (w.activityWorkId) {
        await tx.culturalActivityWork.updateMany({
          where: { id: w.activityWorkId, activityId: a.id },
          data: { title: cambios.title.trim() || "Sin título", year: cambios.year, technique: cambios.technique },
        });
      }
    });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(a);
  return { ok: true };
}

/** Saca la obra de la muestra: deja de estar en la galería, las fichas y el plano. */
export async function sacarObraDeExpositor(workId: string): Promise<ResultadoRevision> {
  const r = await preparar(workId);
  if (!r.listo) return r.error;
  const { w, a, usuario, rol } = r;
  const t = exhibitorWorkTransition("remove", w.status, {});
  if (!t.ok) return error(t.reason);
  if (w.activityWorkId && !editable(a, usuario, rol)) return error(EN_REVISION);
  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.culturalExhibitorWork.updateMany({
        where: { id: w.id, activityId: a.id, status: w.status },
        data: { status: t.next, activityWorkId: null, reviewNote: OBRA_DE_EXPOSITOR_QUITADA, reviewedAt: new Date(), reviewedByUserId: usuario.id },
      });
      if (count === 0) throw new Corte(TEXTO_CAMBIO);
      // Sólo una obra de esta muestra: el id viene de la base, pero el filtro no se omite.
      if (w.activityWorkId) await tx.culturalActivityWork.deleteMany({ where: { id: w.activityWorkId, activityId: a.id } });
    });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(a);
  return { ok: true };
}

/** "Sacar a esta persona de la muestra": ella y todas sus obras quedan fuera. */
export async function sacarExpositor(exhibitorId: string): Promise<ResultadoRevision> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (typeof exhibitorId !== "string" || !ES_ID.test(exhibitorId)) return NO_EXISTE_EXPOSITOR;
  if (!frenarPorUsuario("revisarExpositores", usuario.id).allowed) return MUCHAS;
  const e = await prisma.culturalExhibitor.findUnique({
    where: { id: exhibitorId },
    select: { id: true, status: true, activityId: true, works: { where: { status: { not: "REMOVED" } }, select: { id: true, activityId: true, activityWorkId: true } } },
  });
  if (!e) return NO_EXISTE_EXPOSITOR;
  const rol = await rolEnMuestra(e.activityId, usuario);
  if (!rol || !puede(usuario, "exhibitors", rol.role)) return NO_EXISTE_EXPOSITOR;
  if (e.status === "REMOVED") return { ok: true };
  const a = await prisma.culturalActivity.findUnique({ where: { id: e.activityId }, select: MUESTRA });
  if (!a) return NO_EXISTE_EXPOSITOR;
  const enLaMuestra = e.works.flatMap((w) => (w.activityWorkId && w.activityId === a.id ? [w.activityWorkId] : []));
  if (enLaMuestra.length && !editable(a, usuario, rol.role)) return error(EN_REVISION);
  const ahora = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.culturalExhibitor.update({ where: { id: e.id }, data: { status: "REMOVED", removedAt: ahora, removedByUserId: usuario.id } });
    await tx.culturalExhibitorWork.updateMany({
      where: { exhibitorId: e.id, activityId: a.id, status: { not: "REMOVED" } },
      data: { status: "REMOVED", activityWorkId: null, reviewNote: OBRA_DE_EXPOSITOR_QUITADA, reviewedAt: ahora, reviewedByUserId: usuario.id },
    });
    if (enLaMuestra.length) await tx.culturalActivityWork.deleteMany({ where: { id: { in: enLaMuestra }, activityId: a.id } });
  });
  refrescar(a);
  return { ok: true };
}
