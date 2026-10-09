import "server-only";
import { prisma } from "@repo/db";
import { curatorOrder, invitationState, toCuratorView, type CuratorWorkView } from "@repo/muestras";
import { hashDeToken, esTokenConForma } from "./token";

/** Las convocatorias donde la persona es curadora activa, con su avance. */
export async function listarMisCuradurias(userId: number) {
  const filas = await prisma.culturalCallCurator.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      call: { select: { id: true, title: true, status: true, closesAt: true } },
      _count: { select: { scores: true } },
    },
    orderBy: { acceptedAt: "desc" },
  });
  const totales = await Promise.all(filas.map((f) => prisma.culturalCallWork.count({ where: { callId: f.call.id, anonymousCode: { not: null }, submission: { status: "ACTIVE" } } })));
  return filas.map((f, i) => ({ curatorId: f.id, call: f.call, puntuadas: f._count.scores, total: totales[i] }));
}

export type ColaDelCurador = {
  call: { id: string; title: string; status: string; basesText: string };
  obras: CuratorWorkView[];
};

/**
 * Lo que ve un curador. La consulta pide sólo los campos permitidos (nunca el envío, el autor
 * ni la URL de la imagen) y `toCuratorView` vuelve a armar cada obra campo por campo.
 * `null` si no es curador activo o la curaduría no empezó.
 */
export async function colaDelCurador(callId: string, userId: number): Promise<ColaDelCurador | null> {
  const k = await prisma.culturalCallCurator.findFirst({ where: { callId, userId, status: "ACTIVE" }, select: { id: true } });
  if (!k) return null;
  const call = await prisma.culturalCall.findUnique({ where: { id: callId }, select: { id: true, title: true, status: true, basesText: true } });
  if (!call || (call.status !== "CURATING" && call.status !== "DONE")) return null;
  const obras = await prisma.culturalCallWork.findMany({
    where: { callId, anonymousCode: { not: null }, submission: { status: "ACTIVE" } },
    select: {
      id: true, anonymousCode: true, title: true, year: true, technique: true, statement: true,
      scores: { where: { curatorId: k.id }, select: { score: true, note: true } },
    },
  });
  const vistas = obras.map((o) => toCuratorView(o, o.scores[0] ?? null));
  return { call, obras: curatorOrder(vistas, k.id, callId) };
}

/** Para la página de la invitación: de qué convocatoria es y si sigue vigente. */
export async function buscarInvitacion(token: string) {
  if (!esTokenConForma(token)) return null;
  const k = await prisma.culturalCallCurator.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: { email: true, status: true, invitedAt: true, call: { select: { id: true, title: true } } },
  });
  if (!k) return null;
  return { email: k.email, callId: k.call.id, convocatoria: k.call.title, estado: invitationState(k, new Date()) };
}
