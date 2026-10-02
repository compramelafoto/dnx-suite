import { REQUEST_LIVE_STATUSES, isRequestStatus, requestStatusLabel } from "./states";
import { debeRotarEnlace } from "./tracking-view";

/**
 * Si se le puede emitir un enlace de seguimiento nuevo a la organización.
 *
 * Hace falta porque el token crudo vive un instante: se manda por correo y en la base queda
 * sólo su hash (ver `tracking-token.ts`). Si ese correo no llega, la organización se queda sin
 * enlace y **nadie lo puede recuperar** — el único camino es emitir otro.
 *
 * Es una regla y no un `if` adentro de la acción porque la contesta dos veces: la pantalla, para
 * no ofrecer un botón que va a rebotar, y el servidor, que es el que de verdad decide. Con la
 * regla escrita una sola vez, las dos respuestas no pueden desalinearse.
 *
 * Tres condiciones, y las tres tienen el mismo motivo de fondo —no dejar a la organización
 * peor de lo que estaba—:
 *
 * 1. **El pedido tiene que estar vivo.** Un rechazo o un cierre terminaron el circuito, y el
 *    correo de rechazo ni lleva enlace a propósito (ver `buildRequestRejectedEmail`): mandarle
 *    uno ahora la invitaría a volver a mirar un "no".
 * 2. **Tiene que haber a quién mandárselo.** Sin correo en la ficha del padrón no hay entrega
 *    posible.
 * 3. **Tiene que haber `appUrl()`.** Sin ella no se puede armar la dirección del enlace.
 *
 * Las dos últimas son exactamente `debeRotarEnlace`, y se consultan a través de ella y no
 * repitiéndolas acá: emitir uno nuevo **mata el anterior**, así que rotar sin poder avisar deja
 * a la organización sin enlace y sin manera de enterarse, que es peor que no hacer nada.
 */
export type ReenvioDeEnlaceCheck = { ok: true } | { ok: false; error: string };

export function puedeReemitirEnlace(input: {
  status: string;
  tieneDestinatario: boolean;
  tieneAppUrl: boolean;
}): ReenvioDeEnlaceCheck {
  /*
   * El estado se mira primero, y no por prolijidad: los otros dos motivos hablan de la
   * configuración de la institución, y contarlos sobre un pedido que ya terminó es explicar algo
   * que no viene al caso.
   */
  if (!isRequestStatus(input.status) || !estaVivo(input.status)) {
    return {
      ok: false,
      error: `Este pedido ya está «${requestStatusLabel(input.status)}»: el circuito terminó y no hay nada que seguir desde un enlace.`,
    };
  }

  if (
    !debeRotarEnlace({
      tieneDestinatario: input.tieneDestinatario,
      tieneAppUrl: input.tieneAppUrl,
    })
  ) {
    if (!input.tieneDestinatario) {
      return {
        ok: false,
        error:
          "No hay ninguna dirección de correo en la ficha de la organización, así que no habría a quién mandarle el enlace nuevo. Cargala primero.",
      };
    }
    return {
      ok: false,
      error:
        "Falta configurar la dirección pública de la aplicación, y sin ella no se puede armar el enlace. Avisale al equipo técnico.",
    };
  }

  return { ok: true };
}

function estaVivo(status: string): boolean {
  return (REQUEST_LIVE_STATUSES as readonly string[]).includes(status);
}
