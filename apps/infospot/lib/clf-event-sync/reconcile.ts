/**
 * Reconciliación de eventos públicos CLF → Info Spot.
 * Invocable por CLI, cron futuro, worker o acción admin.
 */

import { listPublicClfEventsForSync, getPublicClfEventForSync } from "./queries";
import { syncClfEventToInfoSpot } from "./sync";
import type { ReconcileSummary, SyncClfEventResult } from "./types";

export type ReconcileOptions = {
  dryRun?: boolean;
  limit?: number;
  eventId?: number;
  /** Si true, también lista no-públicos con shareSlug (para retirar CTA). Default false. */
  includeNonPublicLinked?: boolean;
};

export async function reconcilePublicClfEvents(
  options?: ReconcileOptions,
): Promise<ReconcileSummary> {
  const dryRun = options?.dryRun === true;
  const results: SyncClfEventResult[] = [];

  if (options?.eventId != null) {
    try {
      const one = await getPublicClfEventForSync(options.eventId);
      if (!one) {
        results.push({
          ok: false,
          action: "failed",
          clfEventId: options.eventId,
          infoSpotEventId: null,
          originId: null,
          changes: [],
          warnings: [],
          dryRun,
          error: `Evento CLF ${options.eventId} no encontrado`,
        });
      } else {
        results.push(await syncClfEventToInfoSpot(one, { dryRun }));
      }
    } catch (e) {
      results.push({
        ok: false,
        action: "failed",
        clfEventId: options.eventId,
        infoSpotEventId: null,
        originId: null,
        changes: [],
        warnings: [],
        dryRun,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    const take = options?.limit ?? 100;
    const events = await listPublicClfEventsForSync({ take });
    for (const event of events) {
      try {
        results.push(await syncClfEventToInfoSpot(event, { dryRun }));
      } catch (e) {
        results.push({
          ok: false,
          action: "failed",
          clfEventId: event.id,
          infoSpotEventId: null,
          originId: null,
          changes: [],
          warnings: [],
          dryRun,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const summary: ReconcileSummary = {
    dryRun,
    scanned: results.length,
    created: results.filter((r) => r.ok && r.action === "created").length,
    updated: results.filter((r) => r.ok && r.action === "updated").length,
    unchanged: results.filter((r) => r.ok && r.action === "unchanged").length,
    skipped: results.filter((r) => r.ok && r.action === "skipped").length,
    stale: results.filter((r) => r.ok && r.action === "stale").length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  return summary;
}
