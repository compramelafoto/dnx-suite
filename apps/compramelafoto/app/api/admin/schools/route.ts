import { NextRequest, NextResponse } from "next/server";
import { Role, type Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SchoolRow = {
  id: number;
  name: string;
  logoUrl: string | null;
  city: string | null;
  province: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: number; name: string | null; email: string };
  students: Array<{ id: number }>;
  albums: Array<{
    id: number;
    title: string;
    publicSlug: string;
    isHidden: boolean;
    preCompraCloseAt: Date | null;
    user: { id: number; name: string | null; email: string };
  }>;
};

function parseBooleanFilter(value: string | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const ownerIdParam = searchParams.get("ownerId");
    const ownerId =
      ownerIdParam && Number.isFinite(Number(ownerIdParam)) ? Number(ownerIdParam) : null;
    const hasActiveAlbums = parseBooleanFilter(searchParams.get("hasActiveAlbums"));
    const withoutAlbums = parseBooleanFilter(searchParams.get("withoutAlbums"));
    const hasPreventaActive = parseBooleanFilter(searchParams.get("hasPreventaActive"));
    const hasStudents = parseBooleanFilter(searchParams.get("hasStudents"));

    const andFilters: Prisma.SchoolWhereInput[] = [];

    if (ownerId != null) {
      andFilters.push({ ownerId });
    }

    if (q) {
      const searchOr: Prisma.SchoolWhereInput[] = [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { province: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
        { contactPhone: { contains: q, mode: "insensitive" } },
        { owner: { name: { contains: q, mode: "insensitive" } } },
        { owner: { email: { contains: q, mode: "insensitive" } } },
        {
          albums: {
            some: {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { publicSlug: { contains: q, mode: "insensitive" } },
                { user: { name: { contains: q, mode: "insensitive" } } },
                { user: { email: { contains: q, mode: "insensitive" } } },
              ],
            },
          },
        },
      ];
      andFilters.push({ OR: searchOr });
    }

    if (withoutAlbums === true) {
      andFilters.push({ albums: { none: { deletedAt: null } } });
    } else if (withoutAlbums === false) {
      andFilters.push({ albums: { some: { deletedAt: null } } });
    }

    if (hasActiveAlbums === true) {
      andFilters.push({ albums: { some: { deletedAt: null, isHidden: false } } });
    } else if (hasActiveAlbums === false) {
      andFilters.push({
        OR: [{ albums: { none: { deletedAt: null } } }, { albums: { every: { isHidden: true } } }],
      });
    }

    const now = new Date();
    if (hasPreventaActive === true) {
      andFilters.push({
        albums: { some: { deletedAt: null, preCompraCloseAt: { gte: now } } },
      });
    } else if (hasPreventaActive === false) {
      andFilters.push({
        OR: [
          { albums: { none: { deletedAt: null } } },
          { albums: { every: { OR: [{ preCompraCloseAt: null }, { preCompraCloseAt: { lt: now } }] } } },
        ],
      });
    }

    if (hasStudents === true) {
      andFilters.push({ students: { some: {} } });
    } else if (hasStudents === false) {
      andFilters.push({ students: { none: {} } });
    }

    const where: Prisma.SchoolWhereInput =
      andFilters.length > 0 ? { AND: andFilters } : {};

    const schools = (await prisma.school.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        city: true,
        province: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        students: { select: { id: true } },
        albums: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            publicSlug: true,
            isHidden: true,
            preCompraCloseAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })) as SchoolRow[];

    const schoolIds = schools.map((school) => school.id);
    const preCompraBySchool = schoolIds.length
      ? await prisma.preCompraOrder.groupBy({
          by: ["albumId"],
          where: { album: { schoolId: { in: schoolIds } } },
          _count: { _all: true },
        })
      : [];

    const preCompraByAlbumId = new Map<number, number>();
    for (const row of preCompraBySchool) {
      preCompraByAlbumId.set(row.albumId, row._count._all);
    }

    const rows = schools.map((school) => {
      const photographers = new Map<number, { id: number; name: string | null; email: string }>();
      photographers.set(school.owner.id, school.owner);
      for (const album of school.albums) {
        photographers.set(album.user.id, album.user);
      }
      const preCompraCount = school.albums.reduce(
        (acc, album) => acc + (preCompraByAlbumId.get(album.id) ?? 0),
        0
      );
      const activeAlbumsCount = school.albums.filter((album) => !album.isHidden).length;
      const preventaActiveCount = school.albums.filter(
        (album) => album.preCompraCloseAt && album.preCompraCloseAt >= now
      ).length;

      return {
        id: school.id,
        name: school.name,
        logoUrl: school.logoUrl,
        city: school.city,
        province: school.province,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        createdAt: school.createdAt,
        updatedAt: school.updatedAt,
        owner: school.owner,
        albumsCount: school.albums.length,
        activeAlbumsCount,
        studentsCount: school.students.length,
        preCompraOrdersCount: preCompraCount,
        preventaActiveCount,
        photographers: [...photographers.values()],
      };
    });

    const owners = Array.from(
      new Map(
        rows.map((row) => [row.owner.id, row.owner] as const)
      ).values()
    ).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "es"));

    return NextResponse.json({ schools: rows, owners });
  } catch (err) {
    console.error("GET /api/admin/schools:", err);
    return NextResponse.json({ error: "Error obteniendo escuelas" }, { status: 500 });
  }
}
