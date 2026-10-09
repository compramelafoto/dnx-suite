import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { MENSAJES_AGENDA, puedeGestionarAgenda, type CtxAgenda } from "./acceso";
import { esEstadoCita } from "./constantes";
import { limpiarParticipante, validarParticipante, type DatosParticipante, type ParticipanteLimpio } from "./participantes";

/**
 * Crear, editar, mover, cambiar de estado y anular citas (Etapa 4, Entrega B). Todo exige "Gestionar"
 * en Agenda. Cada id que llega (tipo, responsable, contacto, proyecto, pedido, consulta, participantes)
 * se comprueba contra el workspace de la sesión dentro de la misma transacción: uno de otro workspace
 * es, para éste, algo que no existe. Las fechas son instantes (UTC); el fin tiene que ser posterior
 * al inicio. Una cita no se borra: se anula (`ANULADA`).
 *
 * El empuje a Google no está acá: las acciones llaman a `alCambiarCita` con `after()` cuando esto
 * devuelve `ok`.
 */

type Tx = Prisma.TransactionClient;

export const TITULO_CITA_MAXIMO = 200;
export const LUGAR_CITA_MAXIMO = 300;
export const NOTAS_CITA_MAXIMAS = 5000;
export const PARTICIPANTES_POR_CITA_MAXIMO = 50;

export type ResultadoCita = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };

export type DatosCita = {
  title?: unknown;
  typeId?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  allDay?: unknown;
  location?: unknown;
  notes?: unknown;
  ownerUserId?: unknown;
  clientId?: unknown;
  proyectoId?: unknown;
  pedidoId?: unknown;
  consultaLeadId?: unknown;
  status?: unknown;
  /** Sólo al crear. */
  participantes?: unknown;
};

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

/** `Date` o texto ISO → instante; null si no es una fecha. */
export function leerInstante(v: unknown): Date | null {
  const d = v instanceof Date ? v : typeof v === "string" && v.trim() !== "" ? new Date(v) : null;
  return d && Number.isFinite(d.getTime()) ? d : null;
}

function textoOpcional(v: unknown, max: number): { ok: true; valor: string | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, valor: null };
  if (typeof v !== "string") return { ok: false };
  const t = v.trim();
  if (t.length > max) return { ok: false };
  return { ok: true, valor: t === "" ? null : t };
}

function idOpcional(v: unknown): { ok: true; valor: string | null } | { ok: false } {
  if (v === null || v === undefined || v === "") return { ok: true, valor: null };
  return idValido(v) ? { ok: true, valor: v } : { ok: false };
}

type CamposCita = {
  title?: string;
  typeId?: string | null;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
  ownerUserId?: number | null;
  clientId?: string | null;
  proyectoId?: string | null;
  pedidoId?: string | null;
  consultaLeadId?: string | null;
  status?: string;
};

/**
 * Forma de los campos presentes (los `undefined` no se tocan), sin tocar la base. Con `completa` el
 * título y las fechas son obligatorios (alta).
 */
