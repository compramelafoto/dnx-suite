import type { Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { buildPreCompraPackSummary } from "@/lib/school-roster/build-precompra-pack-summary";

export type SchoolOperationsFilters = {
  q: string;
  level?: string;
  shift?: string;
  courseName?: string;
  division?: string;
  /** vacío = sin filtro; yes/no según query `photosTaken` */
  photosTaken: "" | "yes" | "no";
};

export function parseSchoolOperationsFilters(searchParams: URLSearchParams): SchoolOperationsFilters {
  const pt = searchParams.get("photosTaken")?.trim().toLowerCase();
  let photosTaken: SchoolOperationsFilters["photosTaken"] = "";
  if (pt === "yes") photosTaken = "yes";
  else if (pt === "no") photosTaken = "no";

  return {
    q: searchParams.get("q")?.trim() ?? "",
    level: searchParams.get("level")?.trim() || undefined,
    shift: searchParams.get("shift")?.trim() || undefined,
    courseName: searchParams.get("courseName")?.trim() || undefined,
    division: searchParams.get("division")?.trim() || undefined,
    photosTaken,
  };
}

function buildWhere(albumId: number, filters: SchoolOperationsFilters): Prisma.PreCompraOrderWhereInput {
  const andFilters: Prisma.PreCompraOrderWhereInput[] = [{ albumId }];

  if (filters.level) andFilters.push({ studentLevelSnapshot: filters.level });
  if (filters.shift) andFilters.push({ studentShiftSnapshot: filters.shift });
  if (filters.courseName) andFilters.push({ studentCourseSnapshot: filters.courseName });
  if (filters.division) andFilters.push({ studentDivisionSnapshot: filters.division });

  if (filters.photosTaken === "yes") {
    andFilters.push({ photosTakenAt: { not: null } });
  } else if (filters.photosTaken === "no") {
    andFilters.push({ photosTakenAt: null });
  }

  if (filters.q) {
    const q = filters.q;
    const textOr = [
      { buyerName: { contains: q, mode: "insensitive" as const } },
      { buyerEmail: { contains: q, mode: "insensitive" as const } },
      { studentFirstName: { contains: q, mode: "insensitive" as const } },
      { studentLastName: { contains: q, mode: "insensitive" as const } },
      { studentNotes: { contains: q, mode: "insensitive" as const } },
      { studentLevelSnapshot: { contains: q, mode: "insensitive" as const } },
      { studentShiftSnapshot: { contains: q, mode: "insensitive" as const } },
      { studentCourseSnapshot: { contains: q, mode: "insensitive" as const } },
      { studentDivisionSnapshot: { contains: q, mode: "insensitive" as const } },
      {
        items: {
          some: {
            OR: [
              { packDefinition: { name: { contains: q, mode: "insensitive" as const } } },
              { albumProduct: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          },
        },
      },
    ] satisfies Prisma.PreCompraOrderWhereInput[];
    andFilters.push({ OR: textOr });
  }

  return { AND: andFilters };
}

/** Misma forma que devuelve GET /school-operations (para UI y exportaciones). */
export type SchoolOperationOrderRow = {
  id: number;
  status: string;
  createdAt: string;
  buyerName: string | null;
  buyerEmail: string;
  studentDisplayName: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  level: string | null;
  shift: string | null;
  courseName: string | null;
  division: string | null;
  packSummary: string;
  totalCents: number;
  photosTakenAt: string | null;
  photosTakenByUserId: number | null;
  studentNotes: string | null;
};

export type LoadSchoolOperationsResult =
  | { ok: false; status: 404 | 400; error: string }
  | {
      ok: true;
      albumTitle: string;
      albumPublicSlug: string;
      orders: SchoolOperationOrderRow[];
    };

/**
 * Pedidos de operativo escolar del álbum, con mismos filtros que el listado del dashboard.
 */
export async function loadSchoolOperationsOrders(
  albumId: number,
  userId: number,
  filters: SchoolOperationsFilters
): Promise<LoadSchoolOperationsResult> {
  const owned = await findAlbumOwnedByUser(albumId, userId);
  if (!owned) {
    return { ok: false, status: 404, error: "Álbum no encontrado" };
  }

  const album = await prisma.album.findFirst({
    where: { id: albumId, userId },
    select: { schoolId: true, title: true, publicSlug: true },
  });
  if (!album) {
    return { ok: false, status: 404, error: "Álbum no encontrado" };
  }
  if (!album.schoolId) {
    return {
      ok: false,
      status: 400,
      error: "Esta vista solo aplica a álbumes vinculados a una escuela",
    };
  }

  const where = buildWhere(albumId, filters);

  const rows = await prisma.preCompraOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      items: {
        select: {
          id: true,
          packDefinition: { select: { name: true } },
          albumProduct: { select: { name: true } },
        },
      },
    },
  });

  const orders: SchoolOperationOrderRow[] = rows.map((o) => {
    const itemsForSummary = o.items.map((it) => ({
      packDefinition: it.packDefinition
        ? { name: it.packDefinition.name }
        : it.albumProduct
          ? { name: it.albumProduct.name }
          : null,
    }));
    const packSummary = buildPreCompraPackSummary(itemsForSummary);

    const fn = o.studentFirstName?.trim() ?? "";
    const ln = o.studentLastName?.trim() ?? "";
    const studentDisplayName = ln || fn ? (ln && fn ? `${ln}, ${fn}` : ln || fn) : "—";

    return {
      id: o.id,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      studentDisplayName,
      studentFirstName: o.studentFirstName,
      studentLastName: o.studentLastName,
      level: o.studentLevelSnapshot,
      shift: o.studentShiftSnapshot,
      courseName: o.studentCourseSnapshot,
      division: o.studentDivisionSnapshot,
      packSummary,
      totalCents: o.totalCents,
      photosTakenAt: o.photosTakenAt?.toISOString() ?? null,
      photosTakenByUserId: o.photosTakenByUserId,
      studentNotes: o.studentNotes,
    };
  });

  return {
    ok: true,
    albumTitle: album.title,
    albumPublicSlug: album.publicSlug,
    orders,
  };
}
