import "server-only";
import { prisma } from "@repo/db";
import { cuerpoDeCita, decideEntrega, decideLocal, idEventoCita, type CuerpoEventoGoogle } from "../sync-decisiones";
import { codigoDeError, esConflicto, esInexistente, type ClienteAgenda, type EventoEscrito } from "./cliente";
import { contextoGoogle, type ContextoGoogle } from "./contexto-google";

/**
 * EMPUJE a Google Calendar (Etapa 4, Entrega B): de la Agenda hacia el calendario propio de la organización.
 *
 * - Citas: insert, patch o delete del evento según `decideLocal`. El evento nuevo lleva un id
 *   determinístico (`idEventoCita`): dos empujes a la vez no lo duplican (el segundo da 409 y pasa a patch,
 *   que además lo REVIVE con `status: "confirmed"` si estaba borrado).
 * - Entregas de proyectos: eventos de todo el día «Entrega: …» con id determinístico; sólo ida.
 * - Nunca lanza ni frena la acción que lo disparó (se llama con `after()`): ante un fallo se registra un
 *   CÓDIGO (sin títulos, nombres ni cuentas) y lo pendiente lo recoge la corrida del cron.
 * - Nunca toca los calendarios de los espacios de Reservas.
 */

export type ResultadoEmpuje = "insertada" | "actualizada" | "borrada" | "nada" | "error";

const SELECT_CITA = {
  id: true, status: true, title: true, startAt: true, endAt: true, allDay: true, location: true, notes: true,
  googleEventId: true, googleUpdatedAt: true,
} as const;

/** Insert con id determinístico; si el id ya existe (o existió) es 409 y se parchea para dejarlo confirmado. */
async function insertarOParchear(cliente: ClienteAgenda, calendarId: string, eventId: string, cuerpoInsert: CuerpoEventoGoogle, cuerpoPatch: CuerpoEventoGoogle): Promise<EventoEscrito> {
  try {
    return await cliente.insertarEvento(calendarId, cuerpoInsert, eventId);
  } catch (error) {
    if (!esConflicto(error)) throw error;
    return cliente.parchearEvento(calendarId, eventId, cuerpoPatch);
  }
}

async function empujarUna(workspaceId: string, g: ContextoGoogle, citaId: string): Promise<ResultadoEmpuje> {
  const cita = await prisma.fotofficeCita.findFirst({ where: { id: citaId, workspaceId }, select: SELECT_CITA });
  if (!cita) return "nada";
  const decision = decideLocal(cita, cita.status === "ANULADA" ? "anular" : "editar");
  if (decision.accion === "nada") return "nada";
  if (decision.accion === "delete") {
    await g.cliente.borrarEvento(g.calendarId, decision.googleEventId);
    // Se conserva el googleEventId: si la cita se reactiva, el patch revive este mismo evento.
    return "borrada";
  }

  const cuerpoInsert = cuerpoDeCita(cita);
  const cuerpoPatch = cuerpoDeCita(cita, { vaciarCamposVacios: true });
  let escrito: EventoEscrito;
  let resultado: ResultadoEmpuje;
  if (decision.accion === "insert") {
    escrito = await insertarOParchear(g.cliente, g.calendarId, idEventoCita(cita.id), cuerpoInsert, cuerpoPatch);
    resultado = "insertada";
  } else {
    try {
      escrito = await g.cliente.parchearEvento(g.calendarId, decision.googleEventId, decision.cuerpo);
      resultado = "actualizada";
    } catch (error) {
      // El evento ya no existe en Google (se borró del todo): se vuelve a crear.
      if (!esInexistente(error)) throw error;
      escrito = await insertarOParchear(g.cliente, g.calendarId, idEventoCita(cita.id), cuerpoInsert, cuerpoPatch);
      resultado = "insertada";
    }
  }
  await prisma.fotofficeCita.updateMany({
    where: { id: cita.id, workspaceId },
    data: { googleEventId: escrito.id, googleEtag: escrito.etag, googleUpdatedAt: escrito.updated ? new Date(escrito.updated) : null },
  });
  return resultado;
}

