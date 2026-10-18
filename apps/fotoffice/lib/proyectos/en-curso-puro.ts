/**
 * "Trabajos en curso": todos los trabajos de todos los recorridos en un solo tablero, agrupados
 * en cinco columnas comunes. Módulo PURO.
 *
 * Cada recorrido tiene sus propias etapas ("Enviado al laboratorio", "Grabado", "Recibido
 * digital"…); para verlos juntos, cada etapa cae en una fase. Manda el color de la etapa (los
 * recorridos de DNX lo traen puesto a propósito) y, si no lo tiene, su nombre.
 */

export const FASES = ["RECIBIDO", "EN_PROCESO", "EN_PROVEEDOR", "LISTO", "ENTREGADO"] as const;
export type Fase = (typeof FASES)[number];

export const FASE_INFO: Record<Fase, { titulo: string; ayuda: string }> = {
  RECIBIDO: { titulo: "Recibido", ayuda: "Entró el pedido; todavía no se empezó." },
  EN_PROCESO: { titulo: "En proceso", ayuda: "Se está trabajando en el estudio." },
  EN_PROVEEDOR: { titulo: "En el proveedor", ayuda: "Está en el laboratorio." },
  LISTO: { titulo: "Listo para retirar", ayuda: "Hay que avisarle al cliente." },
  ENTREGADO: { titulo: "Entregado", ayuda: "Últimos 7 días." },
};

const POR_COLOR: Record<string, Fase> = {
  gris: "RECIBIDO",
  azul: "EN_PROCESO",
  violeta: "EN_PROVEEDOR",
  amarillo: "LISTO",
  verde: "ENTREGADO",
};

function sinTildes(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function faseDeEtapa(e: { name: string; color: string; order: number; esUltima: boolean }): Fase {
  const porColor = POR_COLOR[e.color];
  if (porColor) return porColor;
  const n = sinTildes(e.name);
  if (/listo|para entregar|para retirar/.test(n)) return "LISTO";
  if (e.esUltima || /entregad|retirado$|finalizad/.test(n)) return "ENTREGADO";
  if (/enviad|enviar|laboratorio|impresion|imprent/.test(n) && !/retirad/.test(n)) return "EN_PROVEEDOR";
  if (e.order === 0 || /recib|recepcion/.test(n)) return "RECIBIDO";
  return "EN_PROCESO";
}

export type Urgencia = "VENCIDO" | "HOY" | "PRONTO" | "OK" | "SIN_FECHA";

/** Qué tan cerca está la entrega prometida ("aaaa-mm-dd") de hoy. */
export function urgenciaDeEntrega(entrega: string | null, hoy: string): Urgencia {
  if (!entrega) return "SIN_FECHA";
  if (entrega < hoy) return "VENCIDO";
  if (entrega === hoy) return "HOY";
  const dias = Math.round((Date.parse(`${entrega}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000);
  return dias <= 2 ? "PRONTO" : "OK";
}

export type EtapaVista = { id: string; name: string; color: string; order: number };

/** La etapa siguiente del recorrido, o null si ya está en la última. */
export function etapaSiguiente(etapas: readonly EtapaVista[], actualId: string): EtapaVista | null {
  const orden = [...etapas].sort((a, b) => a.order - b.order);
  const i = orden.findIndex((e) => e.id === actualId);
  return i >= 0 && i < orden.length - 1 ? orden[i + 1]! : null;
}
