import {
  allowedTransitions,
  capabilityFor,
  type FulfillmentCapability,
  type FulfillmentState,
} from "./fulfillment";

/**
 * Lo que el tablero puede ofrecer sobre uno o varios carnets a la vez.
 *
 * Módulo puro y aparte de `fulfillment`: aquel define las reglas del recorrido, este las usa
 * para armar una pantalla. Separarlos evita que una decisión de interfaz —qué botón mostrar—
 * termine metida en la regla que decide qué es legal.
 */

/**
 * Los pasos que sirven para TODOS los carnets seleccionados.
 *
 * La intersección y no la unión: marcar «impreso» treinta y nueve carnets y fallar en el
 * cuarenta dejaría la tanda a medias sin que nadie sepa cuál quedó afuera. Si un carnet del
 * montón no admite el paso, el paso no se ofrece.
 */
export function commonTransitions(
  states: readonly FulfillmentState[],
  capabilities: readonly FulfillmentCapability[],
): FulfillmentState[] {
  if (states.length === 0) return [];

  const [primero, ...resto] = states;
  const comunes = allowedTransitions(primero!).filter((destino) =>
    resto.every((otro) => allowedTransitions(otro).includes(destino)),
  );
  return comunes.filter((destino) => capabilities.includes(capabilityFor(destino)));
}

/**
 * ¿Se puede bajar el PDF de imprenta?
 *
 * No para un pedido dado de baja ni para uno que el socio no pagó: el archivo lleva su foto
 * y sus datos, y bajarlo es el paso previo a mandarlo a la imprenta. Sí para los ya impresos
 * y entregados, porque una tarjeta se daña y hay que rehacerla.
 */
export function canDownloadPdf(state: FulfillmentState): boolean {
  return state !== "ANULADO" && state !== "PENDIENTE_PAGO";
}

/**
 * Los filtros del tablero, agrupados por el trabajo que representan.
 *
 * Siete estados en fila obligaban a traducir el vocabulario interno antes de encontrar lo
 * propio. Quien imprime entra a «Para imprimir»; quien atiende el mostrador, a «Para
 * entregar».
 */
export type StateGroup = {
  id: string;
  label: string;
  description: string;
  states: readonly FulfillmentState[];
};

export const STATE_GROUPS: readonly StateGroup[] = [
  {
    id: "por-cobrar",
    label: "Por cobrar",
    description: "Pedidos que esperan que el socio pague. Todavía no son trabajo del taller.",
    states: ["PENDIENTE_PAGO"],
  },
  {
    id: "para-imprimir",
    label: "Para imprimir",
    description: "Pagados y esperando la imprenta.",
    states: ["EN_COLA"],
  },
  {
    id: "para-entregar",
    label: "Para entregar",
    description: "Impresos, en el mostrador o en camino.",
    states: ["IMPRESO", "LISTO_PARA_RETIRAR", "ENVIADO"],
  },
  {
    id: "cerrados",
    label: "Cerrados",
    description: "Entregados y dados de baja.",
    states: ["ENTREGADO", "ANULADO"],
  },
];

export function groupStates(id: string): readonly FulfillmentState[] | null {
  return STATE_GROUPS.find((g) => g.id === id)?.states ?? null;
}

/**
 * El nombre del botón que da un paso.
 *
 * Un botón dice lo que HACE, no el estado al que lleva. El tablero mostraba «Impreso» y
 * obligaba a deducir que apretarlo significaba marcarlo como impreso.
 */
const ACCION: Record<FulfillmentState, string> = {
  PENDIENTE_PAGO: "Volver a pendiente de pago",
  // No se ofrece a mano —a la cola se entra pagando— pero el vocabulario tiene que estar
  // completo: un `Record` con un hueco es una pantalla en blanco esperando a pasar.
  EN_COLA: "Mandar a la cola",
  IMPRESO: "Marcar impreso",
  LISTO_PARA_RETIRAR: "Listo para retirar",
  ENVIADO: "Registrar envío",
  ENTREGADO: "Marcar entregado",
  ANULADO: "Anular pedido",
};

export function transitionActionLabel(to: FulfillmentState): string {
  return ACCION[to];
}

/**
 * Cuánto hace que ese carnet está esperando.
 *
 * Es el dato que ordena el trabajo: una fecha absoluta obliga a restar mentalmente para saber
 * cuál lleva más tiempo trabado. Pasado el mes se invierte —«hace 214 días» no le dice nada a
 * nadie— y vuelve la fecha.
 */
export function tiempoRelativo(fecha: Date, ahora: Date): string {
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60000);
  if (minutos < 5) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias <= 30) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;

  const d = String(fecha.getUTCDate()).padStart(2, "0");
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${fecha.getUTCFullYear()}`;
}
