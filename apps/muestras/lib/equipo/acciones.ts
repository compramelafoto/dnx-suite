"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { invitationState, isTeamRole, normalizeEmail, teamInviteProblems, type TeamRole } from "@repo/muestras";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { avisarInvitacionEquipo } from "@/lib/correos/equipo";
import { esTokenConForma, hashDeToken, nuevoTokenDeInvitacion } from "@/lib/curaduria/token";
import { frenarPorUsuario } from "@/lib/limite";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { puede, rolEnMuestra } from "./permisos";

/**
 * Equipo de una muestra (etapa 5, D5–D6). Invitar, reenviar, cambiar rol y sacar son del dueño
 * (`manageTeam`); aceptar exige la cuenta del email invitado; cada integrante puede dejar el
 * equipo. Cada acción vuelve a leer la sesión y el rol en la base.
 */
const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La muestra no existe."] };
const INVALIDA: ResultadoAccion = { ok: false, errores: ["La invitación no es válida."] };
const CAMBIO: ResultadoAccion = { ok: false, errores: ["La invitación cambió mientras tanto. Recargá la página."] };

type Muestra = { id: string; title: string; ownerEmail: string | null };

/** La muestra, si esta persona puede manejar su equipo (dueño o super admin). */
async function muestraParaEquipo(activityId: string, usuario: Usuario): Promise<Muestra | null> {
  const r = await rolEnMuestra(activityId, usuario);
  if (!r || !puede(usuario, "manageTeam", r.role)) return null;
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, type: true, proposedByUserId: true } });
  if (!a || a.type !== "MUESTRA") return null;
  const dueno = await prisma.user.findUnique({ where: { id: a.proposedByUserId }, select: { email: true } });
  return { id: a.id, title: a.title, ownerEmail: dueno?.email ?? null };
}

/** Invitación nueva o renovada (token nuevo). Si el correo no sale, devuelve el enlace a quien invita. */
async function invitar(a: Muestra, usuario: Usuario, emailCrudo: string, rol: unknown): Promise<ResultadoAccion> {
  const email = normalizeEmail(emailCrudo);
  const [previo, ocupados] = await Promise.all([
    email ? prisma.culturalActivityMember.findUnique({ where: { activityId_email: { activityId: a.id, email } }, select: { id: true, status: true } }) : null,
    prisma.culturalActivityMember.count({ where: { activityId: a.id, status: { in: ["INVITED", "ACTIVE"] } } }),
  ]);
  const problemas = teamInviteProblems({ email, role: rol, ownerEmail: a.ownerEmail, occupied: ocupados, existing: previo });
  if (problemas.length || !email || !isTeamRole(rol)) return { ok: false, errores: problemas.length ? problemas : ["Elegí un rol."] };
  if (!frenarPorUsuario("invitarEquipo", usuario.id).allowed) return { ok: false, errores: ["Mandaste muchas invitaciones seguidas. Esperá un rato."] };
  const { token, hash } = nuevoTokenDeInvitacion();
  const ahora = new Date();
  let fila: { id: string };
  try {
    fila = previo
      ? await prisma.culturalActivityMember.update({
          // `status: { not: "ACTIVE" }`: si aceptó justo ahora, no se pisa su alta.
          where: { id: previo.id, status: { not: "ACTIVE" } },
          data: { tokenHash: hash, role: rol, status: "INVITED", invitedAt: ahora, invitedByUserId: usuario.id, revokedAt: null, acceptedAt: null, userId: null },
          select: { id: true },
        })
      : await prisma.culturalActivityMember.create({
          data: { activityId: a.id, email, role: rol, tokenHash: hash, invitedByUserId: usuario.id, invitedAt: ahora },
          select: { id: true },
        });
  } catch {
    return CAMBIO;
  }
  const aviso = await avisarInvitacionEquipo({ email, token, muestra: a.title, rol, invita: usuario.name?.trim() || usuario.email, invitedAt: ahora });
  revalidatePath(`/panel/muestras/${a.id}/equipo`);
  // Sin correo, el enlace vuelve sólo a quien invita (D6). El token crudo no se guarda.
  return aviso.enviado ? { ok: true, id: fila.id } : { ok: true, id: fila.id, enlace: aviso.url };
}

