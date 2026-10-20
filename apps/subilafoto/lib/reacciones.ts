/**
 * Las reacciones que el invitado manda a la pantalla del salón.
 *
 * Un emoji no pasa por moderación. Puede hacerlo porque **la lista es cerrada**: el
 * invitado elige de una barra de seis y no escribe nada. Si se aceptara texto libre, la
 * pantalla del salón sería un cartel abierto donde cualquiera con el QR escribe lo que
 * quiera, proyectado en grande y sin nadie revisando. Esa es la razón de que acá no haya
 * ningún campo de texto, y conviene que siga así.
 */

/** La barra que ve el invitado, en este orden. */
export const EMOJIS = ["❤️", "🔥", "👏", "😂", "🎉", "😍"] as const;

export type Emoji = (typeof EMOJIS)[number];

/** Cuántas puede mandar un mismo invitado en toda la noche. */
export const TOPE_POR_INVITADO = 200;

/** Cuánto tiene que esperar entre una y la siguiente. */
const ESPERA_MINIMA_MS = 1_000;

export function esEmojiValido(valor: string): valor is Emoji {
  return (EMOJIS as readonly string[]).includes(valor);
}

export type Veredicto = { ok: true } | { ok: false; motivo: string };

/**
 * Si este invitado puede mandar otra reacción.
 *
 * Dos frenos distintos, porque son dos problemas distintos: la espera mínima evita que
 * una sola persona apoyada en el botón llene la pantalla, y el tope de la noche evita
 * que el contador termine midiendo quién tuvo más paciencia en vez de qué le gustó al
 * salón.
 */
export function puedeReaccionar({
  enviadas,
  ultimaEl,
  ahora,
}: {
  enviadas: number;
  ultimaEl: Date | null;
  ahora: Date;
}): Veredicto {
  if (enviadas >= TOPE_POR_INVITADO) {
    return { ok: false, motivo: `Llegaste al tope de ${TOPE_POR_INVITADO} reacciones.` };
  }

  if (ultimaEl && ahora.getTime() - ultimaEl.getTime() < ESPERA_MINIMA_MS) {
    return { ok: false, motivo: "Esperá un segundo antes de mandar otra." };
  }

  return { ok: true };
}

export type TotalDeEmoji = { emoji: Emoji; total: number };

/**
 * El contador que se proyecta, de más votado a menos.
 *
 * Los que nadie mandó no se muestran: una fila de ceros en un televisor ocupa lugar y no
 * dice nada. Ante un empate se respeta el orden de la barra y no el del objeto, para que
 * las columnas no se reordenen solas cada vez que llega una reacción.
 */
export function totalesOrdenados(conteo: Partial<Record<string, number>>): TotalDeEmoji[] {
  return EMOJIS.map((emoji) => ({ emoji, total: conteo[emoji] ?? 0 }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);
}
