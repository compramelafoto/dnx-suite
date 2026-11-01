/**
 * Qué se le dice al jurado cuando el visor no puede mostrarle obras para
 * calificar.
 *
 * Antes había un solo mensaje para todo: "Todavía no te tocó ninguna obra".
 * El 1/11/2026 los jurados de Retratos del mundo entraron el día que abría la
 * evaluación, con la organización todavía sin congelar las obras, y leyeron
 * eso: creyeron que estaban mal asignados. No era un problema de reparto sino
 * de tiempos, y el texto tiene que distinguirlo.
 */

/**
 * - ESPERANDO_APERTURA: no hay lote congelado, no hay obras que mostrar.
 * - SOLO_MIRAR: hay obras, pero la ronda de calificación no está abierta.
 * - CALIFICANDO: hay obras y se puede calificar.
 */
export type EtapaDelVisor = "ESPERANDO_APERTURA" | "SOLO_MIRAR" | "CALIFICANDO";

export function etapaDelVisor(input: {
  hayLote: boolean;
  sePuedeCalificar: boolean;
}): EtapaDelVisor {
  if (!input.hayLote) return "ESPERANDO_APERTURA";
  return input.sePuedeCalificar ? "CALIFICANDO" : "SOLO_MIRAR";
}

/** El cierre de la evaluación como lo lee una persona en Argentina. */
export function fechaDelCierre(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("weekday")} ${parte("day")} de ${parte("month")}, ${parte("hour")}:${parte("minute")}`;
}

/**
 * PANTALLA reemplaza al visor (no hay nada que mirar); FRANJA va arriba de
 * las fotos, porque mirarlas sí sirve.
 */
export type AvisoDelVisor = {
  tipo: "PANTALLA" | "FRANJA";
  titulo: string;
  texto: string;
};

export function avisoDelVisor(input: {
  etapa: EtapaDelVisor;
  cantidadDeObras: number;
  judgingEndsAt: string | null;
}): AvisoDelVisor | null {
  const cierre = fechaDelCierre(input.judgingEndsAt);

  if (input.etapa === "ESPERANDO_APERTURA") {
    return {
      tipo: "PANTALLA",
      titulo: "La evaluación todavía no empezó",
      texto:
        "La organización está preparando las obras para el jurado. Cuando estén listas " +
        "van a aparecer acá solas: no tenés que hacer nada, sólo volver a entrar más tarde." +
        (cierre ? ` Vas a tener tiempo para calificar hasta el ${cierre}.` : ""),
    };
  }

  if (input.cantidadDeObras === 0) {
    return {
      tipo: "PANTALLA",
      titulo: "No hay obras para calificar",
      texto:
        "La evaluación está abierta, pero no te tocó ninguna obra en este concurso. " +
        "Si creés que es un error, escribile a la organización.",
    };
  }

  if (input.etapa === "SOLO_MIRAR") {
    return {
      tipo: "FRANJA",
      titulo: "Todavía no se puede calificar",
      texto:
        "Podés ir mirando las obras. Las notas se habilitan cuando la organización abra la calificación.",
    };
  }

  return null;
}
