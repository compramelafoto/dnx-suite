/**
 * GET /api/cron/cleanup-orphan-r2
 *
 * Elimina objetos en R2 con riesgo ALTO de quedar huérfanos a los 15 días.
 *
 * Incluye:
 * - print-uploads/ (subidas que nunca se convirtieron en pedido)
 * - contact/ (adjuntos de formulario de contacto, enviados por email, no en BD)
 *
 * EXCLUYE (nunca tocar):
 * - logos/ (logos de fotógrafos, labs, comunidad)
 * - banner/ (banner admin)
 *
 * EXCLUIDOS por otros crons:
 * - template-images/ → cleanup-disenador (7 días)
 * - albums/ → cleanup-expired-albums (45 días)
 * - print-orders/ → cleanup-expired-albums (15 días)
 * - preventa-mockups/ → cleanup-preventa-mockups (30 días)
 *
 * Protegido: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, listObjectsByPrefix, urlToR2Key } from "@/lib/r2-client";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const RETENTION_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Prefijos a escanear (alto riesgo de huérfanas) */
const ORPHAN_PREFIXES = ["print-uploads/", "contact/"];

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY);

  let totalDeleted = 0;
  let totalErrors = 0;

  try {
    // Recolectar todas las keys referenciadas en BD (para estos prefijos)
    const protectedKeys = new Set<string>();

    const printItems = await prisma.printOrderItem.findMany({
      select: { fileKey: true },
    });
    for (const item of printItems) {
      const key = urlToR2Key(item.fileKey);
      if (key) protectedKeys.add(key);
    }

    for (const prefix of ORPHAN_PREFIXES) {
      const objects = await listObjectsByPrefix(prefix);
      for (const obj of objects) {
        if (protectedKeys.has(obj.Key)) continue;
        const lastMod = obj.LastModified ? new Date(obj.LastModified) : null;
        if (!lastMod || lastMod >= cutoff) continue;
        try {
          await deleteFromR2(obj.Key);
          totalDeleted++;
        } catch (e) {
          console.error(`[cleanup-orphan-r2] delete ${obj.Key}:`, e);
          totalErrors++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: totalDeleted,
      errors: totalErrors,
      prefixes: ORPHAN_PREFIXES,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error("[cleanup-orphan-r2] ERROR:", err);
    return NextResponse.json(
      { error: "Error en cleanup-orphan-r2", detail: String(err) },
      { status: 500 }
    );
  }
}
