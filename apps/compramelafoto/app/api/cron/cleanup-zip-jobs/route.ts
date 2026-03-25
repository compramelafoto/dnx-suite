/**
 * GET /api/cron/cleanup-zip-jobs
 *
 * Elimina archivos ZIP de descarga en R2 a los 30 días de realizado el pedido/descarga.
 * Usa finishedAt (o createdAt si no terminó) como referencia.
 *
 * Protegido: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - RETENTION_DAYS * MS_PER_DAY);

  const jobsToClean = await prisma.zipGenerationJob.findMany({
    where: {
      r2Key: { not: null },
      finishedAt: { lte: cutoff },
    },
    select: { id: true, r2Key: true },
  });

  let deleted = 0;
  let errors = 0;

  for (const job of jobsToClean) {
    if (!job.r2Key) continue;
    try {
      await deleteFromR2(job.r2Key);
      deleted++;
    } catch (e) {
      console.error(`[cleanup-zip-jobs] delete ${job.r2Key}:`, e);
      errors++;
    }
    await prisma.zipGenerationJob.update({
      where: { id: job.id },
      data: { r2Key: null, zipUrl: null },
    });
  }

  return NextResponse.json({
    ok: true,
    jobsCleaned: jobsToClean.length,
    filesDeleted: deleted,
    errors,
    cutoff: cutoff.toISOString(),
  });
}
