import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/lib/prisma";
import { StudentIdentificationMode } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import { gateTestAlbumPublicAccess } from "@/lib/public-album-test-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertPreventaOpenForAlbum(albumId: number): Promise<boolean> {
  const now = new Date();
  const photoCount = await prisma.photo.count({
    where: { albumId, isRemoved: false },
  });
  const packs = await listActivePacksForPublicCatalog(albumId, now, {
    hasPhotos: photoCount > 0,
  });
  return packs.length > 0;
}

function buildNameSearchWhere(q: string): Prisma.AlbumStudentRosterEntryWhereInput {
  const normalized = q.trim().replace(/\s+/g, " ");
  const tokens = normalized.split(" ").filter(Boolean);
  const or: Prisma.AlbumStudentRosterEntryWhereInput[] = [
    { snapshotFirstName: { contains: normalized, mode: "insensitive" } },
    { snapshotLastName: { contains: normalized, mode: "insensitive" } },
  ];

  if (tokens.length >= 2) {
    const firstToken = tokens[0];
    const rest = tokens.slice(1).join(" ");
    or.push(
      {
        AND: [
          { snapshotFirstName: { contains: firstToken, mode: "insensitive" } },
          { snapshotLastName: { contains: rest, mode: "insensitive" } },
        ],
      },
      {
        AND: [
          { snapshotFirstName: { contains: rest, mode: "insensitive" } },
          { snapshotLastName: { contains: firstToken, mode: "insensitive" } },
        ],
      },
      {
        AND: tokens.map((token) => ({
          OR: [
            { snapshotFirstName: { contains: token, mode: "insensitive" } },
            { snapshotLastName: { contains: token, mode: "insensitive" } },
          ],
        })),
      }
    );
  }

  return { OR: or };
}

/**
 * GET /api/public/album/[slug]/student-roster/search?q=...
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = rawSlug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const q = new URL(req.url).searchParams.get("q")?.trim().replace(/\s+/g, " ") || "";
    if (q.length < 3) {
      return NextResponse.json({ error: "La búsqueda requiere al menos 3 letras" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { publicSlug: slug, deletedAt: null },
      select: {
        id: true,
        userId: true,
        isTest: true,
        schoolId: true,
        studentIdentificationMode: true,
      },
    });
    if (!album) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const gate = await gateTestAlbumPublicAccess({
      isTest: album.isTest,
      userId: album.userId,
    });
    if (!gate.ok) return gate.response;

    if (!album.schoolId) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const mode = album.studentIdentificationMode ?? StudentIdentificationMode.NONE;
    if (mode === StudentIdentificationMode.NONE || mode === StudentIdentificationMode.MANUAL) {
      return NextResponse.json({ error: "Listado no disponible" }, { status: 404 });
    }

    const open = await assertPreventaOpenForAlbum(album.id);
    if (!open) {
      return NextResponse.json({ error: "Preventa no disponible" }, { status: 404 });
    }

    const rows = await prisma.albumStudentRosterEntry.findMany({
      where: {
        albumId: album.id,
        isActive: true,
        ...buildNameSearchWhere(q),
      },
      orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }, { id: "asc" }],
      take: 20,
      select: {
        id: true,
        studentId: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        level: true,
        courseName: true,
        division: true,
        shift: true,
      },
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        studentId: row.studentId,
        albumRosterEntryId: row.id,
        firstName: row.snapshotFirstName,
        lastName: row.snapshotLastName,
        level: row.level,
        course: row.courseName,
        division: row.division,
        shift: row.shift,
      }))
    );
  } catch (error) {
    console.error("GET /api/public/album/[slug]/student-roster/search:", error);
    return NextResponse.json({ error: "Error al buscar alumnos" }, { status: 500 });
  }
}
