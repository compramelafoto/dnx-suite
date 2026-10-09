/**
 * Decisiones de la sincronización con Google Calendar (Etapa 4, Entrega B). Módulo PURO: no habla con
 * Google ni con la base; sólo decide qué hacer.
 *
 * - TRAÍDA (`decideRemote`): por cada evento que informa Google (`events.list` con `syncToken`) y la cita
 *   local que tiene ese `googleEventId` (o null): crear, actualizar, anular o ignorar. Gana el último que
 *   escribió: el evento de Google pisa a la cita sólo si su `updated` es POSTERIOR a `googleUpdatedAt` (el
 *   eco de lo que empujamos nosotros trae el mismo `updated` y se ignora). Los eventos marcados
 *   `extendedProperties.private.foKind = "entrega"` son las entregas de proyectos, de sólo ida: se ignoran.
 * - EMPUJE (`decideLocal`): según lo que le pasó a la cita local: insert, patch, delete o nada.
 */
import {
  CLAVE_TIPO_EVENTO_GOOGLE,
  HUSO_HORARIO,
  PREFIJO_ENTREGA,
  VALOR_EVENTO_ENTREGA,
  type EstadoCita,
} from "./constantes";
import { fechaValida, inicioDelDia, sumarDias } from "./fechas";

/** Lo que se lee de un evento de Google (subconjunto de `events.list`). */
export type EventoGoogle = {
  id: string;
  status: "confirmed" | "tentative" | "cancelled" | string;
  /** ISO 8601 de la última modificación. */
  updated: string;
  start?: { date?: string; dateTime?: string; timeZone?: string } | null;
  end?: { date?: string; dateTime?: string; timeZone?: string } | null;
  summary?: string | null;
  location?: string | null;
  description?: string | null;
  etag?: string | null;
  extendedProperties?: { private?: Record<string, string> | null; shared?: Record<string, string> | null } | null;
};

/** Lo que se necesita de la cita local. */
export type CitaLocal = {
  id: string;
  status: EstadoCita | string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  notes?: string | null;
  googleEventId: string | null;
  googleUpdatedAt: Date | null;
};

export type DatosDeCita = {
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  googleEventId: string;
  googleEtag: string | null;
  googleUpdatedAt: Date;
};

export type DecisionRemota =
  | { accion: "crear"; datos: DatosDeCita }
  | { accion: "actualizar"; datos: DatosDeCita }
  | { accion: "anular"; googleUpdatedAt: Date | null }
  | { accion: "ignorar"; motivo: string };

const TITULO_POR_OMISION = "(sin título)";

