"use server";

import { prisma } from "@repo/db";

import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { userIsFotorankSuperAdmin } from "../lib/fotorank/access/super-admin";
import { enqueueTransactionalEmail } from "../lib/fotorank/notifications/outbox";
import { direccionPublicaDeFotorank } from "../lib/fotorank/notifications/plantillaInstitucional";

/**
 * Invitar a alguien a sumarse al padrón de jurados, sin un concurso de por medio.
 *
 * La invitación desde el directorio es a un concurso puntual y sólo sirve para
 * quien ya está aprobado. Para convocar a alguien nuevo había que pasarle el
 * enlace de postulación a mano. Esto le manda un correo institucional con ese
 * enlace; después sigue el circuito de siempre (postulación → revisión →
 * directorio).
 */

const TOPE_POR_DIA = 30;
const EVENTO = "JUDGE_RECRUIT_INVITE_SENT";

export type EstadoDeConvocatoria = { ok: boolean; mensaje: string | null };

function correoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function convocarJuradoAction(
  _prev: EstadoDeConvocatoria | undefined,
  fd: FormData,
): Promise<EstadoDeConvocatoria> {
  const user = await requireAuth();
  const esSuperAdmin = userIsFotorankSuperAdmin(user);
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok && !esSuperAdmin) {
    return { ok: false, mensaje: "Necesitás una organización para convocar jurados." };
  }

  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const nombre = String(fd.get("nombre") ?? "").trim().slice(0, 80);
  const mensaje = String(fd.get("mensaje") ?? "").trim().slice(0, 600);
  if (!correoValido(email)) return { ok: false, mensaje: "Revisá el correo: no parece válido." };

  // Si ya tiene ficha, no hace falta convocarlo: se le dice qué hacer.
  const existente = await prisma.fotorankJudgeAccount.findUnique({
    where: { email },
    select: { profile: { select: { directoryReviewStatus: true } } },
  });
  if (existente) {
    return {
      ok: false,
      mensaje:
        existente.profile?.directoryReviewStatus === "APPROVED"
          ? "Esa persona ya es jurado de FotoRank: buscala en el directorio e invitala a tu concurso."
          : "Esa persona ya se postuló; su ficha está en revisión.",
    };
  }

  // La misma persona no recibe dos convocatorias en un mes, venga de quien venga.
  const haceUnMes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const yaConvocada = await prisma.fotorankJudgeAuditEvent.findFirst({
    where: { eventType: EVENTO, entityId: email, createdAt: { gte: haceUnMes } },
    select: { id: true },
  });
  if (yaConvocada) {
    return { ok: false, mensaje: "A esa persona ya la convocaron este mes; esperá su postulación." };
  }

  // Tope diario por persona: es un correo que sale a nombre de FotoRank.
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const enviadas = await prisma.fotorankJudgeAuditEvent.count({
    where: { actorUserId: user.id, eventType: EVENTO, createdAt: { gte: desde } },
  });
  if (enviadas >= TOPE_POR_DIA) {
    return { ok: false, mensaje: `Llegaste al máximo de ${TOPE_POR_DIA} convocatorias por día.` };
  }

  const organizacion = org.ok ? org.org.name : "FotoRank";
  await enqueueTransactionalEmail({
    kind: "JURY_RECRUIT_INVITATION",
    toEmail: email,
    payload: {
      firstName: nombre,
      organizationName: organizacion,
      invitador: user.name?.trim() || organizacion,
      mensaje,
      postulacionUrl: `${direccionPublicaDeFotorank()}/jurados/postulacion`,
    },
  });

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: org.ok ? org.org.id : null,
      actorType: "ADMIN",
      actorUserId: user.id,
      eventType: EVENTO,
      entityType: "EmailOutbox",
      entityId: email,
      payloadJson: { conMensaje: Boolean(mensaje) },
    },
  });

  return { ok: true, mensaje: `Listo: le mandamos la convocatoria a ${email}.` };
}
