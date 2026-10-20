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

export function esFase(v: unknown): v is Fase {
  return typeof v === "string" && (FASES as readonly string[]).includes(v);
}

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

/** La fase de una etapa dentro de su recorrido (la última cuenta como entregado si no tiene color). */
export function faseDeEtapaEn(etapas: readonly EtapaVista[], id: string): Fase | null {
  const orden = [...etapas].sort((a, b) => a.order - b.order);
  const i = orden.findIndex((e) => e.id === id);
  return i < 0 ? null : faseDeEtapa({ ...orden[i]!, esUltima: i === orden.length - 1 });
}

/**
 * La etapa anterior del recorrido (el botón "volver"). Para un trabajo ya cerrado (`actualId`
 * null) es la última etapa: reabrirlo lo deja donde estaba antes de entregarse. null si no hay.
 */
export function etapaAnterior(etapas: readonly EtapaVista[], actualId: string | null): EtapaVista | null {
  const orden = [...etapas].sort((a, b) => a.order - b.order);
  if (actualId === null) return orden.at(-1) ?? null;
  const i = orden.findIndex((e) => e.id === actualId);
  return i > 0 ? orden[i - 1]! : null;
}

export type DestinoDeFase =
  | { tipo: "MOVER"; etapa: EtapaVista }
  | { tipo: "REABRIR"; etapa: EtapaVista }
  | { tipo: "CERRAR" };

/**
 * Adónde va un trabajo que se arrastra a la columna `fase`. Cada recorrido tiene sus etapas, así
 * que se elige la de esa fase más cercana a la actual: hacia adelante, la primera que viene;
 * hacia atrás, la última que quedó atrás. Arrastrar a "Entregado" un recorrido sin etapa de esa
 * fase lo termina. Uno ya cerrado (`actualId` null) se reabre en la última etapa de la fase.
 * null si no hay nada que hacer (misma columna, o el recorrido no tiene etapa de esa fase).
 */
export function destinoParaFase(etapas: readonly EtapaVista[], actualId: string | null, fase: Fase): DestinoDeFase | null {
  const orden = [...etapas].sort((a, b) => a.order - b.order);
  const conFase = orden.map((e, i) => ({ etapa: e, fase: faseDeEtapa({ ...e, esUltima: i === orden.length - 1 }) }));
  const deLaFase = conFase.filter((e) => e.fase === fase).map((e) => e.etapa);

  if (actualId === null) {
    if (fase === "ENTREGADO") return null;
    const ultima = deLaFase.at(-1);
    return ultima ? { tipo: "REABRIR", etapa: ultima } : null;
  }

  const actual = conFase.find((e) => e.etapa.id === actualId);
  if (!actual || actual.fase === fase) return null;
  const adelante = FASES.indexOf(fase) > FASES.indexOf(actual.fase);
  const elegida = adelante
    ? (deLaFase.find((e) => e.order > actual.etapa.order) ?? deLaFase[0])
    : ([...deLaFase].reverse().find((e) => e.order < actual.etapa.order) ?? deLaFase.at(-1));
  if (elegida) return { tipo: "MOVER", etapa: elegida };
  return fase === "ENTREGADO" ? { tipo: "CERRAR" } : null;
}
