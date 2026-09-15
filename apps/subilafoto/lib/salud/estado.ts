/**
 * Si las tareas automáticas están corriendo.
 *
 * La falla más silenciosa que puede tener esto es un cron que deja de correr. No hay
 * error, no hay pantalla rota: las fotos simplemente no se moderan y nadie se entera
 * hasta que alguien pregunta por qué no aparece nada en la pantalla del salón.
 *
 * Puro para poder probar los bordes, que es donde importa: cuánto es "tarde" depende de
 * cada cron y no hay un número que sirva para todos.
 */

/** Cada cuántos minutos corre cada uno. Sale de `vercel.json`. */
export const CADENCIAS: Record<string, number> = {
  moderacion: 5,
  cierre: 5,
  paquetes: 15,
  avisos: 60,
  purga: 24 * 60,
};

/** El más lento, para un nombre que no conocemos. Es preferible a alarmar de más. */
const CADENCIA_DESCONOCIDA = 24 * 60;

/**
 * Cuántas cadencias de atraso se toleran antes de decir algo.
 *
 * Vercel no garantiza el minuto exacto y una corrida que tarda puede correr la siguiente.
 * Al triple ya no es demora: es que algo dejó de andar.
 */
const ATRASADO = 3;
const CAIDO = 6;

export type EstadoDeCron = "bien" | "atrasado" | "caido";

export type Diagnostico = { estado: EstadoDeCron; detalle: string };

export function estadoDeUnCron(entrada: {
  nombre: string;
  ultimaCorrida: Date | null;
  ultimoError?: string | null;
  ahora: Date;
}): Diagnostico {
  /*
    Sin fila no es "todavía no pasó nada": es que nunca corrió. Tratarlo como bien es el
    error más caro que puede tener un panel de salud, porque el panel en verde es
    justamente lo que hace que nadie mire.
  */
  if (!entrada.ultimaCorrida) return { estado: "caido", detalle: "Nunca corrió" };

  const cadencia = CADENCIAS[entrada.nombre] ?? CADENCIA_DESCONOCIDA;
  const minutos = (entrada.ahora.getTime() - entrada.ultimaCorrida.getTime()) / 60_000;

  if (minutos >= cadencia * CAIDO) {
    return { estado: "caido", detalle: `Hace ${Math.round(minutos)} minutos que no corre` };
  }
  if (minutos >= cadencia * ATRASADO) {
    return { estado: "atrasado", detalle: `Hace ${Math.round(minutos)} minutos que no corre` };
  }

  // Corrió hace poco, pero mal. Que sea reciente no lo salva.
  if (entrada.ultimoError) {
    return { estado: "atrasado", detalle: `Última corrida con error: ${entrada.ultimoError}` };
  }

  return { estado: "bien", detalle: `Hace ${Math.round(minutos)} minutos` };
}

/** El peor de todos. Un panel es tan verde como su parte más roja. */
export function semaforoGeneral(diagnosticos: readonly Diagnostico[]): EstadoDeCron {
  if (diagnosticos.length === 0) return "caido";
  if (diagnosticos.some((d) => d.estado === "caido")) return "caido";
  if (diagnosticos.some((d) => d.estado === "atrasado")) return "atrasado";
  return "bien";
}
