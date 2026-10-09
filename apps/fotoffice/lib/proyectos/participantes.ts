import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, puedeVerProyectos, type CtxProyectos } from "./acceso";

/**
 * Equipo de un proyecto (Etapa 4, Entrega A): cada participante es un usuario del equipo o un
 * contacto del workspace (exactamente uno), con un rol del workspace y una nota opcionales.
 * Los roles (Fotógrafo Principal, Salón, DJ…) son por workspace; DNX los trae de `semillas.ts`.
 */

export const NOTA_PARTICIPANTE_MAXIMA = 500;
export const NOMBRE_ROL_MAXIMO = 80;

export type RolVisible = { id: string; name: string; isActive: boolean };
export type ParticipanteVisible = {
  id: string;
  userId: number | null;
  clientId: string | null;
  roleId: string | null;
  roleName: string | null;
  note: string | null;
};

export type ResultadoParticipante = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}
function usuarioValido(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}

/** Roles del workspace (por defecto sólo los activos), en orden. */
export async function listarRoles(ctx: CtxProyectos, opciones: { conBajas?: boolean } = {}): Promise<RolVisible[]> {
  if (!puedeVerProyectos(ctx)) return [];
  const filas = await prisma.fotofficeProyectoRol.findMany({
    where: { workspaceId: ctx.workspaceId, ...(opciones.conBajas ? {} : { isActive: true }) },
    select: { id: true, name: true, isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return filas as RolVisible[];
}

/** Alta de un rol. Sólo quien puede configurar el workspace. El nombre no se repite (sin mayúsculas). */
export async function crearRol(ctx: CtxProyectos, nombre: unknown): Promise<ResultadoParticipante> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  const n = typeof nombre === "string" ? nombre.trim().replace(/\s+/g, " ") : "";
  if (n.length < 1 || n.length > NOMBRE_ROL_MAXIMO) return { ok: false, error: MENSAJES_PROYECTO.rolNombre };
  try {
    const existentes = await prisma.fotofficeProyectoRol.findMany({ where: { workspaceId: ctx.workspaceId }, select: { name: true, order: true } });
    const clave = (s: string) => s.trim().toLocaleLowerCase("es-AR");
    if (existentes.some((r) => clave(r.name as string) === clave(n))) return { ok: false, error: MENSAJES_PROYECTO.rolRepetido };
    const orden = existentes.reduce((m, r) => Math.max(m, r.order as number), -1) + 1;
    const fila = await prisma.fotofficeProyectoRol.create({ data: { workspaceId: ctx.workspaceId, name: n, order: orden }, select: { id: true } });
    return { ok: true, id: fila.id as string };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") return { ok: false, error: MENSAJES_PROYECTO.rolRepetido };
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}

/** Los participantes de un proyecto del workspace, en el orden en que se sumaron. */
export async function listarParticipantes(ctx: CtxProyectos, proyectoId: string): Promise<ParticipanteVisible[]> {
  if (!puedeVerProyectos(ctx) || !idValido(proyectoId)) return [];
  const filas = await prisma.fotofficeProyectoParticipante.findMany({
    where: { workspaceId: ctx.workspaceId, proyectoId },
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

export type DatosParticipante = { userId?: unknown; clientId?: unknown; roleId?: unknown; note?: unknown };

function leerNota(v: unknown): { ok: true; valor: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, valor: null };
  if (typeof v !== "string") return { ok: false };
  const n = v.trim();
  if (n.length > NOTA_PARTICIPANTE_MAXIMA) return { ok: false };
  return { ok: true, valor: n === "" ? null : n };
}

/** Suma un participante: usuario del equipo O contacto, con rol (activo, del workspace) y nota opcionales. */
export async function agregarParticipante(ctx: CtxProyectos, proyectoId: unknown, datos: DatosParticipante): Promise<ResultadoParticipante> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const tieneUsuario = datos.userId !== undefined && datos.userId !== null;
  const tieneContacto = datos.clientId !== undefined && datos.clientId !== null;
  if (tieneUsuario === tieneContacto) return { ok: false, error: MENSAJES_PROYECTO.participante };
  if (tieneUsuario && !usuarioValido(datos.userId)) return { ok: false, error: MENSAJES_PROYECTO.integrante };
  if (tieneContacto && !idValido(datos.clientId)) return { ok: false, error: MENSAJES_PROYECTO.contacto };
  const rolPedido = datos.roleId === undefined || datos.roleId === null || datos.roleId === "" ? null : datos.roleId;
  if (rolPedido !== null && !idValido(rolPedido)) return { ok: false, error: MENSAJES_PROYECTO.rol };
  const nota = leerNota(datos.note);
  if (!nota.ok) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const { workspaceId } = ctx;
  const userId = tieneUsuario ? (datos.userId as number) : null;
  const clientId = tieneContacto ? (datos.clientId as string) : null;

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoParticipante> => {
      const p = await tx.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId }, select: { id: true } });
      if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
      if (userId !== null) {
        const m = await tx.workspaceMembership.findFirst({ where: { userId, workspaceId }, select: { id: true } });
        if (!m) return { ok: false, error: MENSAJES_PROYECTO.integrante };
      }
      if (clientId !== null) {
        const c = await tx.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true } });
        if (!c) return { ok: false, error: MENSAJES_PROYECTO.contacto };
      }
      if (rolPedido !== null) {
        const r = await tx.fotofficeProyectoRol.findFirst({ where: { id: rolPedido, workspaceId, isActive: true }, select: { id: true } });
        if (!r) return { ok: false, error: MENSAJES_PROYECTO.rol };
      }
      const repetido = await tx.fotofficeProyectoParticipante.findFirst({
        where: { workspaceId, proyectoId: p.id, userId, clientId, roleId: rolPedido },
        select: { id: true },
      });
      if (repetido) return { ok: false, error: MENSAJES_PROYECTO.participanteRepetido };
      const fila = await tx.fotofficeProyectoParticipante.create({
        data: { workspaceId, proyectoId: p.id, userId, clientId, roleId: rolPedido, note: nota.valor },
        select: { id: true },
      });
      return { ok: true, id: fila.id as string };
    });
  } catch {
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}

