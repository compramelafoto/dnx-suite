"use server";

/**
 * Cambio de fase del concurso — acción administrativa explícita.
 *
 * Nada de esto ocurre automáticamente: pasar de DRAFT a PRÓXIMAMENTE, o de
 * PRÓXIMAMENTE a inscripciones abiertas, requiere una acción deliberada de una
 * persona autorizada, supera los gates de contenido y queda auditado.
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { routes } from "../lib/routes";
import { requireAdminContestScope } from "../lib/fotorank/upcoming/admin-access";
import { transitionContestPhase } from "../lib/fotorank/upcoming/service";
import type { ContestLifecyclePhase } from "../lib/fotorank/upcoming/lifecycle";
import type { GateReport } from "../lib/fotorank/upcoming/publication-gates";

export type TransitionActionResult =
  | { ok: true; from: string; to: ContestLifecyclePhase }
  | { ok: false; error: string; missing?: string[] };

export async function transitionContestPhaseAction(input: {
  contestId: string;
  target: ContestLifecyclePhase;
  /** Anulación deliberada de los gates. Exige motivo y queda auditada. */
  override?: boolean;
  overrideReason?: string;
}): Promise<TransitionActionResult> {
  const scope = await requireAdminContestScope(input.contestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const h = await headers();
  const forwarded = h.get("x-forwarded-for");

  const result = await transitionContestPhase({
    contestId: scope.scope.contestId,
    organizationId: scope.scope.organizationId,
    actorUserId: scope.scope.user.id,
    target: input.target,
    override: input.override,
    overrideReason: input.overrideReason,
    ip: forwarded ? forwarded.split(",")[0]!.trim() : null,
    userAgent: h.get("user-agent"),
  });

  if (!result.ok) {
    const gate = (result as { gate?: GateReport }).gate;
    return { ok: false, error: result.error, missing: gate?.missing };
  }

  revalidatePath(routes.dashboard.concursos.detalle(input.contestId));
  revalidatePath(`/dashboard/concursos/${input.contestId}/proximamente`);
  return { ok: true, from: result.from, to: result.to };
}
