import { NextResponse } from "next/server";
import { AlbumMode, Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { parseStoredCourseSlotKeys } from "@/lib/school-roster/course-slot-key";
import { ensureAlbumRosterFromEnrollments } from "@/lib/school-roster/ensure-album-roster-from-enrollments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId) || albumId <= 0) return { albumId: null as number | null };
  return { albumId };
}

/**
 * POST /api/dashboard/albums/[id]/school-roster/sync-from-enrollments
 * Re-sincroniza padrón del álbum con matrícula (`StudentEnrollment`) según año y cursos guardados en el álbum.
 */
export async function POST(
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
    if (album.mode !== AlbumMode.SCHOOL || album.schoolId == null) {
      return NextResponse.json(
        { error: "Sincronización institucional solo aplica a álbumes escolares con escuela vinculada." },
        { status: 400 }
      );
    }
    if (album.academicYearId == null) {
      return NextResponse.json(
        { error: "Este álbum no tiene año lectivo institucional guardado. Configuralo al crear el álbum o desde edición." },
        { status: 400 }
      );
    }

    const keys = parseStoredCourseSlotKeys(album.selectedCourseKeys);
    if (keys.length === 0) {
      return NextResponse.json(
        { error: "No hay cursos institucionales seleccionados en este álbum. Elegí cursos en el asistente o actualizá el álbum." },
        { status: 400 }
      );
    }

    const yearOk = await prisma.academicYear.findFirst({
      where: { id: album.academicYearId, schoolId: album.schoolId },
      select: { id: true },
    });
    if (!yearOk) {
      return NextResponse.json({ error: "El año lectivo guardado ya no existe para esta escuela." }, { status: 400 });
    }

    const summary = await prisma.$transaction((tx) =>
      ensureAlbumRosterFromEnrollments(tx, {
        albumId: album.id,
        schoolId: album.schoolId!,
        academicYearId: album.academicYearId!,
        selectedCourseKeys: keys,
      })
    );

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("POST /api/dashboard/albums/[id]/school-roster/sync-from-enrollments:", e);
    return NextResponse.json({ error: "Error al sincronizar" }, { status: 500 });
  }
}
