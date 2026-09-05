/**
 * Horarios y reglas de re-ejecución de la edición DEMO.
 *
 * Aislado del guion para poder probarlo: son las decisiones que, mal tomadas,
 * rompen una demo con gente adentro.
 */

/**
 * Convierte una hora local argentina a Date.
 *
 * Argentina no aplica horario de verano desde 2009, así que el desfase es fijo
 * en -03:00. Se escribe la hora local y no el UTC calculado a mano: los
 * comentarios del tipo "// 10:00" al lado de un valor UTC se desincronizan a la
 * primera corrección y nadie lo nota.
 */
export function enHoraArgentina(fechaYHoraLocal: string): Date {
  const limpio = fechaYHoraLocal.trim().replace(" ", "T");
  const fecha = new Date(`${limpio}:00-03:00`);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(
      `Fecha inválida: "${fechaYHoraLocal}". Se espera "AAAA-MM-DD HH:MM" en hora argentina.`,
    );
  }
  return fecha;
}

/**
 * Cierre a aplicar cuando el guion se vuelve a correr.
 *
 * Por defecto nunca acorta: si la demo está abierta hasta más tarde de lo que
 * dice el guion, gana lo guardado. Volver a correr el guion no puede dejar
 * afuera a alguien que está participando. Para acortar a propósito hay que
 * pedirlo explícitamente.
 */
export function cierreAAplicar(
  guardado: Date | null | undefined,
  configurado: Date,
  forzar = false,
): Date {
  if (forzar || !guardado) return configurado;
  return guardado.getTime() > configurado.getTime() ? guardado : configurado;
}

/** Lee el permiso para acortar ventanas desde el entorno. */
export function seForzanVentanas(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CLICKATON_SEED_DEMO_FORZAR_VENTANAS === "1";
}

export type EstadoConsigna = {
  status: "DRAFT" | "READY" | "RELEASED" | "CLOSED" | "CANCELLED";
  releasedAt: Date | null;
};

/**
 * Estado a escribir en una consigna existente.
 *
 * Una consigna ya liberada no vuelve atrás: los participantes vieron el texto y
 * pueden haber entregado. Reprogramarla a READY la esconde de golpe y deja las
 * entregas huérfanas.
 */
export function estadoAlReprogramar(
  actual: EstadoConsigna | null | undefined,
): EstadoConsigna {
  if (actual && (actual.status === "RELEASED" || actual.status === "CLOSED")) {
    return { status: actual.status, releasedAt: actual.releasedAt };
  }
  return { status: "READY", releasedAt: null };
}
