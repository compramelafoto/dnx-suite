import { TICKET_MARGEN_MS } from "./constants";
import type { RespuestaLogin, Ticket } from "./wsaa";

/**
 * El ticket de doce horas (§11.4b). Vercel no comparte memoria entre invocaciones, así que vive
 * en la base, y se pide uno nuevo sólo cuando falta o está por vencer: ARCA rechaza un pedido
 * nuevo mientras el anterior siga vigente. Módulo PURO, con la base y el pedido inyectados.
 */

export type DepositoTicket = {
  leer(): Promise<Ticket | null>;
  guardar(t: Ticket): Promise<void>;
};

export type ResultadoTicket = { ok: true; ticket: Ticket; nuevo: boolean } | { ok: false; mensaje: string };

export async function obtenerTicket(args: { deposito: DepositoTicket; pedir: () => Promise<RespuestaLogin>; ahora: Date }): Promise<ResultadoTicket> {
  const { deposito, pedir, ahora } = args;
  const guardado = await deposito.leer();
  if (guardado && guardado.expirationTime.getTime() - ahora.getTime() > TICKET_MARGEN_MS) {
    return { ok: true, ticket: guardado, nuevo: false };
  }
  const r = await pedir();
  if (r.ok) {
    await deposito.guardar(r.ticket);
    return { ok: true, ticket: r.ticket, nuevo: true };
  }
  if (r.motivo === "YA_AUTENTICADO") {
    // Lo pidió otra invocación al mismo tiempo, o el guardado está por vencer pero sigue vivo.
    const otra = await deposito.leer();
    if (otra && otra.expirationTime.getTime() - ahora.getTime() > 30_000) return { ok: true, ticket: otra, nuevo: false };
    return {
      ok: false,
      mensaje:
        "ARCA tiene un permiso de acceso vigente que FOTOFFICE no llegó a guardar, y no entrega otro hasta que venza (hasta 12 horas). Probá de nuevo más tarde.",
    };
  }
  return { ok: false, mensaje: `ARCA no dio acceso: ${r.mensaje}` };
}
