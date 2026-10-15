import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { MENSAJES_AGENDA, puedeGestionarAgenda, puedeVerAgenda, type CtxAgenda } from "./acceso";

/**
 * Participantes de una cita (Etapa 4, Entrega B): cada uno es un integrante del equipo O un contacto
 * del workspace (exactamente uno), con un rol y una nota opcionales. Los roles son los mismos de los
 * proyectos (`FotofficeProyectoRol`, por workspace). La tabla no lleva `workspaceId`: todo se valida
 * a través de la cita.
 */

export const NOTA_PARTICIPANTE_MAXIMA = 500;

type Tx = Prisma.TransactionClient;

export type ParticipanteVisible = {
  id: string;
  userId: number | null;
  clientId: string | null;
  roleId: string | null;
  roleName: string | null;
  note: string | null;
};

export type DatosParticipante = { userId?: unknown; clientId?: unknown; roleId?: unknown; note?: unknown };
export type ParticipanteLimpio = { userId: number | null; clientId: string | null; roleId: string | null; note: string | null };

export type ResultadoParticipante = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}
function usuarioValido(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}

/** Forma de un participante, sin tocar la base: uno solo entre usuario y contacto; rol y nota opcionales. */
export function limpiarParticipante(datos: DatosParticipante): { ok: true; valor: ParticipanteLimpio } | { ok: false; error: string } {
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const tieneUsuario = datos.userId !== undefined && datos.userId !== null;
  const tieneContacto = datos.clientId !== undefined && datos.clientId !== null;
  if (tieneUsuario === tieneContacto) return { ok: false, error: MENSAJES_AGENDA.participante };
  if (tieneUsuario && !usuarioValido(datos.userId)) return { ok: false, error: MENSAJES_AGENDA.integrante };
  if (tieneContacto && !idValido(datos.clientId)) return { ok: false, error: MENSAJES_AGENDA.contacto };
  const rol = datos.roleId === undefined || datos.roleId === null || datos.roleId === "" ? null : datos.roleId;
  if (rol !== null && !idValido(rol)) return { ok: false, error: MENSAJES_AGENDA.rol };
  const nota = leerNota(datos.note);
  if (!nota.ok) return { ok: false, error: MENSAJES_AGENDA.nota };
  return {
    ok: true,
    valor: { userId: tieneUsuario ? (datos.userId as number) : null, clientId: tieneContacto ? (datos.clientId as string) : null, roleId: rol, note: nota.valor },
  };
}

function leerNota(v: unknown): { ok: true; valor: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, valor: null };
  if (typeof v !== "string") return { ok: false };
  const n = v.trim();
  if (n.length > NOTA_PARTICIPANTE_MAXIMA) return { ok: false };
  return { ok: true, valor: n === "" ? null : n };
}

/** Comprueba, dentro de la transacción, que el integrante, el contacto y el rol sean del workspace. */
export async function validarParticipante(tx: Tx, workspaceId: string, p: ParticipanteLimpio): Promise<string | null> {
  if (p.userId !== null) {
    const m = await tx.workspaceMembership.findFirst({ where: { userId: p.userId, workspaceId }, select: { id: true } });
    if (!m) return MENSAJES_AGENDA.integrante;
  }
  if (p.clientId !== null) {
    const c = await tx.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { id: true } });
    if (!c) return MENSAJES_AGENDA.contacto;
  }
  if (p.roleId !== null) {
    const r = await tx.fotofficeProyectoRol.findFirst({ where: { id: p.roleId, workspaceId, isActive: true }, select: { id: true } });
    if (!r) return MENSAJES_AGENDA.rol;
  }
  return null;
}

