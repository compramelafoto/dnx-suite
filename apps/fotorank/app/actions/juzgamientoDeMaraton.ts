"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "../lib/auth";
import { userIsFotorankSuperAdmin } from "../lib/fotorank/access/super-admin";
import { JuryError } from "../lib/fotorank/jury/errors";
import { closeScoringSession } from "../lib/fotorank/jury/scoring-session-service";
import { ResultError } from "../lib/fotorank/results/errors";
import {
  activateResultRuleSet,
  ensureDraftResultRuleSet,
  finalizeResultBatch,
  generateResultBatch,
} from "../lib/fotorank/results/result-service";

/**
 * Cerrar el juzgamiento de una maratón y sacar su ranking.
 *
 * Una maratón vive en la base de Clickatón, así que el panel de concursos de
 * FotoRank no la encuentra y hasta el 2026-09-25 no había ningún lugar desde
 * donde generar sus resultados. Estas acciones las usa la pantalla
 * `/super-admin/clickaton/[contestId]`; el motor ya elige la base correcta.
 */

async function exigirSuperAdmin() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) redirect("/mi-actividad");
  return user;
}

function volver(contestId: string, aviso?: string): never {
  const destino = `/super-admin/clickaton/${contestId}`;
  revalidatePath(destino);
  redirect(aviso ? `${destino}?aviso=${encodeURIComponent(aviso)}` : destino);
}

const MOTIVOS: Record<string, string> = {
  COVERAGE_INCOMPLETE:
    "Hay obras con menos calificaciones que el mínimo. Esperá a los jurados o cerrá igual indicando el motivo.",
  CONFLICTS_OPEN: "Hay conflictos de jurado sin resolver.",
  SESSION_OPEN: "Primero hay que cerrar la evaluación.",
  TIES_UNRESOLVED: "Hay empates que deciden premios sin resolver.",
};

function motivo(err: unknown): string {
  if (err instanceof JuryError || err instanceof ResultError) {
    return MOTIVOS[err.code] ?? err.message;
  }
  throw err;
}

export async function cerrarEvaluacionAction(fd: FormData): Promise<void> {
  const user = await exigirSuperAdmin();
  const contestId = String(fd.get("contestId") ?? "");
  const forzar = fd.get("forzar") === "1";
  const razon = String(fd.get("razon") ?? "").trim();
  if (forzar && razon.length < 5) {
    volver(contestId, "Para cerrar con obras incompletas escribí el motivo.");
  }
  let aviso: string | undefined;
  try {
    await closeScoringSession({
      contestId,
      sessionId: String(fd.get("sessionId") ?? ""),
      actorUserId: user.id,
      force: forzar,
      reason: razon || null,
    });
  } catch (err) {
    aviso = motivo(err);
  }
  volver(contestId, aviso);
}

export async function generarRankingAction(fd: FormData): Promise<void> {
  const user = await exigirSuperAdmin();
  const contestId = String(fd.get("contestId") ?? "");
  const sessionId = String(fd.get("sessionId") ?? "");
  let aviso: string | undefined;
  try {
    const reglas = await ensureDraftResultRuleSet({
      contestId,
      scoringSessionId: sessionId,
      actorUserId: user.id,
    });
    if (reglas.status !== "ACTIVE") {
      await activateResultRuleSet({ contestId, ruleSetId: reglas.id, actorUserId: user.id });
    }
    await generateResultBatch({
      contestId,
      scoringSessionId: sessionId,
      ruleSetId: reglas.id,
      actorUserId: user.id,
      scope: "CATEGORY_AND_PROMPT",
    });
  } catch (err) {
    aviso = motivo(err);
  }
  volver(contestId, aviso);
}

export async function finalizarRankingAction(fd: FormData): Promise<void> {
  const user = await exigirSuperAdmin();
  const contestId = String(fd.get("contestId") ?? "");
  const forzar = fd.get("forzar") === "1";
  const razon = String(fd.get("razon") ?? "").trim();
  if (forzar && razon.length < 5) {
    volver(contestId, "Para finalizar con pendientes escribí el motivo.");
  }
  let aviso: string | undefined;
  try {
    await finalizeResultBatch({
      contestId,
      batchId: String(fd.get("batchId") ?? ""),
      actorUserId: user.id,
      force: forzar,
      reason: razon || null,
    });
  } catch (err) {
    aviso = motivo(err);
  }
  volver(contestId, aviso);
}
