"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { acceptsSubmissions, callPhase, hasPhysicalVenue, submissionProblems, submitterConflict } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { avisarEnvioRecibido } from "@/lib/correos/convocatorias";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { envioDesdeFormData } from "./mapear";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const NO_RECIBE: ResultadoAccion = { ok: false, errores: ["La convocatoria no recibe obras en este momento."] };

/** Lee la convocatoria en el momento (las páginas públicas pueden estar en caché 5 minutos). */
function convocatoria(callId: string) {
  return prisma.culturalCall.findUnique({
    where: { id: callId },
    select: {
      id: true, slug: true, status: true, opensAt: true, closesAt: true, maxWorksPerPerson: true,
      activity: { select: { proposedByUserId: true, reviewStatus: true, isVirtualOnly: true, venueName: true, address: true } },
    },
  });
}

/** Sólo recibe obras una convocatoria de una muestra publicada, dentro de sus fechas. */
const recibe = (c: NonNullable<Awaited<ReturnType<typeof convocatoria>>>) =>
  c.activity.reviewStatus === "APPROVED" && acceptsSubmissions(callPhase(c, new Date()));

const CERRADA = Symbol("convocatoria cerrada");
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Vuelve a leer el estado de la convocatoria con bloqueo compartido (FOR SHARE) dentro de la
 * transacción: si en ese instante la están cerrando, el cierre espera a este guardado o este
 * guardado ve el cierre. Sin esto, un envío podía colarse después de cerrar.
 */
async function exigirQueRecibe(tx: Tx, c: { id: string; opensAt: Date; closesAt: Date }) {
  const filas = await tx.$queryRaw<{ status: string; opensAt: Date; closesAt: Date }[]>`
    SELECT status, "opensAt", "closesAt" FROM "CulturalCall" WHERE id = ${c.id} FOR SHARE`;
  const f = filas[0];
  if (!f || !acceptsSubmissions(callPhase(f, new Date()))) throw CERRADA;
}

/** Crea o reemplaza el envío propio mientras la convocatoria recibe obras. */
export async function guardarEnvio(fd: FormData): Promise<ResultadoAccion> {
  if (!(fd instanceof FormData)) return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const e = envioDesdeFormData(fd, usuario.id);
  const c = e.callId ? await convocatoria(e.callId) : null;
  if (!c) return NO_EXISTE;
  if (!recibe(c)) return NO_RECIBE;
  // Si la muestra dejó de tener un lugar físico, la convocatoria deja de ser pública. Retirar un
  // envío sigue permitido.
  if (!hasPhysicalVenue(c.activity)) return { ok: false, errores: ["Esta convocatoria no recibe obras: la muestra ya no tiene un lugar donde exponerlas."] };
  const curador = await prisma.culturalCallCurator.findFirst({
    where: { callId: c.id, status: { not: "REVOKED" }, OR: [{ userId: usuario.id }, { email: usuario.email.toLowerCase() }] },
    select: { id: true },
  });
  const conflicto = submitterConflict({ isOwner: c.activity.proposedByUserId === usuario.id, isCurator: !!curador });
  if (conflicto) return { ok: false, errores: [conflicto] };
  const problemas = submissionProblems(e, c.maxWorksPerPerson);
  if (e.descartadas > 0) problemas.push("Alguna imagen no es válida o no la subiste vos desde acá. Quitala y subila de nuevo.");
  if (new Set(e.works.map((w) => w.imageUrl)).size !== e.works.length) problemas.push("Hay una imagen repetida: cada obra tiene que ser distinta.");
  if (problemas.length) return { ok: false, errores: problemas };
  if (!frenarPorUsuario("guardarEnvio", usuario.id).allowed) {
    return { ok: false, errores: ["Guardaste tu envío muchas veces seguidas. Esperá un rato y probá de nuevo."] };
  }
  const ahora = new Date();
  // Se reemplaza todo el envío: el tope por persona vale sobre el total, no sobre cada guardado.
  const obras = e.works.map((w, i) => ({ ...w, callId: c.id, sortOrder: i }));
  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      await exigirQueRecibe(tx, c);
      const previo = await tx.culturalCallSubmission.findUnique({ where: { callId_userId: { callId: c.id, userId: usuario.id } }, select: { id: true } });
      if (previo) {
        // Dos pestañas sobre el mismo envío: la segunda espera a la primera y recién ahí reemplaza.
        await tx.$queryRaw`SELECT id FROM "CulturalCallSubmission" WHERE id = ${previo.id} FOR UPDATE`;
        await tx.culturalCallWork.deleteMany({ where: { submissionId: previo.id } });
        await tx.culturalCallSubmission.update({
          where: { id: previo.id },
          data: { authorName: e.authorName, status: "ACTIVE", withdrawnAt: null, basesAcceptedAt: ahora, rightsAcceptedAt: ahora },
        });
        await tx.culturalCallWork.createMany({ data: obras.map((o) => ({ ...o, submissionId: previo.id })) });
        return previo.id;
      }
      const nuevo = await tx.culturalCallSubmission.create({
        data: { callId: c.id, userId: usuario.id, authorName: e.authorName, basesAcceptedAt: ahora, rightsAcceptedAt: ahora, works: { create: obras } },
        select: { id: true },
      });
      return nuevo.id;
    });
  } catch (err) {
    if (err === CERRADA) return NO_RECIBE;
    // Dos pestañas creando a la vez: la segunda choca con el único (convocatoria, persona).
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
      return { ok: false, errores: ["Tu envío se estaba guardando desde otra pestaña. Recargá la página y revisalo."] };
    }
    throw err;
  }
  revalidatePath("/panel/envios");
  await avisarEnvioRecibido(id);
  return { ok: true, id };
}

/** Retira el envío propio. Se puede volver a enviar mientras la convocatoria reciba obras. */
export async function retirarEnvio(callId: string): Promise<ResultadoAccion> {
  if (typeof callId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await convocatoria(callId);
  if (!c) return NO_EXISTE;
  if (!recibe(c)) return NO_RECIBE;
  let count: number;
  try {
    count = await prisma.$transaction(async (tx) => {
      await exigirQueRecibe(tx, c);
      const r = await tx.culturalCallSubmission.updateMany({
        where: { callId, userId: usuario.id, status: "ACTIVE" },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      });
      return r.count;
    });
  } catch (err) {
    if (err === CERRADA) return NO_RECIBE;
    throw err;
  }
  if (count === 0) return { ok: false, errores: ["No tenés un envío activo en esta convocatoria."] };
  revalidatePath("/panel/envios");
  return { ok: true, id: callId };
}
