/**
 * PURO. Semáforo de la fecha de una consulta (pedido de Daniel, 18/11/2026, como en Alboom CRM):
 * - ROJO: la fecha está tomada. Ya hay tantos eventos contratados ese día como los que el
 *   estudio puede cubrir (`capacidad`, Configuración → Consultas → Avisos; DNX cubre dos).
 * - AMARILLO: todavía hay lugar, pero ese día ya hay algún evento contratado u otras consultas abiertas.
 * - VERDE: no hay nada más ese día.
 * Un evento contratado es un pedido no cancelado con esa fecha, o una consulta ganada sin pedido.
 * Sin dependencias: lo usan el servidor, la tarjeta del tablero (cliente) y las pruebas.
 */

export type ColorSemaforo = "ROJO" | "AMARILLO" | "VERDE";

export type Semaforo = {
  color: ColorSemaforo;
  /** Eventos contratados ese día (sin contar esta misma consulta). */
  contratados: number;
  /** Otras consultas abiertas para ese día. */
  consultas: number;
  capacidad: number;
  /** Lo que se lee al pasar el mouse o en la ficha. */
  texto: string;
};

export const CAPACIDAD_MINIMA = 1;
export const CAPACIDAD_MAXIMA = 20;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function calcularSemaforo(contratados: number, consultas: number, capacidad: number): Semaforo {
  const cap = Math.min(CAPACIDAD_MAXIMA, Math.max(CAPACIDAD_MINIMA, Math.floor(capacidad) || CAPACIDAD_MINIMA));
  const eventos = plural(contratados, "evento contratado", "eventos contratados");
  const otras = plural(consultas, "consulta más", "consultas más");
  if (contratados >= cap) {
    const extra = consultas > 0 ? ` Además hay ${otras} para ese día.` : "";
    return { color: "ROJO", contratados, consultas, capacidad: cap, texto: `Fecha ocupada: ya hay ${eventos} ese día (podés cubrir ${cap}).${extra}` };
  }
  if (contratados > 0) {
    const extra = consultas > 0 ? ` y ${otras}` : "";
    return { color: "AMARILLO", contratados, consultas, capacidad: cap, texto: `Queda lugar: hay ${eventos}${extra} ese día (podés cubrir ${cap}).` };
  }
  if (consultas > 0) return { color: "AMARILLO", contratados, consultas, capacidad: cap, texto: `Fecha libre, pero hay ${otras} para ese día.` };
  return { color: "VERDE", contratados, consultas, capacidad: cap, texto: "Fecha libre: no hay eventos ni otras consultas ese día." };
}

export const ETIQUETA_SEMAFORO: Record<ColorSemaforo, string> = { ROJO: "Ocupada", AMARILLO: "Con otras", VERDE: "Libre" };

/** Clases del punto de color (tokens del sistema de diseño). */
export const CLASE_PUNTO: Record<ColorSemaforo, string> = {
  ROJO: "bg-[var(--fo-danger)]",
  AMARILLO: "bg-[var(--fo-warning)]",
  VERDE: "bg-[var(--fo-success)]",
};

/**
 * Puro: cuenta, para cada consulta, los contratados y las otras consultas abiertas de su día.
 * `contratadosPorDia`: claves de eventos contratados por día (el leadId de su consulta, o el id del
 * pedido si no tiene). `abiertasPorDia`: leadIds de consultas abiertas por día. Nunca se cuenta a sí misma.
 */
export function semaforosPorDia(
  consultas: readonly { leadId: string; dia: string }[],
  contratadosPorDia: ReadonlyMap<string, ReadonlySet<string>>,
  abiertasPorDia: ReadonlyMap<string, ReadonlySet<string>>,
  capacidad: number,
): Map<string, Semaforo> {
  const out = new Map<string, Semaforo>();
  for (const c of consultas) {
    const contratados = [...(contratadosPorDia.get(c.dia) ?? [])].filter((k) => k !== c.leadId).length;
    const otras = [...(abiertasPorDia.get(c.dia) ?? [])].filter((k) => k !== c.leadId).length;
    out.set(c.leadId, calcularSemaforo(contratados, otras, capacidad));
  }
  return out;
}
