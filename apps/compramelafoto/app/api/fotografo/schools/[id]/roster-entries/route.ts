import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TAKE = 800;
const DEFAULT_TAKE = 500;

/**
 * GET /api/fotografo/schools/[id]/roster-entries
 * Listado consolidado por escuela usando `AlbumStudentRosterEntry` (modelo legacy por álbum).
 * Solo dueño fotógrafo de la escuela.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const schoolId = parseInt(id, 10);
    if (!Number.isFinite(schoolId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const owned = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, ownerId: true },
    });
    if (!owned || owned.ownerId !== user.id) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const sp = new URL(req.url).searchParams;
    const rawTake = parseInt(sp.get("take") || String(DEFAULT_TAKE), 10);
    const take = Number.isFinite(rawTake) ? Math.min(Math.max(rawTake, 1), MAX_TAKE) : DEFAULT_TAKE;

    const entries = await prisma.albumStudentRosterEntry.findMany({
      where: { schoolId, isActive: true },
      take,
      orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        albumId: true,
        studentId: true,
        level: true,
        shift: true,
        courseName: true,
        division: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        isActive: true,
        student: {
          select: {
            externalStudentId: true,
            dni: true,
          },
        },
        album: {
          select: {
            id: true,
            title: true,
            eventDate: true,
          },
        },
      },
    });

    return NextResponse.json({ entries, take, truncatedHint: entries.length >= take });
  } catch (e) {
    console.error("GET /api/fotografo/schools/[id]/roster-entries:", e);
    return NextResponse.json({ error: "Error al obtener el padrón" }, { status: 500 });
  }
}
