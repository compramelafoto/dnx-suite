import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import {
  importStudentRosterForAlbum,
  StudentRosterImportError,
} from "@/lib/school-roster/import-student-roster-for-album";
import { readRosterUploadFromRequest } from "@/lib/school-roster/read-roster-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId) || albumId <= 0) return { albumId: null as number | null };
  return { albumId };
}

/**
 * POST /api/dashboard/albums/[id]/student-roster/import
 * Importación del padrón (CSV o Excel).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId } = await resolveAlbumId(context.params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const owned = await findAlbumOwnedByUser(albumId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true, schoolId: true },
    });
    if (!album?.schoolId) {
      return NextResponse.json(
        { error: "El álbum debe estar vinculado a una escuela" },
        { status: 400 }
      );
    }

    const payload = await readRosterUploadFromRequest(req);
    if (!payload?.csvText?.trim()) {
      return NextResponse.json(
        {
          error:
            "Enviá un CSV/Excel: multipart con campo file (.csv/.xlsx/.xls) o JSON { \"csv\": \"...\" }",
        },
        { status: 400 }
      );
    }

    const summary = await importStudentRosterForAlbum({
      prisma,
      albumId,
      actorUserId: user.id,
      csvText: payload.csvText,
      fileName: payload.fileName,
      importMode: payload.importMode,
      academicYearId: payload.academicYearId ?? undefined,
    });

    return NextResponse.json({
      batchId: summary.batchId,
      total: summary.totalRows,
      created: summary.studentsCreated,
      matched: summary.studentsReused,
      skipped: summary.skippedCount,
      errors: summary.errorCount,
      rowErrors: summary.rowErrors,
      enrollmentsCreated: summary.enrollmentsCreated,
      enrollmentsReused: summary.enrollmentsReused,
      rosterLinksCreated: summary.rosterLinksCreated,
      rosterLinksExisting:
        summary.rosterLinksUnchanged +
        summary.rosterLinksSkippedDueToOrders +
        summary.rosterLinksSkippedManual +
        summary.rosterLinksSkippedLocalOverrides,
      rosterLinksUpdated: summary.rosterLinksUpdated,
      duplicateDniWarnings: summary.duplicateDniMatches,
      rosterSkippedDueToOrders: summary.rosterLinksSkippedDueToOrders,
      rosterSkippedManual: summary.rosterLinksSkippedManual,
      rosterSkippedLocalOverrides: summary.rosterLinksSkippedLocalOverrides,
    });
  } catch (e) {
    if (e instanceof StudentRosterImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/dashboard/albums/[id]/student-roster/import:", e);
    return NextResponse.json({ error: "Error al importar alumnos" }, { status: 500 });
  }
}
