import { isTrackingLinkUsable } from "./tracking-token";

/**
 * Qué ve quien abre el enlace de seguimiento.
 *
 * Un enlace vencido o revocado devuelve exactamente lo mismo que uno inexistente en la
 * pantalla: "no encontramos este pedido". La diferencia se mantiene acá para poder explicarle
 * a quien pregunte por teléfono que el enlace caducó, sin que la pantalla le confirme a nadie
 * que ese token alguna vez existió.
 */
export type TrackingView =
  | { kind: "NO_EXISTE" }
  | { kind: "VENCIDO" }
  | { kind: "OK"; puedeResponder: boolean };

export function resolveTrackingView(
  row: { status: string; tokenExpiresAt: Date; tokenRevokedAt: Date | null } | null,
  now: Date,
): TrackingView {
  if (!row) return { kind: "NO_EXISTE" };
  // Vencido y revocado comparten el mismo camino que "no existe" para el resto de la
  // pantalla: `isTrackingLinkUsable` es la misma regla que ya usa el resto del módulo, y
  // duplicarla acá con otra redacción es la clase de divergencia que un día deja de decir
  // lo mismo.
  if (!isTrackingLinkUsable(row, now)) return { kind: "VENCIDO" };
  // Responder solo cuando de verdad se pidió algo: ofrecer un cuadro de texto en cualquier
  // otro estado genera mensajes que nadie está esperando y que no disparan ningún aviso.
  return { kind: "OK", puedeResponder: row.status === "REQUIERE_INFO" };
}
