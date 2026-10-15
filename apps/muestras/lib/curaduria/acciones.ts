"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { CALL_TEXT_LIMITS, activityRole, canScore, invitationState, isValidScore, normalizeEmail } from "@repo/muestras";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { puedeConDueno } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { avisarInvitacionCurador } from "@/lib/correos/convocatorias";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { esTokenConForma, hashDeToken, nuevoTokenDeInvitacion } from "./token";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const INVITACION_INVALIDA: ResultadoAccion = { ok: false, errores: ["La invitación no es válida."] };

/**
 * Convocatoria del organizador (o super admin) que todavía admite cambios en el equipo
 * curatorial. Sólo el dueño (`manageCall`, etapa 5 D4): la coorganización de la muestra no.
 */
async function convocatoriaParaEquipo(callId: string, usuario: Usuario) {
  const c = await prisma.culturalCall.findUnique({ where: { id: callId }, select: { id: true, title: true, status: true, activity: { select: { proposedByUserId: true } } } });
  if (!c || !puedeConDueno(usuario, "manageCall", c.activity.proposedByUserId)) return null;
  return c;
}

/** Invita por email. Si ya estaba invitada (o revocada), renueva el enlace. */
export async function invitarCurador(callId: string, emailCrudo: string): Promise<ResultadoAccion> {
  if (typeof callId !== "string" || typeof emailCrudo !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await convocatoriaParaEquipo(callId, usuario);
  if (!c) return NO_EXISTE;
  if (c.status === "DONE") return { ok: false, errores: ["La selección ya terminó."] };
  const email = normalizeEmail(emailCrudo);
  if (!email) return { ok: false, errores: ["Escribí un email válido."] };
  if (!frenarPorUsuario("invitarCurador", usuario.id).allowed) {
    return { ok: false, errores: ["Mandaste muchas invitaciones seguidas. Esperá un rato y probá de nuevo."] };
  }
  // No se chequea acá si la persona envió obras: la respuesta le diría al organizador quién
  // participa (rompe el anonimato). El choque se resuelve en `aceptarInvitacion`, que se lo dice
  // a la persona invitada y no a quien organiza.
  const { token, hash } = nuevoTokenDeInvitacion();
  const ahora = new Date();
  const previo = await prisma.culturalCallCurator.findUnique({ where: { callId_email: { callId, email } }, select: { id: true, status: true } });
  if (previo?.status === "ACTIVE") return { ok: false, errores: ["Esa persona ya es parte del equipo curatorial."] };
  let fila: { id: string };
  try {
    if (previo) {
      // Renovar es empezar de cero: se borran los puntajes de la fila y se la desvincula de la
      // cuenta, así otra cuenta puede aceptar sin heredar (ni pisar) puntajes ajenos.
      fila = await prisma.$transaction(async (tx) => {
        await tx.culturalCallScore.deleteMany({ where: { curatorId: previo.id } });
        return tx.culturalCallCurator.update({
          // `status: { not: "ACTIVE" }`: si aceptó justo ahora, no se pisa su alta.
          where: { id: previo.id, status: { not: "ACTIVE" } },
          data: { tokenHash: hash, status: "INVITED", invitedAt: ahora, invitedByUserId: usuario.id, revokedAt: null, acceptedAt: null, userId: null },
          select: { id: true },
        });
      });
    } else {
      fila = await prisma.culturalCallCurator.create({ data: { callId, email, tokenHash: hash, invitedByUserId: usuario.id, invitedAt: ahora }, select: { id: true } });
    }
  } catch {
    return { ok: false, errores: ["No se pudo invitar: la invitación cambió mientras tanto. Recargá la página."] };
  }
  const aviso = await avisarInvitacionCurador({ email, token, convocatoria: c.title, organizador: usuario.name ?? usuario.email, invitedAt: ahora });
  revalidatePath(`/panel/convocatorias/${callId}`);
  // Si el correo no salió, el enlace vuelve sólo a quien invitó (es el actor de esta acción) para
  // que lo mande a mano. El token crudo no se guarda en ningún lado.
  return aviso.enviado ? { ok: true, id: fila.id } : { ok: true, id: fila.id, enlace: aviso.url };
}

/** Saca a alguien del equipo. Sus puntajes dejan de contar en el ranking. */
export async function revocarCurador(curatorId: string): Promise<ResultadoAccion> {
  if (typeof curatorId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const k = await prisma.culturalCallCurator.findUnique({ where: { id: curatorId }, select: { callId: true } });
  if (!k) return NO_EXISTE;
  const c = await convocatoriaParaEquipo(k.callId, usuario);
  if (!c) return NO_EXISTE;
  if (c.status === "DONE") return { ok: false, errores: ["La selección ya terminó."] };
  await prisma.culturalCallCurator.updateMany({ where: { id: curatorId, status: { not: "REVOKED" } }, data: { status: "REVOKED", revokedAt: new Date() } });
  revalidatePath(`/panel/convocatorias/${k.callId}`);
  return { ok: true, id: curatorId };
}

/**
 * Acepta sólo con la cuenta cuyo email es el invitado. Exigirlo cierra un oráculo de anonimato:
 * quien organiza recibe el enlace cuando el correo no sale y, si cualquier cuenta pudiera aceptar,
 * podría abrirlo y saber por el error si esa persona envió obras. Por lo mismo, quien organiza y
 * quien invitó no pueden aceptar invitaciones de su convocatoria, y el email se compara antes de
 * mirar ningún envío. El enlace es de un solo uso y vence a los 30 días.
 */
export async function aceptarInvitacion(token: string): Promise<ResultadoAccion> {
  if (!esTokenConForma(token)) return INVITACION_INVALIDA;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("aceptarInvitacion", usuario.id).allowed) return { ok: false, errores: ["Demasiados intentos. Esperá un rato."] };
  const k = await prisma.culturalCallCurator.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: {
      id: true, callId: true, email: true, status: true, invitedAt: true, userId: true, invitedByUserId: true,
      call: { select: { createdByUserId: true, activity: { select: { proposedByUserId: true } } } },
    },
  });
  if (!k) return INVITACION_INVALIDA;
  const estado = invitationState(k, new Date());
  if (estado === "USED") return { ok: false, errores: ["Esta invitación ya se usó."] };
  if (estado === "EXPIRED") return { ok: false, errores: ["La invitación venció. Pedile a quien organiza que te la vuelva a mandar."] };
  if (estado === "REVOKED") return INVITACION_INVALIDA;
  // Conflicto de la etapa 3, sin cambios: quien invitó, quien creó la convocatoria o el dueño de la
  // muestra no curan. La coorganización no entra (no ve el ranking: D4 de la etapa 5).
  if (usuario.id === k.invitedByUserId || usuario.id === k.call.createdByUserId || activityRole(k.call.activity, usuario.id) === "OWNER") {
    return { ok: false, errores: ["Esta invitación no se puede aceptar con esta cuenta."] };
  }
  if (usuario.email.trim().toLowerCase() !== k.email.trim().toLowerCase()) {
    return { ok: false, errores: [`Esta invitación es para ${k.email}. Entrá con esa cuenta de Google para aceptarla.`] };
  }
  if (k.userId != null && k.userId !== usuario.id) {
    return { ok: false, errores: ["Esta invitación quedó asociada a otra cuenta. Volvé a entrar con esa cuenta o pedí una invitación nueva."] };
  }
  // Desde acá el email invitado es el de la cuenta que acepta: lo que se mire de sus envíos es
  // sólo de ella (y de otras cuentas con su mismo email), no de terceros.
  const [envio, yaEsta, cuentasDelEmail] = await Promise.all([
    prisma.culturalCallSubmission.findFirst({ where: { callId: k.callId, userId: usuario.id }, select: { id: true } }),
    prisma.culturalCallCurator.findFirst({ where: { callId: k.callId, userId: usuario.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.user.findMany({ where: { email: { equals: usuario.email.trim(), mode: "insensitive" } }, select: { id: true } }),
  ]);
  const otrasCuentas = cuentasDelEmail.map((u) => u.id).filter((id) => id !== usuario.id);
  const envioDelEmail = envio || otrasCuentas.length === 0 ? null : await prisma.culturalCallSubmission.findFirst({
    where: { callId: k.callId, status: "ACTIVE", userId: { in: otrasCuentas } },
    select: { id: true },
  });
  // Mismo mensaje en los dos casos: no se da ningún detalle extra.
  if (envio || envioDelEmail) return { ok: false, errores: ["Enviaste obras a esta convocatoria: no podés ser parte del equipo curatorial."] };
  if (yaEsta) {
    // Ya está en el equipo por otra fila: esta invitación no queda vigente.
    await prisma.culturalCallCurator.updateMany({ where: { id: k.id, status: "INVITED" }, data: { status: "REVOKED", revokedAt: new Date() } });
    return { ok: true, id: k.callId };
  }
  let count: number;
  try {
    ({ count } = await prisma.culturalCallCurator.updateMany({
      where: { id: k.id, status: "INVITED" },
      data: { status: "ACTIVE", userId: usuario.id, acceptedAt: new Date() },
    }));
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { ok: false, errores: ["Tu cuenta ya forma parte del equipo de esta convocatoria con otra invitación."] };
    throw e;
  }
  if (count === 0) return { ok: false, errores: ["Esta invitación ya se usó."] };
  revalidatePath("/panel/curaduria");
  return { ok: true, id: k.callId };
}

/** Puntaje de 1 a 5 y nota optativa del curador a una obra. Se puede cambiar mientras dure la curaduría. */
export async function puntuar(callWorkId: string, score: number, nota: string): Promise<ResultadoAccion> {
  if (typeof callWorkId !== "string") return NO_EXISTE;
  if (!isValidScore(score)) return { ok: false, errores: ["El puntaje va de 1 a 5."] };
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("puntuar", usuario.id).allowed) return { ok: false, errores: ["Vas muy rápido. Esperá unos minutos."] };
  const w = await prisma.culturalCallWork.findUnique({
    where: { id: callWorkId },
    select: { id: true, callId: true, anonymousCode: true, submission: { select: { status: true } }, call: { select: { status: true } } },
  });
  if (!w || !w.anonymousCode || w.submission.status !== "ACTIVE") return { ok: false, errores: ["La obra no existe."] };
  const k = await prisma.culturalCallCurator.findFirst({ where: { callId: w.callId, userId: usuario.id, status: "ACTIVE" }, select: { id: true, status: true } });
  if (!k || !canScore({ status: w.call.status, curatorStatus: k.status })) return { ok: false, errores: ["No podés puntuar esta obra ahora."] };
  const note = typeof nota === "string" ? nota.trim().slice(0, CALL_TEXT_LIMITS.note).trim() || null : null;
  // El estado se vuelve a leer con bloqueo (FOR SHARE) dentro de la transacción: si la curaduría
  // se cierra o sacan al curador justo ahora, la escritura espera y después se rechaza.
  const escrito = await prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<{ callStatus: string; curatorStatus: string }[]>`
      SELECT c."status" AS "callStatus", k."status" AS "curatorStatus"
      FROM "CulturalCall" c JOIN "CulturalCallCurator" k ON k."callId" = c."id"
      WHERE c."id" = ${w.callId} AND k."id" = ${k.id}
      FOR SHARE`;
    const f = filas[0];
    if (!f || !canScore({ status: f.callStatus, curatorStatus: f.curatorStatus })) return false;
    await tx.culturalCallScore.upsert({
      where: { callWorkId_curatorId: { callWorkId, curatorId: k.id } },
      create: { callWorkId, curatorId: k.id, score, note },
      update: { score, note },
    });
    return true;
  });
  if (!escrito) return { ok: false, errores: ["No podés puntuar esta obra ahora."] };
  return { ok: true, id: callWorkId };
}
