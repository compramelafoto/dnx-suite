/**
 * Cuándo se le escribe al cliente después del evento.
 *
 * Cinco avisos: al día siguiente, a los 3, 7, 15 y 30 días del cierre. Sirven para dos
 * cosas a la vez: contarle que su álbum está listo y ofrecerle la descarga si compró sin
 * ella. El último avisa que el material se borra.
 *
 * Función pura porque las dos reglas que importan son de fechas y se rompen en los bordes.
 */

/** Días desde el cierre en los que se escribe. */
export const HITOS = [1, 3, 7, 15, 30] as const;

/**
 * Cuántos días tarde todavía vale la pena mandar un aviso.
 *
 * Uno: si el cron estuvo caído un día, el aviso sale igual porque sigue siendo útil. Más
 * que eso ya no — el aviso del día 1 no dice nada nuevo el día 7, y mandar los atrasados
 * de golpe serían tres correos en un minuto.
 */
const TOLERANCIA_EN_DIAS = 1;

const UN_DIA = 24 * 60 * 60 * 1000;

export type Aviso = `dia-${(typeof HITOS)[number]}`;

/**
 * Qué aviso corresponde mandar ahora, o `null` si ninguno.
 *
 * Devuelve **uno solo**: la vuelta siguiente del cron manda el que siga. Mandar varios de
 * una es la forma más rápida de que alguien marque el correo como spam.
 */
export function avisoQueCorresponde(entrada: {
  cierre: Date | null;
  ahora: Date;
  yaEnviados: readonly string[];
}): Aviso | null {
  if (!entrada.cierre) return null;

  const dias = Math.floor((entrada.ahora.getTime() - entrada.cierre.getTime()) / UN_DIA);
  if (dias < 1) return null;

  // Pasado el último hito el material ya se borró: un aviso después ofrecería algo que no
  // existe.
  const ultimo = HITOS[HITOS.length - 1]!;
  if (dias > ultimo) return null;

  const enviados = new Set(entrada.yaEnviados);

  // Del más nuevo al más viejo: si hay varios vencidos, se manda el que todavía dice algo.
  for (const hito of [...HITOS].reverse()) {
    if (dias < hito || dias > hito + TOLERANCIA_EN_DIAS) continue;
    const aviso = `dia-${hito}` as Aviso;
    if (!enviados.has(aviso)) return aviso;
    // Ya se mandó el que correspondía: no se busca uno más viejo.
    return null;
  }

  return null;
}