export function leerCampos(d: DatosCita, completa: boolean): { ok: true; valor: CamposCita } | { ok: false; error: string } {
  if (!d || typeof d !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const out: CamposCita = {};
  if (d.title !== undefined || completa) {
    const t = typeof d.title === "string" ? d.title.trim().replace(/\s+/g, " ") : "";
    if (t.length < 1 || t.length > TITULO_CITA_MAXIMO) return { ok: false, error: MENSAJES_AGENDA.titulo };
    out.title = t;
  }
  if (d.startAt !== undefined || completa) {
    const s = leerInstante(d.startAt);
    if (!s) return { ok: false, error: MENSAJES_AGENDA.fechas };
    out.startAt = s;
  }
  if (d.endAt !== undefined || completa) {
    const e = leerInstante(d.endAt);
    if (!e) return { ok: false, error: MENSAJES_AGENDA.fechas };
    out.endAt = e;
  }
  if (out.startAt && out.endAt && out.endAt.getTime() <= out.startAt.getTime()) return { ok: false, error: MENSAJES_AGENDA.finAnterior };
  if (d.allDay !== undefined) {
    if (typeof d.allDay !== "boolean") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
    out.allDay = d.allDay;
  }
  if (d.location !== undefined) {
    const l = textoOpcional(d.location, LUGAR_CITA_MAXIMO);
    if (!l.ok) return { ok: false, error: MENSAJES_AGENDA.lugar };
    out.location = l.valor;
  }
  if (d.notes !== undefined) {
    const n = textoOpcional(d.notes, NOTAS_CITA_MAXIMAS);
    if (!n.ok) return { ok: false, error: MENSAJES_AGENDA.notas };
    out.notes = n.valor;
  }
  if (d.ownerUserId !== undefined) {
    if (d.ownerUserId === null || d.ownerUserId === "") out.ownerUserId = null;
    else if (typeof d.ownerUserId === "number" && Number.isSafeInteger(d.ownerUserId) && d.ownerUserId > 0) out.ownerUserId = d.ownerUserId;
    else return { ok: false, error: MENSAJES_AGENDA.responsable };
  }
  for (const [campo, mensaje] of [
    ["typeId", MENSAJES_AGENDA.tipo],
    ["clientId", MENSAJES_AGENDA.contacto],
    ["proyectoId", MENSAJES_AGENDA.proyecto],
    ["pedidoId", MENSAJES_AGENDA.pedido],
    ["consultaLeadId", MENSAJES_AGENDA.consulta],
  ] as const) {
    if (d[campo] === undefined) continue;
    const v = idOpcional(d[campo]);
    if (!v.ok) return { ok: false, error: mensaje };
    out[campo] = v.valor;
  }
  if (d.status !== undefined) {
    if (!esEstadoCita(d.status)) return { ok: false, error: MENSAJES_AGENDA.estado };
    out.status = d.status;
  }
  return { ok: true, valor: out };
}

/** Los ids presentes tienen que ser del workspace (el tipo, además, activo). Lanza `Corte` si no. */
async function validarVinculos(tx: Tx, workspaceId: string, c: CamposCita, tipoSinCambio?: string | null): Promise<void> {
  if (c.typeId) {
    // Un tipo dado de baja se conserva en las citas que ya lo tenían, pero no se elige de nuevo.
    const t = await tx.fotofficeCitaTipo.findFirst({ where: { id: c.typeId, workspaceId, ...(c.typeId === tipoSinCambio ? {} : { isActive: true }) }, select: { id: true } });
    if (!t) throw new Corte(MENSAJES_AGENDA.tipo);
  }
  if (c.ownerUserId) {
    const m = await tx.workspaceMembership.findFirst({ where: { workspaceId, userId: c.ownerUserId }, select: { id: true } });
    if (!m) throw new Corte(MENSAJES_AGENDA.responsable);
  }
  if (c.clientId && !(await tx.client.findFirst({ where: { id: c.clientId, workspaceId }, select: { id: true } }))) throw new Corte(MENSAJES_AGENDA.contacto);
  if (c.proyectoId && !(await tx.fotofficeProyecto.findFirst({ where: { id: c.proyectoId, workspaceId }, select: { id: true } }))) throw new Corte(MENSAJES_AGENDA.proyecto);
  if (c.pedidoId && !(await tx.fotofficePedido.findFirst({ where: { id: c.pedidoId, workspaceId }, select: { id: true } }))) throw new Corte(MENSAJES_AGENDA.pedido);
  if (c.consultaLeadId && !(await tx.serviceSalesLead.findFirst({ where: { id: c.consultaLeadId, workspaceId }, select: { id: true } }))) throw new Corte(MENSAJES_AGENDA.consulta);
}

function fallo(donde: string, e: unknown): ResultadoCita {
  const codigo = (e as { code?: unknown } | null)?.code;
  console.error(`[agenda] ${donde} falló`, { codigo: typeof codigo === "string" ? codigo : null });
  return { ok: false, error: MENSAJES_AGENDA.guardar };
}

export async function crearCita(ctx: CtxAgenda, datos: DatosCita): Promise<ResultadoCita> {
  if (!puedeGestionarAgenda(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  const campos = leerCampos(datos, true);
  if (!campos.ok) return campos;
  const c = campos.valor;
  const participantes: ParticipanteLimpio[] = [];
  if (datos.participantes !== undefined && datos.participantes !== null) {
    if (!Array.isArray(datos.participantes) || datos.participantes.length > PARTICIPANTES_POR_CITA_MAXIMO) {
      return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
    }
    for (const p of datos.participantes as DatosParticipante[]) {
      const l = limpiarParticipante(p);
      if (!l.ok) return l;
      if (participantes.some((x) => x.userId === l.valor.userId && x.clientId === l.valor.clientId && x.roleId === l.valor.roleId)) {
        return { ok: false, error: MENSAJES_AGENDA.participanteRepetido };
      }
      participantes.push(l.valor);
    }
  }
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoCita> => {
      await validarVinculos(tx, workspaceId, c);
      for (const p of participantes) {
        const error = await validarParticipante(tx, workspaceId, p);
        if (error) throw new Corte(error);
      }
      const fila = await tx.fotofficeCita.create({
        data: {
          workspaceId,
          title: c.title as string,
          typeId: c.typeId ?? null,
          status: c.status ?? "AGENDADA",
          startAt: c.startAt as Date,
          endAt: c.endAt as Date,
          allDay: c.allDay ?? false,
          location: c.location ?? null,
          notes: c.notes ?? null,
          ownerUserId: c.ownerUserId ?? null,
          clientId: c.clientId ?? null,
          proyectoId: c.proyectoId ?? null,
          pedidoId: c.pedidoId ?? null,
          consultaLeadId: c.consultaLeadId ?? null,
          createdByUserId: ctx.userId,
        },
        select: { id: true },
      });
      if (participantes.length > 0) {
        await tx.fotofficeCitaParticipante.createMany({ data: participantes.map((p) => ({ citaId: fila.id as string, ...p })) });
      }
      return { ok: true, id: fila.id as string };
    });
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    return fallo("crearCita", e);
  }
}

/** Cambia los campos presentes de una cita (`undefined` = no se toca). Sin `participantes`: ver `participantes.ts`. */
export async function editarCita(ctx: CtxAgenda, citaId: unknown, datos: DatosCita): Promise<ResultadoCita> {
  if (!puedeGestionarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!idValido(citaId)) return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const campos = leerCampos(datos, false);
  if (!campos.ok) return campos;
  const c = campos.valor;
  if (Object.keys(c).length === 0) return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoCita> => {
      const actual = await tx.fotofficeCita.findFirst({ where: { id: citaId, workspaceId }, select: { id: true, typeId: true, startAt: true, endAt: true, allDay: true, status: true } });
      if (!actual) throw new Corte(MENSAJES_AGENDA.noExiste);
      // Una cita anulada o realizada no se mueve (ni se estira): primero se la reactiva. Editar otros
      // datos, o mandar las mismas fechas, sí se puede.
      if (
        (actual.status === "ANULADA" || actual.status === "REALIZADA") &&
        !(c.status === "AGENDADA" || c.status === "CONFIRMADA") &&
        ((c.startAt && c.startAt.getTime() !== (actual.startAt as Date).getTime()) ||
          (c.endAt && c.endAt.getTime() !== (actual.endAt as Date).getTime()) ||
          (c.allDay !== undefined && c.allDay !== actual.allDay))
      ) {
        throw new Corte(MENSAJES_AGENDA.citaCerrada);
      }
      // El fin siempre contra el inicio vigente, aunque sólo se haya mandado uno de los dos.
      const inicio = c.startAt ?? (actual.startAt as Date);
      const fin = c.endAt ?? (actual.endAt as Date);
      if (fin.getTime() <= inicio.getTime()) throw new Corte(MENSAJES_AGENDA.finAnterior);
      await validarVinculos(tx, workspaceId, c, (actual.typeId as string | null) ?? null);
      await tx.fotofficeCita.updateMany({ where: { id: citaId, workspaceId }, data: c });
      return { ok: true, id: citaId };
    });
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    return fallo("editarCita", e);
  }
}

/** Mueve la cita (arrastrar o cambiar la hora): sólo inicio, fin y, si se manda, "todo el día". */
export async function moverCita(
  ctx: CtxAgenda,
  citaId: unknown,
  datos: { startAt?: unknown; endAt?: unknown; allDay?: unknown },
): Promise<ResultadoCita> {
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  if (datos.startAt === undefined || datos.endAt === undefined) return { ok: false, error: MENSAJES_AGENDA.fechas };
  return editarCita(ctx, citaId, { startAt: datos.startAt, endAt: datos.endAt, ...(datos.allDay !== undefined ? { allDay: datos.allDay } : {}) });
}

export async function cambiarEstadoCita(ctx: CtxAgenda, citaId: unknown, estado: unknown): Promise<ResultadoCita> {
  if (!esEstadoCita(estado)) return { ok: false, error: MENSAJES_AGENDA.estado };
  return editarCita(ctx, citaId, { status: estado });
}

/** Anular = estado `ANULADA`; la cita queda en la base y en el historial. */
export async function anularCita(ctx: CtxAgenda, citaId: unknown): Promise<ResultadoCita> {
  return cambiarEstadoCita(ctx, citaId, "ANULADA");
}