export async function invitarAlEquipo(activityId: string, emailCrudo: string, rol: string): Promise<ResultadoAccion> {
  if (typeof activityId !== "string" || typeof emailCrudo !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const a = await muestraParaEquipo(activityId, usuario);
  if (!a) return NO_EXISTE;
  return invitar(a, usuario, emailCrudo, rol);
}

/** La fila del equipo y su muestra, si esta persona maneja el equipo. */
async function filaParaGestionar(memberId: string, usuario: Usuario) {
  if (typeof memberId !== "string") return null;
  const m = await prisma.culturalActivityMember.findUnique({ where: { id: memberId }, select: { id: true, activityId: true, email: true, role: true, status: true } });
  if (!m) return null;
  const a = await muestraParaEquipo(m.activityId, usuario);
  return a ? { m, a } : null;
}

/** Token nuevo con el mismo email y rol (el enlace anterior deja de servir). */
export async function reenviarInvitacion(memberId: string): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const r = await filaParaGestionar(memberId, usuario);
  if (!r) return NO_EXISTE;
  if (r.m.status === "ACTIVE") return { ok: false, errores: ["Ya está en el equipo."] };
  return invitar(r.a, usuario, r.m.email, r.m.role);
}

/** A alguien activo no se le pide aceptar de nuevo. */
export async function cambiarRol(memberId: string, rol: string): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!isTeamRole(rol)) return { ok: false, errores: ["Elegí un rol."] };
  const r = await filaParaGestionar(memberId, usuario);
  if (!r) return NO_EXISTE;
  const { count } = await prisma.culturalActivityMember.updateMany({
    where: { id: r.m.id, activityId: r.a.id, status: { in: ["INVITED", "ACTIVE"] } },
    data: { role: rol satisfies TeamRole },
  });
  if (count === 0) return CAMBIO;
  revalidatePath(`/panel/muestras/${r.a.id}`, "layout");
  return { ok: true, id: r.m.id };
}

/** Efecto inmediato: el próximo pedido de esa persona ya no encuentra la muestra. */
export async function sacarDelEquipo(memberId: string): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const r = await filaParaGestionar(memberId, usuario);
  if (!r) return NO_EXISTE;
  await prisma.culturalActivityMember.updateMany({
    where: { id: r.m.id, activityId: r.a.id, status: { not: "REVOKED" } },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  revalidatePath(`/panel/muestras/${r.a.id}`, "layout");
  return { ok: true, id: r.m.id };
}

/**
 * Se acepta sólo con la cuenta cuyo email es el invitado (D5): un enlace reenviado no le da
 * acceso a un tercero. El enlace es de un solo uso y vence a los 30 días.
 */
export async function aceptarInvitacionEquipo(token: string): Promise<ResultadoAccion> {
  if (!esTokenConForma(token)) return INVALIDA;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("aceptarEquipo", usuario.id).allowed) return { ok: false, errores: ["Demasiados intentos. Esperá un rato."] };
  const k = await prisma.culturalActivityMember.findUnique({
    where: { tokenHash: hashDeToken(token) },
    select: { id: true, activityId: true, email: true, status: true, invitedAt: true, activity: { select: { proposedByUserId: true } } },
  });
  if (!k) return INVALIDA;
  const estado = invitationState(k, new Date());
  if (estado === "USED") return { ok: false, errores: ["Esta invitación ya se usó."] };
  if (estado === "EXPIRED") return { ok: false, errores: ["La invitación venció. Pedile a quien organiza que te la vuelva a mandar."] };
  if (estado === "REVOKED") return INVALIDA;
  if (usuario.id === k.activity.proposedByUserId) return { ok: false, errores: ["Esta invitación no se puede aceptar con esta cuenta."] };
  if (usuario.email.trim().toLowerCase() !== k.email.trim().toLowerCase()) {
    return { ok: false, errores: [`Esta invitación es para ${k.email}. Entrá con esa cuenta de Google para aceptarla.`] };
  }
  let count: number;
  try {
    // Una fila vieja de esta cuenta que quedó fuera del equipo (otro email, ya revocada) no tiene
    // que trabar el alta por el único (activityId, userId).
    await prisma.culturalActivityMember.updateMany({
      where: { activityId: k.activityId, userId: usuario.id, status: "REVOKED", id: { not: k.id } },
      data: { userId: null },
    });
    ({ count } = await prisma.culturalActivityMember.updateMany({
      where: { id: k.id, status: "INVITED" },
      data: { status: "ACTIVE", userId: usuario.id, acceptedAt: new Date() },
    }));
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { ok: false, errores: ["Tu cuenta ya forma parte del equipo de esta muestra."] };
    throw e;
  }
  if (count === 0) return { ok: false, errores: ["Esta invitación ya se usó."] };
  revalidatePath("/panel", "layout");
  return { ok: true, id: k.activityId };
}

/** Cualquier integrante puede irse. El dueño no está en la tabla: no se puede ir de su muestra. */
export async function dejarElEquipo(activityId: string): Promise<ResultadoAccion> {
  if (typeof activityId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const { count } = await prisma.culturalActivityMember.updateMany({
    where: { activityId, userId: usuario.id, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (count === 0) return { ok: false, errores: ["No sos parte del equipo de esta muestra."] };
  revalidatePath("/panel", "layout");
  return { ok: true, id: activityId };
}
