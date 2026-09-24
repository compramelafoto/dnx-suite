/**
 * Las vacantes de jurado de una edición.
 *
 * Separar **cuántos** de **quiénes** es lo que deja que el jurado ya confirmado
 * empiece hoy: el reparto se calcula sobre vacantes numeradas, así que sumar una
 * persona la semana que viene no le mueve el lote a nadie.
 *
 * Antes el reparto salía de la lista de asignados, y entonces cada alta lo
 * cambiaba todo: nadie podía arrancar hasta que estuvieran los cinco.
 */
import { consignasDeLaVacante } from "./reparto";

export type Vacante = {
  seatNumber: number;
  judgeAccountId: string | null;
  nombre: string | null;
  consignas: string[];
};

export type Ocupante = {
  seatNumber: number | null;
  judgeAccountId: string;
  nombre: string | null;
};

export function armarVacantes(input: {
  plannedSeats: number;
  consignas: Array<{ id: string; sequence: number; titulo: string }>;
  miradasPorObra: number;
  ocupantes: Ocupante[];
  excepciones?: Array<{ seatNumber: number; promptExternalId: string }>;
}): Vacante[] {
  if (!Number.isFinite(input.plannedSeats) || input.plannedSeats < 1) return [];

  const cuantas = Math.floor(input.plannedSeats);
  const ordenadas = [...input.consignas].sort((a, b) => a.sequence - b.sequence);
  const ids = ordenadas.map((c) => c.id);

  const vacantes: Vacante[] = [];
  for (let n = 1; n <= cuantas; n++) {
    vacantes.push({
      seatNumber: n,
      judgeAccountId: null,
      nombre: null,
      consignas: [
        ...consignasDeLaVacante({
          consignas: ids,
          vacantes: cuantas,
          miradasPorObra: input.miradasPorObra,
          seatNumber: n,
          excepciones: input.excepciones,
        }),
      ],
    });
  }

  // Primero los que ya tienen su vacante. Recién después los que vienen de antes
  // del reparto: si se mezclaran, uno sin vacante podría ocupar la de otro.
  for (const o of input.ocupantes) {
    if (o.seatNumber == null) continue;
    const v = vacantes.find((x) => x.seatNumber === o.seatNumber);
    if (v && !v.judgeAccountId) {
      v.judgeAccountId = o.judgeAccountId;
      v.nombre = o.nombre;
    }
  }
  for (const o of input.ocupantes) {
    if (o.seatNumber != null) continue;
    const libre = vacantes.find((x) => !x.judgeAccountId);
    if (libre) {
      libre.judgeAccountId = o.judgeAccountId;
      libre.nombre = o.nombre;
    }
  }

  return vacantes;
}

export function primeraVacanteLibre(vacantes: Vacante[]): number | null {
  const libre = vacantes.find((v) => !v.judgeAccountId);
  return libre ? libre.seatNumber : null;
}

/**
 * Si todavía se puede cambiar cuántos jurados van a ser.
 *
 * Cambiar la cantidad reparte de nuevo: alguien perdería obras que ya evaluó y
 * otro recibiría obras que nunca vio. Mientras nadie haya enviado una
 * calificación, mover el número no le cuesta nada a nadie.
 */
export function sePuedeCambiarLaCantidad(input: {
  evaluacionesEnviadas: number;
}): { ok: boolean; motivo?: string } {
  if (input.evaluacionesEnviadas > 0) {
    return {
      ok: false,
      motivo:
        "Ya hay obras calificadas. Cambiar la cantidad de jurados ahora movería el lote " +
        "de cada uno: alguien perdería obras que ya evaluó y otro recibiría obras que " +
        "nunca vio.",
    };
  }
  return { ok: true };
}

/**
 * Reparte el lote de una vacante que nunca se llenó entre quienes sí están.
 *
 * Esto **sí** le agrega obras a gente que quizá ya terminó, y por eso no puede
 * ser automático: lo decide el organizador, con un motivo que queda registrado.
 * Se reparte por turnos y nunca se le da a alguien una consigna que ya tenía.
 */
export function repartirLoteHuerfano(input: {
  vacantes: Vacante[];
  seatVacia: number;
}): Array<{ seatNumber: number; promptExternalId: string }> {
  const vacia = input.vacantes.find((v) => v.seatNumber === input.seatVacia);
  if (!vacia || vacia.judgeAccountId) return [];

  const ocupadas = input.vacantes.filter((v) => v.judgeAccountId);
  if (ocupadas.length === 0) return [];

  const nuevas: Array<{ seatNumber: number; promptExternalId: string }> = [];
  let turno = 0;
  for (const consigna of vacia.consignas) {
    for (let i = 0; i < ocupadas.length; i++) {
      const destino = ocupadas[(turno + i) % ocupadas.length]!;
      if (!destino.consignas.includes(consigna)) {
        nuevas.push({ seatNumber: destino.seatNumber, promptExternalId: consigna });
        turno = (turno + i + 1) % ocupadas.length;
        break;
      }
    }
  }
  return nuevas;
}
<<<<<<< HEAD

/**
 * Cuántas evaluaciones tiene que juntar cada obra.
 *
 * Tres, porque el desempate ordena por mediana y por dispersión: con dos notas
 * no hay mediana que diga nada ni con qué comparar a un jurado que se va de
 * tono. Si el equipo es más chico, la miran todos.
 *
 * Espejo de `minimoDeEvaluacionesPorObra()` de FotoRank.
 */
export function minimoDeEvaluacionesPorObra(cantidadDeJurados: number): number {
  if (!Number.isFinite(cantidadDeJurados) || cantidadDeJurados < 1) return 1;
  return Math.min(3, Math.floor(cantidadDeJurados));
}
=======
>>>>>>> origin/main
