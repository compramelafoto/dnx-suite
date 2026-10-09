import "server-only";
import { prisma } from "@repo/db";
import { INVITATION_TTL_DAYS } from "@repo/muestras";
import { APP_URL, enviar, enviarEnLote, type Mensaje, type ResultadoDeLote } from "./enviar";
import {
  textoConvocatoriaCerrada, textoEnvioRecibido, textoInvitacionCurador, textoNoSeleccionada, textoSeleccionada, type Texto,
} from "./textos-convocatoria";

/**
 * Si el lote no salió (compuerta cerrada o todos los pedidos rechazados) se devuelve la marca a
 * `null`, para que un reintento posterior pueda mandarlo. Sólo si la marca sigue siendo la nuestra.
 */
async function soltarMarca(callId: string, campo: "closedNoticeSentAt" | "resultsNoticeSentAt", marca: Date, r: ResultadoDeLote) {
  if (r.total === 0 || r.aceptados > 0) return;
  await prisma.culturalCall.updateMany({ where: { id: callId, [campo]: marca }, data: { [campo]: null } });
}

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
    const marca = new Date();
    const { count } = await prisma.culturalCall.updateMany({ where: { id: callId, closedNoticeSentAt: null }, data: { closedNoticeSentAt: marca } });
    if (count === 0) return;
    const call = await prisma.culturalCall.findUnique({
      where: { id: callId },
      select: { title: true, submissions: { where: { status: "ACTIVE" }, select: { userId: true, authorName: true } } },
    });
    if (!call) {
      await soltarMarca(callId, "closedNoticeSentAt", marca, { compuerta: true, total: 1, aceptados: 0 });
      return;
    }
    const us = await personas(call.submissions.map((s) => s.userId));
    const r = await enviarEnLote(call.submissions.flatMap((s) => {
      const u = us.get(s.userId);
      return u ? [aMensaje(u.email, textoConvocatoriaCerrada({ nombre: s.authorName.split(" ")[0] || null, convocatoria: call.title, appUrl: APP_URL }))] : [];
    }));
    await soltarMarca(callId, "closedNoticeSentAt", marca, r);
  } catch (err) {
    console.error("[muestras] falló el aviso de cierre", err);
  }
}

/**
 * Sólo cuando la curaduría terminó. Para entonces, una obra sin decidir cuenta como no elegida
 * (regla D20): todos reciben su resultado y sólo se nombran las elegidas.
 */
export async function avisarResultados(callId: string): Promise<void> {
  try {
    const cerrada = await prisma.culturalCall.findUnique({ where: { id: callId }, select: { status: true, curationClosedAt: true } });
    if (!cerrada || (cerrada.status !== "DONE" && !cerrada.curationClosedAt)) {
      console.info("[muestras] resultados no enviados: la curaduría sigue abierta", callId);
      return;
    }
    const marca = new Date();
    const { count } = await prisma.culturalCall.updateMany({ where: { id: callId, resultsNoticeSentAt: null }, data: { resultsNoticeSentAt: marca } });
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
    if (!call) {
      await soltarMarca(callId, "resultsNoticeSentAt", marca, { compuerta: true, total: 1, aceptados: 0 });
      return;
    }
    const recibidas = call.submissions.reduce((n, s) => n + s.works.length, 0);
    const elegidas = call.submissions.reduce((n, s) => n + s.works.filter((w) => w.decision === "SELECTED").length, 0);
    const us = await personas(call.submissions.map((s) => s.userId));
    const r = await enviarEnLote(call.submissions.flatMap((s) => {
      const u = us.get(s.userId);
      if (!u) return [];
      const nombre = s.authorName.split(" ")[0] || null;
      const titulos = s.works.filter((w) => w.decision === "SELECTED").map((w) => w.title);
      return [aMensaje(u.email, titulos.length
        ? textoSeleccionada({ nombre, convocatoria: call.title, titulos, appUrl: APP_URL })
        : textoNoSeleccionada({ nombre, convocatoria: call.title, recibidas, elegidas, appUrl: APP_URL }))];
    }));
    await soltarMarca(callId, "resultsNoticeSentAt", marca, r);
  } catch (err) {
    console.error("[muestras] falló el aviso de resultados", err);
  }
}

/** Enlace que acepta la invitación: el mismo que va en el correo. */
export const enlaceDeInvitacion = (token: string) => `${APP_URL}/panel/curaduria/invitacion/${token}`;

/**
 * Devuelve si el correo salió y el enlace: si no salió, quien organiza lo recibe para mandarlo
 * a mano. Nunca tira.
 */
export async function avisarInvitacionCurador(p: { email: string; token: string; convocatoria: string; organizador: string; invitedAt: Date }): Promise<{ enviado: boolean; url: string }> {
  const url = enlaceDeInvitacion(p.token);
  try {
    const vence = new Date(p.invitedAt.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const t = textoInvitacionCurador({ convocatoria: p.convocatoria, organizador: p.organizador, vence, url });
    return { enviado: await enviar(p.email, t.subject, t.parrafos, t.enlace), url };
  } catch (err) {
    console.error("[muestras] falló la invitación a curar", err);
    return { enviado: false, url };
  }
}