function instante(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function esEventoDeEntrega(e: Pick<EventoGoogle, "extendedProperties">): boolean {
  return e.extendedProperties?.private?.[CLAVE_TIPO_EVENTO_GOOGLE] === VALOR_EVENTO_ENTREGA;
}

/** Traduce el inicio/fin de un evento de Google a instantes; null si no se entiende. */
export function tiempoDeEventoGoogle(e: Pick<EventoGoogle, "start" | "end">): { startAt: Date; endAt: Date; allDay: boolean } | null {
  const sDia = fechaValida(e.start?.date ?? null);
  if (sDia !== null && !e.start?.dateTime) {
    const startAt = inicioDelDia(sDia);
    // `end.date` es exclusivo en Google; si falta o no es posterior, ocupa un día.
    const eDia = fechaValida(e.end?.date ?? null);
    const endAt = inicioDelDia(eDia !== null && eDia > sDia ? eDia : sumarDias(sDia, 1));
    return { startAt, endAt, allDay: true };
  }
  const startAt = instante(e.start?.dateTime);
  if (startAt === null) return null;
  let endAt = instante(e.end?.dateTime);
  if (endAt === null || endAt.getTime() <= startAt.getTime()) endAt = new Date(startAt.getTime() + 60 * 60_000);
  return { startAt, endAt, allDay: false };
}

function mismosDatos(c: CitaLocal, d: DatosDeCita): boolean {
  return (
    c.title === d.title &&
    c.startAt.getTime() === d.startAt.getTime() &&
    c.endAt.getTime() === d.endAt.getTime() &&
    c.allDay === d.allDay &&
    (c.location ?? null) === (d.location ?? null)
  );
}

export function decideRemote(evento: EventoGoogle, cita: CitaLocal | null): DecisionRemota {
  if (esEventoDeEntrega(evento)) return { accion: "ignorar", motivo: "entrega de proyecto (sólo ida)" };
  const actualizadoEn = instante(evento.updated);

  if (evento.status === "cancelled") {
    if (cita === null) return { accion: "ignorar", motivo: "evento borrado que no teníamos" };
    if (cita.status === "ANULADA") return { accion: "ignorar", motivo: "la cita ya está anulada" };
    return { accion: "anular", googleUpdatedAt: actualizadoEn };
  }

  const tiempo = tiempoDeEventoGoogle(evento);
  if (tiempo === null) return { accion: "ignorar", motivo: "evento sin fecha de inicio entendible" };
  if (actualizadoEn === null) return { accion: "ignorar", motivo: "evento sin fecha de modificación" };

  const datos: DatosDeCita = {
    title: evento.summary?.trim() ? evento.summary.trim() : TITULO_POR_OMISION,
    ...tiempo,
    location: evento.location?.trim() ? evento.location.trim() : null,
    googleEventId: evento.id,
    googleEtag: evento.etag ?? null,
    googleUpdatedAt: actualizadoEn,
  };

  if (cita === null) return { accion: "crear", datos };
  // Una cita anulada acá no se revive desde Google: el borrado del evento viaja en el próximo empuje.
  if (cita.status === "ANULADA") return { accion: "ignorar", motivo: "la cita local está anulada" };
  if (cita.googleUpdatedAt !== null && actualizadoEn.getTime() <= cita.googleUpdatedAt.getTime()) {
    return { accion: "ignorar", motivo: "lo local es igual o más nuevo" };
  }
  if (mismosDatos(cita, datos)) return { accion: "ignorar", motivo: "sin cambios de contenido" };
  return { accion: "actualizar", datos };
}

/** Qué le pasó a la cita local. */
export type CambioLocal = "crear" | "editar" | "mover" | "anular" | "borrar";

export type CuerpoEventoGoogle = {
  summary: string;
  location?: string;
  description?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
  extendedProperties: { private: Record<string, string> };
};

export type DecisionLocal =
  | { accion: "insert"; cuerpo: CuerpoEventoGoogle }
  | { accion: "patch"; googleEventId: string; cuerpo: CuerpoEventoGoogle }
  | { accion: "delete"; googleEventId: string }
  | { accion: "nada"; motivo: string };

/** "YYYY-MM-DD" de Argentina para un instante que cae a las 00:00 de Argentina. */
function diaDeMedianoche(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** El cuerpo del evento de Google de una cita. */
export function cuerpoDeCita(c: Pick<CitaLocal, "id" | "title" | "startAt" | "endAt" | "allDay" | "location" | "notes">): CuerpoEventoGoogle {
  const cuerpo: CuerpoEventoGoogle = {
    summary: c.title,
    start: c.allDay ? { date: diaDeMedianoche(c.startAt) } : { dateTime: c.startAt.toISOString(), timeZone: HUSO_HORARIO },
    end: c.allDay ? { date: diaDeMedianoche(c.endAt) } : { dateTime: c.endAt.toISOString(), timeZone: HUSO_HORARIO },
    extendedProperties: { private: { [CLAVE_TIPO_EVENTO_GOOGLE]: "cita", foCitaId: c.id } },
  };
  if (c.location?.trim()) cuerpo.location = c.location.trim();
  if (c.notes?.trim()) cuerpo.description = c.notes.trim();
  return cuerpo;
}

export function decideLocal(cita: CitaLocal, cambio: CambioLocal): DecisionLocal {
  const tieneEvento = cita.googleEventId !== null && cita.googleEventId !== "";
  const baja = cambio === "anular" || cambio === "borrar" || cita.status === "ANULADA";
  if (baja) {
    return tieneEvento
      ? { accion: "delete", googleEventId: cita.googleEventId as string }
      : { accion: "nada", motivo: "la cita no estaba en Google" };
  }
  if (!tieneEvento) return { accion: "insert", cuerpo: cuerpoDeCita(cita) };
  return { accion: "patch", googleEventId: cita.googleEventId as string, cuerpo: cuerpoDeCita(cita) };
}

// ---- Entregas de proyectos (sólo ida) ----------------------------------------------------------

/**
 * Id determinístico del evento de Google de la entrega de un proyecto (la base no guarda un id por
 * entrega). Google admite ids de 5 a 1024 caracteres con las letras a–v y los dígitos: se usa hexadecimal.
 */
export function idEventoEntrega(proyectoId: string): string {
  let hex = "";
  for (const b of new TextEncoder().encode(proyectoId)) hex += b.toString(16).padStart(2, "0");
  return `foentrega${hex}`;
}

export type ProyectoParaEntrega = {
  id: string;
  name: string;
  finalDueDate: string | Date | null;
  suspendedAt: Date | null;
  /** ¿Está abierto (no terminado ni cancelado)? */
  abierto: boolean;
};

export type DecisionEntrega =
  | { accion: "upsert"; eventId: string; cuerpo: CuerpoEventoGoogle }
  | { accion: "delete"; eventId: string }
  | { accion: "nada"; motivo: string };

/**
 * La entrega de un proyecto abierto y no suspendido, con fecha, es un evento de todo el día «Entrega: …».
 * Si deja de cumplirlo se borra el evento (`delete` de un evento que no existe lo resuelve quien ejecuta).
 */
export function decideEntrega(p: ProyectoParaEntrega): DecisionEntrega {
  const eventId = idEventoEntrega(p.id);
  const dia = fechaValida(p.finalDueDate);
  if (!p.abierto || p.suspendedAt !== null || dia === null) return { accion: "delete", eventId };
  return {
    accion: "upsert",
    eventId,
    cuerpo: {
      summary: `${PREFIJO_ENTREGA}${p.name}`,
      start: { date: dia },
      end: { date: sumarDias(dia, 1) },
      extendedProperties: { private: { [CLAVE_TIPO_EVENTO_GOOGLE]: VALOR_EVENTO_ENTREGA, foProyectoId: p.id } },
    },
  };
}
