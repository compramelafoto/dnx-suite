/**
 * Avance automático de las etapas de un trabajo de digitalización. Módulo PURO (sin base).
 *
 * Dos hechos mueven el trabajo solo, siempre hacia adelante:
 * - **GRABADO:** una grabación del trabajo quedó COMPLETA, sin descartar y con imagen.
 * - **LISTO:** la entrega del pedido se envió al cliente por primera vez (correo o «Copiar
 *   enlace»). Se saltean las intermedias («Subido a la nube…»): los videos ya están en la nube.
 *
 * **Cómo se encuentra la etapa.** Las etapas son configurables, así que se buscan por nombre:
 * sin tildes, en minúsculas y por inclusión, entre las etapas activas del flujo y en su orden.
 * - GRABADO: el nombre contiene «grabad» («Grabado», «Cassette grabado»…; no «Grabando»).
 * - LISTO: contiene «listo para retirar», o «listo» y «retir» a la vez («Listo p/ retirar»).
 * Si hay varias, gana la primera del flujo. Si el flujo no tiene la etapa, no se hace nada.
 *
 * **Cuándo no se toca.** Si el trabajo está suspendido, si su recorrido ya terminó (terminado o
 * cancelado), si ya está en esa etapa o en una posterior, o si su etapa actual no está entre las
 * activas (no se puede saber si avanzar sería retroceder).
 */

export type ObjetivoEtapa = "GRABADO" | "LISTO";

export const MOTIVO_AUTOMATICO: Record<ObjetivoEtapa, string> = {
  GRABADO: "cassette grabado",
  LISTO: "videos enviados al cliente",
};

export function normalizarNombreEtapa(nombre: string): string {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function coincideConObjetivo(nombre: string, objetivo: ObjetivoEtapa): boolean {
  const n = normalizarNombreEtapa(nombre);
  if (objetivo === "GRABADO") return n.includes("grabad");
  return n.includes("listo para retirar") || (n.includes("listo") && n.includes("retir"));
}

export type EtapaParaAvance = { id: string; name: string; order: number; archivedAt?: Date | null };

/** La etapa del objetivo dentro del flujo (la primera que coincide, entre las activas), o null. */
export function etapaDelObjetivo<E extends EtapaParaAvance>(etapas: readonly E[], objetivo: ObjetivoEtapa): E | null {
  const activas = etapas.filter((e) => !e.archivedAt).sort((a, b) => a.order - b.order);
  return activas.find((e) => coincideConObjetivo(e.name, objetivo)) ?? null;
}

export type EstadoTrabajo = {
  /** Etapa actual del recorrido; null si el recorrido terminó (terminado o cancelado). */
  etapaActualId: string | null;
  suspendido: boolean;
};

export type DecisionAvance<E extends EtapaParaAvance = EtapaParaAvance> =
  | { tipo: "MOVER"; etapa: E; nota: string }
  | { tipo: "NADA"; motivo: "CERRADO" | "SUSPENDIDO" | "SIN_ETAPA" | "ETAPA_ACTUAL_DESCONOCIDA" | "YA_ESTA" };

/** Qué hacer con un trabajo para el objetivo pedido. Sólo hacia adelante. */
export function decidirAvance<E extends EtapaParaAvance>(etapas: readonly E[], estado: EstadoTrabajo, objetivo: ObjetivoEtapa): DecisionAvance<E> {
  if (estado.etapaActualId === null) return { tipo: "NADA", motivo: "CERRADO" };
  if (estado.suspendido) return { tipo: "NADA", motivo: "SUSPENDIDO" };
  const destino = etapaDelObjetivo(etapas, objetivo);
  if (!destino) return { tipo: "NADA", motivo: "SIN_ETAPA" };
  const actual = etapas.find((e) => e.id === estado.etapaActualId && !e.archivedAt);
  if (!actual) return { tipo: "NADA", motivo: "ETAPA_ACTUAL_DESCONOCIDA" };
  if (actual.order >= destino.order) return { tipo: "NADA", motivo: "YA_ESTA" };
  return { tipo: "MOVER", etapa: destino, nota: notaAutomatica(destino.name, objetivo) };
}

/** Lo que queda en el historial: «Entró en Grabado (automático: cassette grabado)». */
export function notaAutomatica(etapa: string, objetivo: ObjetivoEtapa): string {
  return `Entró en ${etapa} (automático: ${MOTIVO_AUTOMATICO[objetivo]})`;
}

/**
 * Conciliación de trabajos viejos: con la entrega enviada apunta a LISTO; si el flujo no tiene esa
 * etapa, a GRABADO (la entrega implica videos grabados). Sin entrega, con una grabación terminada
 * con imagen, a GRABADO. null si no hay ningún hecho.
 */
export function decidirConciliacion<E extends EtapaParaAvance>(
  etapas: readonly E[],
  estado: EstadoTrabajo,
  hechos: { grabacionTerminadaConImagen: boolean; entregaEnviada: boolean },
): DecisionAvance<E> | null {
  const objetivos: ObjetivoEtapa[] = [];
  if (hechos.entregaEnviada) objetivos.push("LISTO");
  if (hechos.grabacionTerminadaConImagen || hechos.entregaEnviada) objetivos.push("GRABADO");
  if (objetivos.length === 0) return null;
  let ultima: DecisionAvance<E> | null = null;
  for (const o of objetivos) {
    ultima = decidirAvance(etapas, estado, o);
    // Sólo la falta de la etapa deja probar el objetivo anterior: si LISTO ya se alcanzó, GRABADO
    // no se mira (sería volver).
    if (ultima.tipo === "MOVER" || ultima.motivo !== "SIN_ETAPA") return ultima;
  }
  return ultima;
}
