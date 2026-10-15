import { COVERAGE_LIVE_STATUSES, coverageStatusLabel } from "./states";

/**
 * Lo que hay que saber antes de cerrar un pedido aprobado.
 *
 * Cerrar es terminal: `CERRADA` no tiene salida (ver `transitions.ts`). Y cerrar el pedido **no
 * toca las coberturas que nacieron de él**: si alguna todavía está buscando equipo o ya lo tiene
 * confirmado, sigue ahí, con sus voluntarios anotados y su fecha por delante.
 *
 * Es un **aviso y no un freno**, a propósito. Frenar el cierre mientras haya una cobertura viva
 * volvería a armar el callejón que este trabajo vino a deshacer: hoy el panel tampoco ofrece
 * cancelar una cobertura, así que quien quisiera cerrar el pedido se quedaría sin ningún camino
 * hacia adelante, igual que antes. Mejor decirle la verdad y dejarlo decidir.
 *
 * Devuelve `null` cuando no hay nada que avisar: sin coberturas, o con todas ya terminadas.
 */
export function avisoAlCerrarSolicitud(
  coberturas: readonly { status: string }[],
): string | null {
  const vivas = coberturas.filter((c) =>
    (COVERAGE_LIVE_STATUSES as readonly string[]).includes(c.status),
  );
  if (vivas.length === 0) return null;

  if (vivas.length === 1) {
    return `Este pedido todavía tiene una cobertura en «${coverageStatusLabel(vivas[0]!.status)}». Cerrar el pedido no la cierra ni le avisa a nadie del equipo.`;
  }
  return `Este pedido todavía tiene ${vivas.length} coberturas sin terminar. Cerrar el pedido no las cierra ni le avisa a nadie del equipo.`;
}