/** Empuja un grupo de citas con UNA sola obtención del permiso de Google. Nunca lanza. */
export async function empujarCitas(workspaceId: string, citaIds: readonly string[]): Promise<void> {
  if (citaIds.length === 0) return;
  try {
    const c = await contextoGoogle(workspaceId);
    if (!c.ok) return; // módulo apagado, sin calendario o sin cuenta: nada que empujar.
    for (const id of citaIds) {
      try {
        await empujarUna(workspaceId, c.google, id);
      } catch (error) {
        console.error("[agenda][google] no se pudo empujar una cita", { codigo: codigoDeError(error) });
      }
    }
  } catch (error) {
    console.error("[agenda][google] falló el empuje de citas", { codigo: codigoDeError(error) });
  }
}

/** Enganche de las acciones de citas: se llama DESPUÉS de confirmar, con `after()`. */
export async function alCambiarCita(workspaceId: string, citaId: string): Promise<void> {
  await empujarCitas(workspaceId, [citaId]);
}

// ---- Entregas de proyectos ---------------------------------------------------------------------

async function ejecutarEntrega(g: ContextoGoogle, decision: ReturnType<typeof decideEntrega>): Promise<ResultadoEmpuje> {
  if (decision.accion === "nada") return "nada";
  if (decision.accion === "delete") {
    await g.cliente.borrarEvento(g.calendarId, decision.eventId);
    return "borrada";
  }
  // insert con id determinístico; si ya existe (o existió) → patch, que con `status: "confirmed"` lo revive.
  await insertarOParchear(g.cliente, g.calendarId, decision.eventId, decision.cuerpo, decision.cuerpo);
  return "insertada";
}

async function entregaDe(workspaceId: string, proyectoId: string) {
  const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId }, select: { id: true, name: true, finalDueDate: true, suspendedAt: true } });
  if (!p) return decideEntrega({ id: proyectoId, name: "", finalDueDate: null, suspendedAt: null, abierto: false });
  const abierto = await prisma.fotofficeJourney.findFirst({
    where: { workspaceId, subjectType: "PROYECTO", subjectId: p.id, closedAt: null },
    select: { id: true },
  });
  return decideEntrega({ id: p.id, name: p.name, finalDueDate: p.finalDueDate, suspendedAt: p.suspendedAt, abierto: abierto !== null });
}

/**
 * Enganche de proyectos (alta, edición de la fecha final, cierre, suspensión y reanudación): deja el
 * evento de entrega como corresponde. Nunca lanza.
 */
export async function alCambiarProyectos(workspaceId: string, proyectoIds: readonly string[]): Promise<void> {
  if (proyectoIds.length === 0) return;
  try {
    const c = await contextoGoogle(workspaceId);
    if (!c.ok) return;
    for (const id of proyectoIds) {
      try {
        await ejecutarEntrega(c.google, await entregaDe(workspaceId, id));
      } catch (error) {
        console.error("[agenda][google] no se pudo empujar una entrega", { codigo: codigoDeError(error) });
      }
    }
  } catch (error) {
    console.error("[agenda][google] falló el empuje de entregas", { codigo: codigoDeError(error) });
  }
}

export async function alCambiarProyecto(workspaceId: string, proyectoId: string): Promise<void> {
  await alCambiarProyectos(workspaceId, [proyectoId]);
}

/** Los proyectos que acaba de crear un pedido, para empujar sus entregas. */
export async function empujarEntregasDelPedido(workspaceId: string, pedidoId: string): Promise<void> {
  try {
    const filas = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, pedidoId }, select: { id: true }, take: 100 });
    await alCambiarProyectos(workspaceId, filas.map((f) => f.id as string));
  } catch (error) {
    console.error("[agenda][google] falló el empuje de entregas del pedido", { codigo: codigoDeError(error) });
  }
}

// ---- Corrida del cron: lo que quedó pendiente --------------------------------------------------

export type ReporteEmpuje = { citasEmpujadas: number; entregasEscritas: number; entregasBorradas: number; errores: string[] };

const TOPE_POR_CORRIDA = 50;
const TOPE_PAGINAS = 10;
const DIA_MS = 86_400_000;

