/**
 * Cuánto apura una solicitud de arrepentimiento.
 *
 * La Resolución 424/2020 da **24 horas** para contestar. No es una meta de calidad de
 * servicio: es el plazo de una norma, y pasarlo es incumplir.
 *
 * Por eso la pantalla ordena por esto y no por fecha: lo que importa no es cuál llegó
 * primero sino cuál se está por vencer.
 */

export const HORAS_PARA_CONTESTAR = 24;

/** Desde acá se pinta distinto: queda menos de un cuarto del plazo. */
const APURA_DESDE = HORAS_PARA_CONTESTAR * 0.75;

export type Nivel = "resuelta" | "a-tiempo" | "apura" | "vencida";

export type Urgencia = { nivel: Nivel; texto: string };

export function urgenciaDeLaSolicitud(entrada: {
  creada: Date;
  resuelta: Date | null;
  ahora: Date;
}): Urgencia {
  if (entrada.resuelta) return { nivel: "resuelta", texto: "Resuelta" };

  const horas = (entrada.ahora.getTime() - entrada.creada.getTime()) / 3_600_000;

  if (horas >= HORAS_PARA_CONTESTAR) {
    const pasadas = Math.floor(horas - HORAS_PARA_CONTESTAR);
    return {
      nivel: "vencida",
      texto: pasadas < 1 ? "Vencida recién" : `Vencida hace ${pasadas} horas`,
    };
  }

  // Hacia abajo: decir "quedan 3" cuando quedan 3 y monedas es preferible a redondear
  // para arriba y que alguien crea que tiene una hora más de la que tiene.
  const quedan = Math.floor(HORAS_PARA_CONTESTAR - horas);
  return {
    nivel: horas >= APURA_DESDE ? "apura" : "a-tiempo",
    texto: quedan < 1 ? "Queda menos de una hora" : `Quedan ${quedan} horas`,
  };
}