/** Cambia el rol y/o la nota de un participante (`undefined` = no se toca; `null` = se borra). */
export async function editarParticipante(
  ctx: CtxProyectos,
  participanteId: unknown,
  datos: { roleId?: unknown; note?: unknown },
): Promise<ResultadoSimple> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(participanteId) || !datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const cambios: { roleId?: string | null; note?: string | null } = {};
  if (datos.roleId !== undefined) {
    if (datos.roleId !== null && !idValido(datos.roleId)) return { ok: false, error: MENSAJES_PROYECTO.rol };
    cambios.roleId = datos.roleId;
  }
  if (datos.note !== undefined) {
    const n = leerNota(datos.note);
    if (!n.ok) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
    cambios.note = n.valor;
  }
  if (Object.keys(cambios).length === 0) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const { workspaceId } = ctx;
  try {
    const f = await prisma.fotofficeProyectoParticipante.findFirst({ where: { id: participanteId, workspaceId }, select: { id: true } });
    if (!f) return { ok: false, error: MENSAJES_PROYECTO.participanteNoExiste };
    if (cambios.roleId) {
      const r = await prisma.fotofficeProyectoRol.findFirst({ where: { id: cambios.roleId, workspaceId, isActive: true }, select: { id: true } });
      if (!r) return { ok: false, error: MENSAJES_PROYECTO.rol };
    }
    await prisma.fotofficeProyectoParticipante.updateMany({ where: { id: f.id as string, workspaceId }, data: cambios });
    return { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}

export async function quitarParticipante(ctx: CtxProyectos, participanteId: unknown): Promise<ResultadoSimple> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(participanteId)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  try {
    const r = await prisma.fotofficeProyectoParticipante.deleteMany({ where: { id: participanteId, workspaceId: ctx.workspaceId } });
    return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_PROYECTO.participanteNoExiste };
  } catch {
    return { ok: false, error: MENSAJES_PROYECTO.guardar };
  }
}
