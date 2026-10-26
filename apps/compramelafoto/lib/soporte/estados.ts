/**
 * Reglas puras del centro de reclamos: reloj de 24 h corridas y cambios de columna por evento.
 * No toca la base: `aplicarEvento` (aplicar-evento.ts) guarda lo que devuelve `transicion`.
 */

export const SLA_MS = 86_400_000;
export const AMARILLO_MS = 21_600_000;
export const AUTO_RESOLVER_MS = 259_200_000;

export type EstadoTicket = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";

export type Reloj = { color: "verde" | "amarillo" | "rojo"; venceEn: Date };

export function estadoReloj(
  t: { status: EstadoTicket; slaDesde: Date | null; createdAt: Date },
  now: Date,
): Reloj | null {
  if (t.status !== "OPEN" && t.status !== "IN_PROGRESS") return null;
  const venceEn = new Date((t.slaDesde ?? t.createdAt).getTime() + SLA_MS);
  const falta = venceEn.getTime() - now.getTime();
  const color = falta < 0 ? "rojo" : falta <= AMARILLO_MS ? "amarillo" : "verde";
  return { color, venceEn };
}

export type EventoTicket =
  | { tipo: "ADMIN_RESPONDIO" }
  | { tipo: "ADMIN_MOVIO"; a: EstadoTicket }
  | { tipo: "CLIENTE_ESCRIBIO_PANEL" }
  | { tipo: "CLIENTE_ESCRIBIO_BOT" }
  | { tipo: "BOT_PASO_AL_EQUIPO"; motivo: string }
  | { tipo: "CLIENTE_CONFIRMO_RESUELTO" }
  | { tipo: "SIN_RESPUESTA_3_DIAS" };

export type CambioTicket = {
  status?: EstadoTicket;
  slaDesde?: Date;
  esperandoDesde?: Date | null;
  clienteRespondioAt?: Date | null;
  clienteEscribioAt?: Date;
  resolvedAt?: Date | null;
  cerradoPor?: "ADMIN" | "CLIENTE_BOT" | "AUTOMATICO" | null;
  /** Texto para Telegram; no se guarda en el ticket. */
  aviso?: string;
};

const CERRADO = { rechazado: "El caso está cerrado." };

function reabrir(t: { status: EstadoTicket }, now: Date): CambioTicket {
  // Un caso Nuevo se queda en Nuevo; el resto vuelve a En curso con el reloj de nuevo.
  const base: CambioTicket = { slaDesde: now, esperandoDesde: null, resolvedAt: null };
  return t.status === "OPEN" ? base : { status: "IN_PROGRESS", ...base, cerradoPor: null };
}

export function transicion(
  t: { id: number; status: EstadoTicket },
  e: EventoTicket,
  now: Date,
): CambioTicket | { rechazado: string } {
  switch (e.tipo) {
    case "ADMIN_RESPONDIO":
      return { status: "WAITING_CUSTOMER", esperandoDesde: now };

    case "ADMIN_MOVIO": {
      if (e.a === "WAITING_CUSTOMER") return { status: e.a, esperandoDesde: now };
      if (e.a === "RESOLVED" || e.a === "CLOSED") {
        return { status: e.a, resolvedAt: now, cerradoPor: "ADMIN", esperandoDesde: null };
      }
      const veniaCerrado = t.status === "RESOLVED" || t.status === "CLOSED";
      return veniaCerrado
        ? { status: e.a, resolvedAt: null, cerradoPor: null, esperandoDesde: null }
        : { status: e.a, esperandoDesde: null };
    }

    case "CLIENTE_ESCRIBIO_PANEL":
      if (t.status === "CLOSED") return CERRADO;
      return {
        ...reabrir(t, now),
        clienteRespondioAt: now,
        aviso: `💬 CLF · Ticket #${t.id}: el cliente respondió desde su panel.`,
      };

    case "CLIENTE_ESCRIBIO_BOT":
      if (t.status === "CLOSED") return CERRADO;
      if (t.status === "RESOLVED") return { ...reabrir(t, now), clienteEscribioAt: now };
      return { clienteEscribioAt: now };

    case "BOT_PASO_AL_EQUIPO":
      if (t.status === "CLOSED") return CERRADO;
      return {
        ...reabrir(t, now),
        clienteRespondioAt: now,
        aviso: `💬 CLF · Ticket #${t.id}: el DNX Bot pasó el caso al equipo.\n${e.motivo}`,
      };

    case "CLIENTE_CONFIRMO_RESUELTO":
      if (t.status === "CLOSED") return CERRADO;
      return { status: "RESOLVED", resolvedAt: now, cerradoPor: "CLIENTE_BOT", esperandoDesde: null };

    case "SIN_RESPUESTA_3_DIAS":
      if (t.status !== "WAITING_CUSTOMER") return { rechazado: "El caso no está esperando al cliente." };
      return { status: "RESOLVED", resolvedAt: now, cerradoPor: "AUTOMATICO", esperandoDesde: null };
  }
}