/** Los participantes de una cita del workspace, en el orden en que se sumaron. */
export async function listarParticipantes(ctx: CtxAgenda, citaId: string): Promise<ParticipanteVisible[]> {
  if (!puedeVerAgenda(ctx) || !idValido(citaId)) return [];
  const cita = await prisma.fotofficeCita.findFirst({ where: { id: citaId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!cita) return [];
  const filas = await prisma.fotofficeCitaParticipante.findMany({
    where: { citaId },
    select: { id: true, userId: true, clientId: true, roleId: true, note: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const roleIds = [...new Set(filas.map((f) => f.roleId as string | null).filter((x): x is string => x !== null))];
  const roles = roleIds.length
    ? await prisma.fotofficeProyectoRol.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: roleIds } }, select: { id: true, name: true } })
    : [];
  const nombre = new Map(roles.map((r) => [r.id as string, r.name as string]));
  return filas.map((f) => ({
    id: f.id as string,
    userId: (f.userId as number | null) ?? null,
    clientId: (f.clientId as string | null) ?? null,
    roleId: (f.roleId as string | null) ?? null,
    roleName: f.roleId ? (nombre.get(f.roleId as string) ?? null) : null,
    note: (f.note as string | null) ?? null,
  }));
}

export async function agregarParticipante(ctx: CtxAgenda, citaId: unknown, datos: DatosParticipante): Promise<ResultadoParticipante> {
  if (!puedeGestionarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!idValido(citaId)) return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const p = limpiarParticipante(datos);
  if (!p.ok) return p;
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoParticipante> => {
      const cita = await tx.fotofficeCita.findFirst({ where: { id: citaId, workspaceId }, select: { id: true } });
      if (!cita) return { ok: false, error: MENSAJES_AGENDA.noExiste };
      const error = await validarParticipante(tx, workspaceId, p.valor);
      if (error) return { ok: false, error };
      const repetido = await tx.fotofficeCitaParticipante.findFirst({
        where: { citaId, userId: p.valor.userId, clientId: p.valor.clientId, roleId: p.valor.roleId },
        select: { id: true },
      });
      if (repetido) return { ok: false, error: MENSAJES_AGENDA.participanteRepetido };
      const fila = await tx.fotofficeCitaParticipante.create({ data: { citaId, ...p.valor }, select: { id: true } });
      return { ok: true, id: fila.id as string };
    });
  } catch {
    return { ok: false, error: MENSAJES_AGENDA.guardar };
  }
}

/** Cambia el rol y/o la nota de un participante (`undefined` = no se toca; `null` = se borra). */
export async function editarParticipante(
  ctx: CtxAgenda,
  participanteId: unknown,
  datos: { roleId?: unknown; note?: unknown },
): Promise<ResultadoSimple> {
  if (!puedeGestionarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!idValido(participanteId) || !datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const cambios: { roleId?: string | null; note?: string | null } = {};
  if (datos.roleId !== undefined) {
    if (datos.roleId !== null && !idValido(datos.roleId)) return { ok: false, error: MENSAJES_AGENDA.rol };
    cambios.roleId = datos.roleId;
  }
  if (datos.note !== undefined) {
    const n = leerNota(datos.note);
    if (!n.ok) return { ok: false, error: MENSAJES_AGENDA.nota };
    cambios.note = n.valor;
  }
  if (Object.keys(cambios).length === 0) return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const { workspaceId } = ctx;
  try {
    const f = await prisma.fotofficeCitaParticipante.findFirst({ where: { id: participanteId }, select: { id: true, citaId: true } });
    if (!f) return { ok: false, error: MENSAJES_AGENDA.participanteNoExiste };
    const cita = await prisma.fotofficeCita.findFirst({ where: { id: f.citaId as string, workspaceId }, select: { id: true } });
    if (!cita) return { ok: false, error: MENSAJES_AGENDA.participanteNoExiste };
    if (cambios.roleId) {
      const r = await prisma.fotofficeProyectoRol.findFirst({ where: { id: cambios.roleId, workspaceId, isActive: true }, select: { id: true } });
      if (!r) return { ok: false, error: MENSAJES_AGENDA.rol };
    }
    await prisma.fotofficeCitaParticipante.updateMany({ where: { id: f.id as string, citaId: f.citaId as string }, data: cambios });
    return { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_AGENDA.guardar };
  }
}

export async function quitarParticipante(ctx: CtxAgenda, participanteId: unknown): Promise<ResultadoSimple> {
  if (!puedeGestionarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!idValido(participanteId)) return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  try {
    const f = await prisma.fotofficeCitaParticipante.findFirst({ where: { id: participanteId }, select: { id: true, citaId: true } });
    if (!f) return { ok: false, error: MENSAJES_AGENDA.participanteNoExiste };
    const cita = await prisma.fotofficeCita.findFirst({ where: { id: f.citaId as string, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!cita) return { ok: false, error: MENSAJES_AGENDA.participanteNoExiste };
    const r = await prisma.fotofficeCitaParticipante.deleteMany({ where: { id: f.id as string, citaId: f.citaId as string } });
    return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_AGENDA.participanteNoExiste };
  } catch {
    return { ok: false, error: MENSAJES_AGENDA.guardar };
  }
}
