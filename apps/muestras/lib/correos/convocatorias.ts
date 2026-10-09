import "server-only";
import { prisma } from "@repo/db";
import { INVITATION_TTL_DAYS } from "@repo/muestras";
import { APP_URL, enviar, enviarEnLote, type Mensaje } from "./enviar";
import {
  textoConvocatoriaCerrada, textoEnvioRecibido, textoInvitacionCurador, textoNoSeleccionada, textoSeleccionada, type Texto,
} from "./textos-convocatoria";

/** Ninguno tira: un correo que no sale no puede deshacer un envío, un cierre ni una selección. */

const aMensaje = (to: string, t: Texto): Mensaje => ({ to, subject: t.subject, parrafos: t.parrafos, enlace: t.enlace });

async function personas(ids: readonly number[]) {
  if (ids.length === 0) return new Map<number, { email: string; name: string | null }>();
  const filas = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true, name: true } });
  return new Map(filas.map((u) => [u.id, { email: u.email, name: u.name }]));
}

export async function avisarEnvioRecibido(submissionId: string): Promise<void> {
  try {
    const s = await prisma.culturalCallSubmission.findUnique({
      where: { id: submissionId },
      select: { userId: true, authorName: true, call: { select: { title: true, closesAt: true } }, _count: { select: { works: true } } },
    });
    if (!s) return;
    const u = (await personas([s.userId])).get(s.userId);
    if (!u) return;
    const t = textoEnvioRecibido({ nombre: s.authorName.split(" ")[0] || null, convocatoria: s.call.title, obras: s._count.works, cierre: s.call.closesAt, appUrl: APP_URL });
    await enviar(u.email, t.subject, t.parrafos, t.enlace);
  } catch (err) {
    console.error("[muestras] falló el aviso de envío recibido", err);
  }
}

/** Se marca `closedNoticeSentAt` antes de mandar: si dos pedidos llegan juntos, sale uno solo. */
export async function avisarConvocatoriaCerrada(callId: string): Promise<void> {
  try {
    const { count } = await prisma.culturalCall.updateMany({ where: { id: callId, closedNoticeSentAt: null }, data: { closedNoticeSentAt: new Date() } });
    if (count === 0) return;
    const call = await prisma.culturalCall.findUnique({
      where: { id: callId },
      select: { title: true, submissions: { where: { status: "ACTIVE" }, select: { userId: true, authorName: true } } },
    });
    if (!call) return;
    const us = await personas(call.submissions.map((s) => s.userId));
    await enviarEnLote(call.submissions.flatMap((s) => {
      const u = us.get(s.userId);
      return u ? [aMensaje(u.email, textoConvocatoriaCerrada({ nombre: s.authorName.split(" ")[0] || null, convocatoria: call.title, appUrl: APP_URL }))] : [];
    }));
  } catch (err) {
    console.error("[muestras] falló el aviso de cierre", err);
  }
}

export async function avisarResultados(callId: string): Promise<void> {
  try {
    const { count } = await prisma.culturalCall.updateMany({ where: { id: callId, resultsNoticeSentAt: null }, data: { resultsNoticeSentAt: new Date() } });
    if (count === 0) return;
    const call = await prisma.culturalCall.findUnique({
      where: { id: callId },
      select: {
        title: true,
        submissions: {
          where: { status: "ACTIVE" },
          select: { userId: true, authorName: true, works: { orderBy: { sortOrder: "asc" }, select: { title: true, decision: true } } },
        },
      },
    });
    if (!call) return;
    const recibidas = call.submissions.reduce((n, s) => n + s.works.length, 0);
    const elegidas = call.submissions.reduce((n, s) => n + s.works.filter((w) => w.decision === "SELECTED").length, 0);
    const us = await personas(call.submissions.map((s) => s.userId));
    await enviarEnLote(call.submissions.flatMap((s) => {
      const u = us.get(s.userId);
      if (!u) return [];
      const nombre = s.authorName.split(" ")[0] || null;
      const titulos = s.works.filter((w) => w.decision === "SELECTED").map((w) => w.title);
      return [aMensaje(u.email, titulos.length
        ? textoSeleccionada({ nombre, convocatoria: call.title, titulos, appUrl: APP_URL })
        : textoNoSeleccionada({ nombre, convocatoria: call.title, recibidas, elegidas, appUrl: APP_URL }))];
    }));
  } catch (err) {
    console.error("[muestras] falló el aviso de resultados", err);
  }
}

export async function avisarInvitacionCurador(p: { email: string; token: string; convocatoria: string; organizador: string; invitedAt: Date }): Promise<void> {
  try {
    const vence = new Date(p.invitedAt.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const t = textoInvitacionCurador({ convocatoria: p.convocatoria, organizador: p.organizador, vence, url: `${APP_URL}/panel/curaduria/invitacion/${p.token}` });
    await enviar(p.email, t.subject, t.parrafos, t.enlace);
  } catch (err) {
    console.error("[muestras] falló la invitación a curar", err);
  }
}
