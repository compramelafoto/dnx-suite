import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types";

/**
 * Señal del filtro de la nube (spec, "Encaje con el filtrado"; D13). Con `Agency.publishMode = AWAIT_FILTER` el job
 * de ingesta nace AWAITING_FILTER y el cron no lo toma. El filtro (se diseña aparte) manda, firmado:
 * APPROVED → PENDING (se procesa y publica como siempre); REJECTED → se cierra con nota y se borra el raw.
 * Firma: `x-dnx-firma: t=<segundos>,v1=<HMAC-SHA256(AGENCY_FILTER_SIGNAL_SECRET, "<t>.<cuerpo>") hex>`, 5 minutos.
 */

export const FILTER_SIGNATURE_HEADER = "x-dnx-firma";
export const FILTER_SIGNATURE_TOLERANCE_S = 300;
export const FILTER_REJECTED_NOTE = "Descartada por el filtro";
export const MAX_FILTER_DECISIONS = 100;

export function signFilterBody(secret: string, t: number, body: string): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export function verifyFilterSignature(secret: string | undefined, header: string | null, body: string, nowMs: number): boolean {
  const s = secret?.trim();
  if (!s || !header) return false;
  const m = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(header.trim());
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(nowMs / 1000 - t) > FILTER_SIGNATURE_TOLERANCE_S) return false;
  const expected = Buffer.from(signFilterBody(s, t, body).split("v1=")[1], "hex");
  const received = Buffer.from(m[2], "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export type FilterDecision = { jobId: string; decision: "APPROVED" | "REJECTED" };

export function parseFilterDecisions(v: unknown): { ok: true; decisions: FilterDecision[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_FILTER_DECISIONS) {
    return { ok: false, error: `Mandá entre 1 y ${MAX_FILTER_DECISIONS} decisiones.` };
  }
  const decisions: FilterDecision[] = [];
  for (const raw of v as unknown[]) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (typeof r.jobId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(r.jobId)) return { ok: false, error: "jobId inválido." };
    if (r.decision !== "APPROVED" && r.decision !== "REJECTED") return { ok: false, error: "decision tiene que ser APPROVED o REJECTED." };
    decisions.push({ jobId: r.jobId, decision: r.decision });
  }
  return { ok: true, decisions };
}

export async function applyFilterDecisions(
  decisions: FilterDecision[]
): Promise<Array<{ jobId: string; result: "approved" | "rejected" | "not_waiting" }>> {
  const results: Array<{ jobId: string; result: "approved" | "rejected" | "not_waiting" }> = [];
  for (const d of decisions) {
    if (d.decision === "APPROVED") {
      const r = await prisma.cameraIngestJob.updateMany({
        where: { id: d.jobId, status: "AWAITING_FILTER" },
        data: { status: "PENDING", runAfter: null, lastError: null },
      });
      results.push({ jobId: d.jobId, result: r.count === 1 ? "approved" : "not_waiting" });
      continue;
    }
    const job = await prisma.cameraIngestJob.findFirst({
      where: { id: d.jobId, status: "AWAITING_FILTER" },
      select: { id: true, rawKey: true, uploadLogId: true },
    });
    if (!job) {
      results.push({ jobId: d.jobId, result: "not_waiting" });
      continue;
    }
    const r = await prisma.cameraIngestJob.updateMany({
      where: { id: job.id, status: "AWAITING_FILTER" },
      data: { status: "COMPLETED", completedAt: new Date(), lastError: FILTER_REJECTED_NOTE, lockedAt: null, runAfter: null },
    });
    if (r.count !== 1) {
      results.push({ jobId: d.jobId, result: "not_waiting" });
      continue;
    }
    await deleteFromR2(job.rawKey).catch(() => undefined);
    if (job.uploadLogId != null) {
      await prisma.cameraUploadLog
        .update({ where: { id: job.uploadLogId }, data: { status: CAMERA_UPLOAD_LOG_STATUS.REJECTED, errorMessage: FILTER_REJECTED_NOTE } })
        .catch(() => undefined);
    }
    results.push({ jobId: d.jobId, result: "rejected" });
  }
  return results;
}
