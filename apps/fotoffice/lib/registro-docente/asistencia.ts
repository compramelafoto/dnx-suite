import type { Reglas } from "./reglas";

/** Asistencia del Registro docente. Puro: lo usa el celular (sin señal) y el servidor. */

export const ESTADOS_ASISTENCIA = ["PRESENTE", "AUSENTE", "TARDE", "RETIRO", "JUSTIFICADA"] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

export const ESTADO_ETIQUETA: Record<EstadoAsistencia, string> = {
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  TARDE: "Tarde",
  RETIRO: "Se retiró",
  JUSTIFICADA: "Justificada",
};

export const ESTADO_LETRA: Record<EstadoAsistencia, string> = {
  PRESENTE: "P",
  AUSENTE: "A",
  TARDE: "T",
  RETIRO: "R",
  JUSTIFICADA: "J",
};

export function esEstadoAsistencia(v: unknown): v is EstadoAsistencia {
  return typeof v === "string" && (ESTADOS_ASISTENCIA as readonly string[]).includes(v);
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export function esHora(v: unknown): v is string {
  return typeof v === "string" && HORA.test(v);
}

/** «08:12» en hora argentina, sin depender de la zona del aparato. */
export function horaArgentina(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** «AAAA-MM-DD» de hoy en Argentina. */
export function fechaArgentina(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

/** Cuánta falta suma un registro según las reglas. */
export function faltaDe(estado: EstadoAsistencia, r: Pick<Reglas, "faltaPorTarde" | "faltaPorRetiro" | "justificadaCuenta">): number {
  switch (estado) {
    case "AUSENTE":
      return 1;
    case "JUSTIFICADA":
      return r.justificadaCuenta ? 1 : 0;
    case "TARDE":
      return r.faltaPorTarde;
    case "RETIRO":
      return r.faltaPorRetiro;
    default:
      return 0;
  }
}

export type ResumenAsistencia = {
  clases: number;
  conteo: Record<EstadoAsistencia, number>;
  faltas: number;
  /** 0 a 100. null sin clases. */
  porcentaje: number | null;
  superaLimite: boolean;
  /** Le queda un 20 % o menos del límite. */
  cercaDelLimite: boolean;
};

/** Resumen de un estudiante sobre las clases dictadas (las «sin clase» no cuentan). */
export function resumirAsistencia(
  registros: readonly EstadoAsistencia[],
  r: Pick<Reglas, "faltaPorTarde" | "faltaPorRetiro" | "justificadaCuenta" | "limiteFaltas">,
): ResumenAsistencia {
  const conteo = Object.fromEntries(ESTADOS_ASISTENCIA.map((e) => [e, 0])) as Record<EstadoAsistencia, number>;
  let faltas = 0;
  for (const e of registros) {
    conteo[e] += 1;
    faltas += faltaDe(e, r);
  }
  faltas = Math.round(faltas * 100) / 100;
  const clases = registros.length;
  const limite = r.limiteFaltas;
  return {
    clases,
    conteo,
    faltas,
    porcentaje: clases ? Math.round(((clases - Math.min(faltas, clases)) / clases) * 1000) / 10 : null,
    superaLimite: limite !== null && faltas > limite,
    cercaDelLimite: limite !== null && faltas <= limite && faltas >= limite * 0.8 && faltas > 0,
  };
}

/**
 * De dos versiones del mismo registro (dos aparatos, o una que llega tarde por falta de señal),
 * gana la que se anotó después. Empate: gana la que llega.
 */
export function ganaLaNueva(existente: Date | null, entrante: Date): boolean {
  return existente === null || entrante.getTime() >= existente.getTime();
}
