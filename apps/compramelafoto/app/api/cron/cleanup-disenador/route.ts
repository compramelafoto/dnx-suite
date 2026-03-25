/**
 * GET /api/cron/cleanup-disenador
 *
 * Limpia:
 * - Imágenes del diseñador (template-images/) que NO están en plantillas guardadas: borra a los 7 días
 * - Diseños de fotolibro (PhotobookDocument, DesignProject DRAFT): borra a los 7 días
 *
 * NO borra: plantillas (Template) ni sus imágenes.
 *
 * Protegido: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, listObjectsByPrefix, urlToR2Key } from "@/lib/r2-client";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY);

  let imagesDeleted = 0;
  let imagesErrors = 0;
  let photobookDocsDeleted = 0;
  let designProjectsDeleted = 0;

  try {
    // 1. Imágenes template-images/ huérfanas (no referenciadas por plantillas)
    const templates = await prisma.template.findMany({
      select: { imageUrl: true, pagesJson: true },
    });
    const slots = await prisma.templateSlot.findMany({
      select: { maskPngUrl: true },
    });

    const protectedKeys = new Set<string>();
    const addKey = (url: string) => {
      const key = urlToR2Key(url);
      if (key && key.includes("template-images")) protectedKeys.add(key);
    };
    for (const t of templates) {
      if (t.imageUrl) addKey(t.imageUrl);
      const pages = t.pagesJson as Array<{ imageUrl?: string }> | null;
      if (Array.isArray(pages)) {
        for (const p of pages) {
          if (p?.imageUrl) addKey(p.imageUrl);
        }
      }
    }
    for (const s of slots) {
      if (s.maskPngUrl) addKey(s.maskPngUrl);
    }

    const templateImages = await listObjectsByPrefix("template-images/");
    for (const obj of templateImages) {
      if (protectedKeys.has(obj.Key)) continue;
      const lastMod = obj.LastModified ? new Date(obj.LastModified) : null;
      if (!lastMod || lastMod >= cutoff) continue;
      try {
        await deleteFromR2(obj.Key);
        imagesDeleted++;
      } catch (e) {
        console.error("[cleanup-disenador] delete R2 template-image error:", e);
        imagesErrors++;
      }
    }

    // 2. PhotobookDocument antiguos
    const oldPhotobookDocs = await prisma.photobookDocument.findMany({
      where: { updatedAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const doc of oldPhotobookDocs) {
      try {
        await prisma.photobookDocument.delete({ where: { id: doc.id } });
        photobookDocsDeleted++;
      } catch (e) {
        console.error("[cleanup-disenador] delete PhotobookDocument error:", e);
      }
    }

    // 3. DesignProject DRAFT antiguos (diseños de fotolibro no enviados)
    const oldDesignProjects = await prisma.designProject.findMany({
      where: {
        status: "DRAFT",
        updatedAt: { lt: cutoff },
      },
      select: { id: true },
    });
    for (const dp of oldDesignProjects) {
      try {
        await prisma.designProject.delete({ where: { id: dp.id } });
        designProjectsDeleted++;
      } catch (e) {
        console.error("[cleanup-disenador] delete DesignProject error:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      imagesDeleted,
      imagesErrors,
      photobookDocsDeleted,
      designProjectsDeleted,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error("[cleanup-disenador] ERROR:", err);
    return NextResponse.json(
      { error: "Error en cleanup-disenador", detail: String(err) },
      { status: 500 }
    );
  }
}
