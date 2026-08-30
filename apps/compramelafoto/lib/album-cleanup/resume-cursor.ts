/**
 * Reanudación del barrido de fotos dentro de un álbum.
 *
 * `Album.cleanupPhotosProcessed` es un CONTADOR ACUMULADO de fotos ya purgadas,
 * no un índice. La lista de fotos de cada corrida se consulta filtrando por
 * `storageCleanupStatus = "ACTIVE"`, o sea que las ya purgadas quedan fuera:
 * la reanudación es automática y siempre hay que arrancar en 0.
 *
 * Usar el contador como índice deja al álbum trabado para siempre en cuanto
 * el contador supera la cantidad de fotos activas restantes (el bucle no entra,
 * el álbum nunca se vacía, y vuelve a encabezar la cola en la corrida siguiente).
 */
export type PhotoBatchPlan = {
  /** Índice desde el que hay que empezar a recorrer la lista de fotos activas. */
  startIndex: number;
  /** Base para seguir numerando el contador acumulado sin perder el histórico. */
  counterBase: number;
};

export function planPhotoBatch(
  processedCount: number | null | undefined,
  remainingActivePhotos: number
): PhotoBatchPlan {
  const alreadyProcessed = Math.max(0, Math.trunc(processedCount ?? 0));
  return {
    startIndex: 0,
    counterBase: alreadyProcessed,
  };
}

/** Contador acumulado a persistir después de purgar la foto en `index`. */
export function nextProcessedCount(plan: PhotoBatchPlan, index: number): number {
  return plan.counterBase + index + 1;
}
