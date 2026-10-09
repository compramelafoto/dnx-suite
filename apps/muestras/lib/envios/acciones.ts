"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { acceptsSubmissions, callPhase, submissionProblems, submitterConflict } from "@repo/muestras";
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
      activity: { select: { proposedByUserId: true, reviewStatus: true } },
    },
  });
}

/** Sólo recibe obras una convocatoria de una muestra publicada, dentro de sus fechas. */
const recibe = (c: NonNullable<Awaited<ReturnType<typeof convocatoria>>>) =>
  c.activity.reviewStatus === "APPROVED" && acceptsSubmissions(callPhase(c, new Date()));

/** Crea o reemplaza el envío propio mientras la convocatoria recibe obras. */
export async function guardarEnvio(fd: FormData): Promise<ResultadoAccion> {
  if (!(fd instanceof FormData)) return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const e = envioDesdeFormData(fd, usuario.id);
  const c = e.callId ? await convocatoria(e.callId) : null;
  if (!c) return NO_EXISTE;
  if (!recibe(c)) return NO_RECIBE;
  const curador = await prisma.culturalCallCurator.findFirst({
    where: { callId: c.id, status: { not: "REVOKED" }, OR: [{ userId: usuario.id }, { email: usuario.email.toLowerCase() }] },
    select: { id: true },
  });
  const conflicto = submitterConflict({ isOwner: c.activity.proposedByUserId === usuario.id, isCurator: !!curador });
  if (conflicto) return { ok: false, errores: [conflicto] };
  const problemas = submissionProblems(e, c.maxWorksPerPerson);
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
      const previo = await tx.culturalCallSubmission.findUnique({ where: { callId_userId: { callId: c.id, userId: usuario.id } }, select: { id: true } });
      if (previo) {
        await tx.culturalCallWork.deleteMany({ where: { submissionId: previo.id } });
        await tx.culturalCallSubmission.update({
          where: { id: previo.id },
          data: { authorName: e.authorName, status: "ACTIVE", withdrawnAt: null, basesAcceptedAt: ahora, rightsAcceptedAt: ahora, works: { create: obras } },
        });
        return previo.id;
      }
      const nuevo = await tx.culturalCallSubmission.create({
        data: { callId: c.id, userId: usuario.id, authorName: e.authorName, basesAcceptedAt: ahora, rightsAcceptedAt: ahora, works: { create: obras } },
        select: { id: true },
      });
      return nuevo.id;
    });
  } catch (err) {
    // Dos pestañas guardando a la vez: la segunda choca con el único (convocatoria, persona).
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
  const { count } = await prisma.culturalCallSubmission.updateMany({
    where: { callId, userId: usuario.id, status: "ACTIVE" },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });
  if (count === 0) return { ok: false, errores: ["No tenés un envío activo en esta convocatoria."] };
  revalidatePath("/panel/envios");
  return { ok: true, id: callId };
}
