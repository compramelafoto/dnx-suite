import { prisma } from "@/lib/prisma";
import { normalizeEditorDataJson, updateDesignRevisionDataJson } from "@/lib/school-render/design-editor";

/**
 * Recuperación de trabajos de render trabados.
 *
 * Los workers marcan el trabajo como `PROCESSING` con un `lockedAt`, pero nadie leía ese campo.
 * Si una corrida se cortaba a la mitad —timeout de 60s, un deploy, un corte de red— el trabajo
 * quedaba en `PROCESSING` para siempre. Y como encolar deduplica contra `PENDING`/`PROCESSING`,
 * ese diseño tampoco se podía reintentar: el fotógrafo quedaba sin salida.
 *
 * Ojo con `@@unique([designRevisionId, status])`: por revisión puede existir un solo trabajo de
 * cada estado. Antes de mover uno hay que liberar el lugar del estado destino.
 */

/** Un `PROCESSING` más viejo que esto se considera abandonado (el worker corta a los 60s). */
const LOCK_VENCIDO_MS = 10 * 60 * 1000;

/** Reintentos antes de darlo por perdido. */
const MAX_INTENTOS = 3;

export type DesignJobKind = "preview" | "export";

export type DesignJobRecoveryResult = {
  reencolados: number;
  descartados: number;
};

type TrabajoTrabado = {
  id: number;
  designRevisionId: number;
  attempts: number;
};

async function liberarLugarDelEstado(
  kind: DesignJobKind,
  designRevisionId: number,
  jobId: number,
  status: "PENDING" | "FAILED"
): Promise<void> {
  const where = { designRevisionId, id: { not: jobId }, status } as const;
  if (kind === "preview") {
    await prisma.designPreviewJob.deleteMany({ where });
  } else {
    await prisma.designExportJob.deleteMany({ where });
  }
}

/**
 * Deja constancia del fallo en la revisión, para que la pantalla no muestre "renderizando"
 * indefinidamente cuando el trabajo se descarta.
 */
async function marcarRevisionComoFallada(
  kind: DesignJobKind,
  designRevisionId: number
): Promise<void> {
  const revision = await prisma.designRevision.findUnique({
    where: { id: designRevisionId },
    select: { id: true, dataJson: true, designProjectId: true },
  });
  if (!revision) return;

  const proyecto = await prisma.designProject.findUnique({
    where: { id: revision.designProjectId },
    select: { templateId: true, orderItemId: true },
  });

  const data = normalizeEditorDataJson(revision.dataJson ?? null, {
    templateId: proyecto?.templateId ?? null,
    orderItemId: proyecto?.orderItemId ?? null,
  });

  if (kind === "preview") {
    data.previewStatus = "FAILED";
    data.previewError = "El render quedó trabado y se descartó. Volvé a generar la vista previa.";
  } else {
    data.exportStatus = "FAILED";
    data.exportError = "La exportación quedó trabada y se descartó. Volvé a exportar.";
  }
  await updateDesignRevisionDataJson(revision.id, data);
}

async function listarTrabados(kind: DesignJobKind, limite: Date): Promise<TrabajoTrabado[]> {
  const where = { status: "PROCESSING" as const, lockedAt: { lt: limite } };
  const select = { id: true, designRevisionId: true, attempts: true };
  return kind === "preview"
    ? prisma.designPreviewJob.findMany({ where, select })
    : prisma.designExportJob.findMany({ where, select });
}

async function moverTrabajo(
  kind: DesignJobKind,
  jobId: number,
  status: "PENDING" | "FAILED",
  lastError: string | null
): Promise<void> {
  const data = { status, lockedAt: null, ...(lastError ? { lastError } : {}) };
  if (kind === "preview") {
    await prisma.designPreviewJob.update({ where: { id: jobId }, data });
  } else {
    await prisma.designExportJob.update({ where: { id: jobId }, data });
  }
}

/**
 * Reencola los trabajos abandonados y descarta los que ya agotaron los reintentos.
 * Pensado para correr al principio de cada worker, antes de tomar trabajos nuevos.
 */
export async function recoverStaleDesignJobs(
  kind: DesignJobKind
): Promise<DesignJobRecoveryResult> {
  const limite = new Date(Date.now() - LOCK_VENCIDO_MS);
  const trabados = await listarTrabados(kind, limite);

  let reencolados = 0;
  let descartados = 0;

  for (const job of trabados) {
    const agotado = job.attempts >= MAX_INTENTOS;
    const destino = agotado ? "FAILED" : "PENDING";

    await liberarLugarDelEstado(kind, job.designRevisionId, job.id, destino);
    await moverTrabajo(
      kind,
      job.id,
      destino,
      agotado ? `stale_lock_after_${job.attempts}_attempts` : null
    );

    if (agotado) {
      await marcarRevisionComoFallada(kind, job.designRevisionId);
      descartados += 1;
      console.warn("[school_design_job_recovery] job_discarded", {
        kind,
        jobId: job.id,
        attempts: job.attempts,
      });
    } else {
      reencolados += 1;
      console.info("[school_design_job_recovery] job_requeued", {
        kind,
        jobId: job.id,
        attempts: job.attempts,
      });
    }
  }

  return { reencolados, descartados };
}

/**
 * Borra los trabajos terminales viejos de la misma revisión.
 *
 * Sin esto, cerrar el trabajo actual como `SUCCEEDED`/`FAILED` choca con el índice único cuando ya
 * existe otro de esa revisión en ese mismo estado (P2002), y el render queda a medio camino.
 * Se llama una sola vez, justo después de tomar el trabajo.
 */
export async function clearTerminalDesignJobs(
  kind: DesignJobKind,
  designRevisionId: number,
  jobId: number
): Promise<void> {
  if (kind === "preview") {
    await prisma.designPreviewJob.deleteMany({
      where: {
        designRevisionId,
        id: { not: jobId },
        status: { in: ["SUCCEEDED", "FAILED"] },
      },
    });
  } else {
    await prisma.designExportJob.deleteMany({
      where: {
        designRevisionId,
        id: { not: jobId },
        status: { in: ["SUCCEEDED", "FAILED"] },
      },
    });
  }
}