/** Citas que nunca llegaron a Google (alta con Google caído, o hechas antes de crear el calendario). */
export async function empujarCitasPendientes(workspaceId: string, g: ContextoGoogle, ahora: Date, tope = TOPE_POR_CORRIDA): Promise<{ empujadas: number; errores: string[] }> {
  const pendientes = await prisma.fotofficeCita.findMany({
    where: { workspaceId, googleEventId: null, status: { not: "ANULADA" }, startAt: { gte: new Date(ahora.getTime() - 30 * DIA_MS) } },
    select: { id: true },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    take: tope,
  });
  let empujadas = 0;
  const errores: string[] = [];
  for (const c of pendientes) {
    try {
      const r = await empujarUna(workspaceId, g, c.id as string);
      if (r !== "nada") empujadas += 1;
    } catch (error) {
      errores.push(codigoDeError(error));
    }
  }
  return { empujadas, errores };
}

/**
 * Deja el calendario con EXACTAMENTE las entregas que corresponden: pide a Google los eventos marcados
 * `foKind=entrega`, los compara con los proyectos abiertos y no suspendidos con fecha final, y escribe sólo
 * la diferencia (alta, cambio de título o de día, baja). Idempotente y acotado por corrida.
 */
export async function reconciliarEntregas(workspaceId: string, g: ContextoGoogle, tope = TOPE_POR_CORRIDA): Promise<{ escritas: number; borradas: number; errores: string[] }> {
  const errores: string[] = [];
  const proyectos = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId, suspendedAt: null, finalDueDate: { not: null } },
    select: { id: true, name: true, finalDueDate: true, suspendedAt: true },
    orderBy: [{ finalDueDate: "asc" }, { id: "asc" }],
    take: 1000,
  });
  const abiertos = proyectos.length
    ? await prisma.fotofficeJourney.findMany({
        where: { workspaceId, subjectType: "PROYECTO", closedAt: null, subjectId: { in: proyectos.map((p) => p.id as string) } },
        select: { subjectId: true },
      })
    : [];
  const vivos = new Set(abiertos.map((a) => a.subjectId as string));

  const deseadas = new Map<string, ReturnType<typeof decideEntrega>>();
  for (const p of proyectos) {
    if (!vivos.has(p.id as string)) continue;
    const d = decideEntrega({ id: p.id as string, name: p.name as string, finalDueDate: p.finalDueDate as Date, suspendedAt: null, abierto: true });
    if (d.accion === "upsert") deseadas.set(d.eventId, d);
  }

  // Lo que hay en Google (sólo vigentes, sólo entregas).
  const existentes = new Map<string, { summary: string; dia: string }>();
  let pageToken: string | null = null;
  for (let vuelta = 0; vuelta < TOPE_PAGINAS; vuelta += 1) {
    const pagina: Awaited<ReturnType<ClienteAgenda["listarEventos"]>> = await g.cliente.listarEventos({
      calendarId: g.calendarId, propiedadPrivada: "foKind=entrega", conBorrados: false, pageToken,
    });
    for (const e of pagina.events) {
      if (e.status === "cancelled") continue;
      existentes.set(e.id, { summary: e.summary ?? "", dia: e.start?.date ?? "" });
    }
    if (!pagina.nextPageToken) break;
    pageToken = pagina.nextPageToken;
  }

  let escritas = 0;
  let borradas = 0;
  for (const [eventId, d] of deseadas) {
    if (escritas + borradas >= tope) break;
    if (d.accion !== "upsert") continue;
    const ya = existentes.get(eventId);
    const dia = "date" in d.cuerpo.start ? d.cuerpo.start.date : "";
    if (ya && ya.summary === d.cuerpo.summary && ya.dia === dia) continue;
    try {
      await ejecutarEntrega(g, d);
      escritas += 1;
    } catch (error) {
      errores.push(codigoDeError(error));
    }
  }
  for (const eventId of existentes.keys()) {
    if (escritas + borradas >= tope) break;
    if (deseadas.has(eventId)) continue;
    try {
      await g.cliente.borrarEvento(g.calendarId, eventId);
      borradas += 1;
    } catch (error) {
      errores.push(codigoDeError(error));
    }
  }
  return { escritas, borradas, errores };
}

