/**
 * Liberación programada de consignas.
 *
 * Corre sin que nadie esté frente a la pantalla en el minuto exacto.
 *
 * Apertura CONJUNTA: en cuanto vence la primera consigna de una edición se
 * abren TODAS las de esa edición con el mismo `releasedAt`. Nunca hay apertura
 * progresiva: o no se ve ninguna, o se ven todas.
 *
 * Alcance deliberadamente angosto:
 * - Solo consignas con `releaseMode` SCHEDULED (o SCHEDULED_WITH_MANUAL_OVERRIDE).
 * - Solo si tienen `captureStartsAt` cargado y ya vencido. Sin fecha → nunca se libera.
 * - Nunca libera DRAFT (contenido sin terminar) ni CANCELLED.
 * - `releasedAt` toma la hora planificada más temprana de la edición, no la del
 *   cron: si el cron corre 10:01, la ventana de captura sigue empezando 10:00 y
 *   una foto tomada 10:00:30 no queda fuera de horario.
 */

export type DuePrompt = {
  id: string;
  editionId: string;
  sequence: number;
  captureStartsAt: Date | null;
};

export type PromptReleaseStore = {
  findDuePrompts(input: { now: Date; limit: number }): Promise<DuePrompt[]>;
  /** Abre TODAS las consignas pendientes de la edición con el mismo instante. */
  markEditionReleased(input: { editionId: string; releasedAt: Date }): Promise<number>;
};

export type ScheduledReleaseResult = {
  released: Array<{ editionId: string; prompts: number; at: string }>;
  count: number;
};

type ReleasableStatus = "READY" | "LOCKED";
type ScheduledMode = "SCHEDULED" | "SCHEDULED_WITH_MANUAL_OVERRIDE";

/** Condición única de "consigna que ya debía estar liberada". */
export function buildDuePromptsWhere(now: Date) {
  const status: ReleasableStatus[] = ["READY", "LOCKED"];
  const releaseMode: ScheduledMode[] = ["SCHEDULED", "SCHEDULED_WITH_MANUAL_OVERRIDE"];
  return {
    status: { in: status },
    releaseMode: { in: releaseMode },
    captureStartsAt: { not: null, lte: now },
    releasedAt: null,
    edition: { status: { not: "CANCELLED" as const } },
  };
}

/** Agrupa las consignas vencidas por edición y toma la hora planificada más temprana. */
export function groupDueByEdition(
  due: DuePrompt[],
  now: Date,
): Array<{ editionId: string; releasedAt: Date; pending: number }> {
  const byEdition = new Map<string, { releasedAt: Date; pending: number }>();
  for (const prompt of due) {
    const at = prompt.captureStartsAt ?? now;
    const current = byEdition.get(prompt.editionId);
    if (!current) {
      byEdition.set(prompt.editionId, { releasedAt: at, pending: 1 });
      continue;
    }
    current.pending += 1;
    if (at.getTime() < current.releasedAt.getTime()) current.releasedAt = at;
  }
  return [...byEdition.entries()].map(([editionId, v]) => ({ editionId, ...v }));
}

export async function releaseScheduledPrompts(
  store: PromptReleaseStore,
  options?: { now?: Date; dryRun?: boolean; limit?: number },
): Promise<ScheduledReleaseResult> {
  const now = options?.now ?? new Date();
  const due = await store.findDuePrompts({ now, limit: options?.limit ?? 100 });

  const released: ScheduledReleaseResult["released"] = [];
  for (const edition of groupDueByEdition(due, now)) {
    const prompts = options?.dryRun
      ? edition.pending
      : await store.markEditionReleased({
          editionId: edition.editionId,
          releasedAt: edition.releasedAt,
        });
    released.push({
      editionId: edition.editionId,
      prompts,
      at: edition.releasedAt.toISOString(),
    });
  }

  return { released, count: released.length };
}
