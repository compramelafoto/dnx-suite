import { NextResponse } from "next/server";
import { AlbumMode, Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { parseStoredCourseSlotKeys } from "@/lib/school-roster/course-slot-key";
import { previewInstitutionalAlbumRosterSync } from "@/lib/school-roster/sync-institutional-album-roster-enrollments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId) || albumId <= 0) return { albumId: null as number | null };
  return { albumId };
}

/**
 * GET /api/dashboard/albums/[id]/school-roster/sync-preview
 * Vista previa read-only para «Ver diferencias» (cards + tabla recomendaciones).
 */
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> }
) {
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
      where: { id: albumId, userId: user.id, deletedAt: null },
      select: {
        id: true,
        mode: true,
        schoolId: true,
        academicYearId: true,
        selectedCourseKeys: true,
      },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const keys = parseStoredCourseSlotKeys(album.selectedCourseKeys);
    const canPreview =
      album.mode === AlbumMode.SCHOOL &&
      album.schoolId != null &&
      album.academicYearId != null &&
      keys.length > 0;

    if (!canPreview) {
      return NextResponse.json({
        ok: true,
        available: false,
        reason: "Solo hay vista previa con álbum escolar, año lectivo guardado y cursos seleccionados.",
        preview: null,
      });
    }

    const schoolIdN = album.schoolId!;
    const academicYearIdN = album.academicYearId!;

    const yearOk = await prisma.academicYear.findFirst({
      where: { id: academicYearIdN, schoolId: schoolIdN },
      select: { id: true },
    });
    if (!yearOk) {
      return NextResponse.json({
        ok: false,
        error: "El año lectivo guardado ya no existe para esta escuela.",
      }, { status: 400 });
    }

    const preview = await previewInstitutionalAlbumRosterSync(prisma, {
      albumId: album.id,
      schoolId: schoolIdN,
      academicYearId: academicYearIdN,
      selectedCourseKeys: keys,
    });

    return NextResponse.json({
      ok: true,
      available: true,
      preview,
    });
  } catch (e) {
    console.error("GET /api/dashboard/albums/[id]/school-roster/sync-preview:", e);
    return NextResponse.json({ error: "Error en vista previa" }, { status: 500 });
  }
}
