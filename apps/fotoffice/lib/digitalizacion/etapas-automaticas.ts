/**
 * Avance automático de las etapas de un trabajo de digitalización. Módulo PURO (sin base).
 *
 * Tres hechos mueven el trabajo solo, siempre hacia adelante y en este orden:
 * - **GRABADO:** el trabajo tiene grabados todos los cassettes vendidos (la `cantidad` de su ítem
 *   del pedido) y al menos uno con imagen. Si no se sabe cuántos se vendieron, con la primera
 *   grabación COMPLETA, sin descartar y con imagen. Ver `cumpleGrabado` en `./cassettes.ts`.
 * - **SUBIDO:** todos los cassettes vendidos están hechos (convertidos LISTA, SIN_IMAGEN o «no se
 *   pudo digitalizar»), ninguno sigue convirtiéndose y hay al menos un video LISTA. Ver
 *   `cumpleSubido`. El worker de Cloud Run convierte pero no mueve etapas: lo hace la conciliación
 *   del cron `digitalizacion-entregas` (cada 15 min).
 * - **LISTO:** la entrega del pedido se envió al cliente y el trabajo tiene hechos todos sus
 *   cassettes, o no se sabe cuántos son.
 *
 * **Un solo salto, no la escalera.** Si en una misma pasada corresponden varios objetivos (un
 * trabajo viejo, o el envío que sale en la misma corrida), se va directo al más avanzado que exista
 * en el flujo: el motor `mover` lo permite. No se pasa por las intermedias porque cada `mover` crea
 * las tareas de la etapa y una etapa con tareas obligatorias trabaría el salto siguiente. En el caso
 * normal el historial queda igual en orden: el envío automático espera 30 min después de la última
 * conversión, así que la conciliación ya llevó el trabajo a «Subido…» en una corrida anterior.
 *
 * **Cómo se encuentra la etapa.** Las etapas son configurables, así que se buscan por nombre:
 * sin tildes, en minúsculas y por inclusión, entre las etapas activas del flujo y en su orden.
 * - GRABADO: el nombre contiene «grabad» («Grabado», «Cassette grabado»…; no «Grabando»).
 * - SUBIDO: contiene «subido» o «nube» («Subido a la nube y a YouTube»).
 * - LISTO: contiene «listo para retirar», o «listo» y «retir» a la vez («Listo p/ retirar»).
 * Si hay varias, gana la primera del flujo. Si el flujo no tiene la etapa, se saltea.
 *
 * **Cuándo no se toca.** Si el trabajo está suspendido, si su recorrido ya terminó (terminado o
 * cancelado), si ya está en esa etapa o en una posterior, o si su etapa actual no está entre las
 * activas (no se puede saber si avanzar sería retroceder).
 */

export type ObjetivoEtapa = "GRABADO" | "SUBIDO" | "LISTO";

export const MOTIVO_AUTOMATICO: Record<ObjetivoEtapa, string> = {
  GRABADO: "cassette grabado",
  SUBIDO: "videos convertidos y subidos",
  LISTO: "videos enviados al cliente",
};

export function normalizarNombreEtapa(nombre: string): string {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function coincideConObjetivo(nombre: string, objetivo: ObjetivoEtapa): boolean {
  const n = normalizarNombreEtapa(nombre);
  if (objetivo === "GRABADO") return n.includes("grabad");
  if (objetivo === "SUBIDO") return n.includes("subido") || n.includes("nube");
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
 * Conciliación (trabajos viejos, avances que fallaron, conversiones que terminan en el worker y
 * cassettes que se completan después del envío): apunta al objetivo más avanzado que se cumple
 * (LISTO, después SUBIDO, después GRABADO). Si el flujo no tiene esa etapa, prueba el anterior. Un
 * objetivo que se cumple implica los anteriores (`listo` o `subido` también prueban GRABADO). null
 * si no hay ningún hecho.
 */
export function decidirConciliacion<E extends EtapaParaAvance>(
  etapas: readonly E[],
  estado: EstadoTrabajo,
  hechos: { grabado: boolean; subido?: boolean; listo: boolean },
): DecisionAvance<E> | null {
  const objetivos: ObjetivoEtapa[] = [];
  if (hechos.listo) objetivos.push("LISTO");
  if (hechos.subido) objetivos.push("SUBIDO");
  if (hechos.grabado || hechos.subido || hechos.listo) objetivos.push("GRABADO");
  if (objetivos.length === 0) return null;
  let ultima: DecisionAvance<E> | null = null;
  for (const o of objetivos) {
    ultima = decidirAvance(etapas, estado, o);
    // Sólo la falta de la etapa deja probar el objetivo anterior: si LISTO ya se alcanzó, los
    // anteriores no se miran (sería volver).
    if (ultima.tipo === "MOVER" || ultima.motivo !== "SIN_ETAPA") return ultima;
  }
  return ultima;
}
