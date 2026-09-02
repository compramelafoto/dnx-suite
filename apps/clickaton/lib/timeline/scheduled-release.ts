/**
 * Liberación programada de consignas.
 *
 * Hasta ahora una consigna solo pasaba a RELEASED con el botón del panel
 * (`releasePromptManual`). Este módulo ejecuta esa misma acción cuando la hora
 * planificada ya pasó, para que una edición no dependa de que alguien esté
 * frente a la pantalla en el minuto exacto.
 *
 * Alcance deliberadamente angosto:
 * - Solo consignas con `releaseMode` SCHEDULED (o SCHEDULED_WITH_MANUAL_OVERRIDE).
 * - Solo si tienen `captureStartsAt` cargado y ya vencido. Sin fecha → nunca se libera.
 * - Nunca libera DRAFT (contenido sin terminar) ni CANCELLED.
 * - `releasedAt` toma la hora planificada, no la del cron: si el cron corre
 *   10:01, la ventana de captura sigue empezando 10:00 y una foto tomada
 *   10:00:30 no queda fuera de horario.
 */

export type DuePrompt = {
  id: string;
  editionId: string;
  sequence: number;
  captureStartsAt: Date | null;
};

export type PromptReleaseStore = {
  findDuePrompts(input: { now: Date; limit: number }): Promise<DuePrompt[]>;
  markReleased(input: { promptId: string; releasedAt: Date }): Promise<void>;
};

export type ScheduledReleaseResult = {
  released: Array<{ promptId: string; editionId: string; sequence: number; at: string }>;
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

export async function releaseScheduledPrompts(
  store: PromptReleaseStore,
  options?: { now?: Date; dryRun?: boolean; limit?: number },
): Promise<ScheduledReleaseResult> {
  const now = options?.now ?? new Date();
  const due = await store.findDuePrompts({ now, limit: options?.limit ?? 100 });

  const released: ScheduledReleaseResult["released"] = [];
  for (const prompt of due) {
    const at = prompt.captureStartsAt ?? now;
    if (!options?.dryRun) {
      await store.markReleased({ promptId: prompt.id, releasedAt: at });
    }
    released.push({
      promptId: prompt.id,
      editionId: prompt.editionId,
      sequence: prompt.sequence,
      at: at.toISOString(),
    });
  }

  return { released, count: released.length };
}
