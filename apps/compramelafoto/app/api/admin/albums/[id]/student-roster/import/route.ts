import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  importStudentRosterForAlbum,
  StudentRosterImportError,
} from "@/lib/school-roster/import-student-roster-for-album";
import { readRosterUploadFromRequest } from "@/lib/school-roster/read-roster-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const albumId = parseInt(id, 10);
    if (!Number.isInteger(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, schoolId: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if (!album.schoolId) {
      return NextResponse.json(
        { error: "El álbum debe estar vinculado a una escuela" },
        { status: 400 }
      );
    }
    const schoolIdParam = req.nextUrl.searchParams.get("schoolId");
    if (schoolIdParam) {
      const schoolId = parseInt(schoolIdParam, 10);
      if (!Number.isInteger(schoolId) || schoolId <= 0) {
        return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
      }
      if (album.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "El álbum seleccionado no pertenece a esta escuela" },
          { status: 403 }
        );
      }
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

    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof StudentRosterImportError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/albums/[id]/student-roster/import", err);
    return NextResponse.json(
      { error: "No se pudo importar alumnos en este momento" },
      { status: 500 }
    );
  }
}
