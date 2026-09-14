/**
 * Cuántas fotos puede subir una misma persona (capítulo 7.2).
 *
 * El tope existe para que nadie llene el álbum solo, no para castigar al que saca muchas.
 * Por eso el mensaje habla de lo que ya hizo y no de un límite excedido.
 */

export const LIMITE_POR_DEFECTO = 30;

export type Veredicto = { ok: boolean; motivo?: string };

export function puedeSubirOtra(estado: {
  subidas: number;
  limite: number | null;
}): Veredicto {
  // Cero significa "no pusimos tope", que es lo que espera quien deja el campo vacío.
  // Interpretarlo como "no puede subir nada" sería exactamente lo contrario.
  const limite =
    estado.limite === null || estado.limite === 0 ? LIMITE_POR_DEFECTO : estado.limite;

  if (estado.limite === 0) return { ok: true };

  if (estado.subidas >= limite) {
    return {
      ok: false,
      motivo: `Ya subiste ${limite} fotos, que es el máximo de este evento. ¡Gracias!`,
    };
  }

  return { ok: true };
}
