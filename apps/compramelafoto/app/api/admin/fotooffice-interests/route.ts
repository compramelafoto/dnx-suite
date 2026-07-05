import { NextResponse } from "next/server";
import { Role, type Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type FotoOfficeInterestAdminRow = {
  id: string;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  email: string | null;
  name: string | null;
  source: string;
  interestType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** GET /api/admin/fotooffice-interests — listado de interesados en FotoOffice. */
export async function GET(request: Request) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const where: Prisma.FotoOfficeInterestWhereInput = {};
  if (q.length >= 2) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.fotoOfficeInterest.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  const mapped: FotoOfficeInterestAdminRow[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userEmail: row.user?.email ?? null,
    userName: row.user?.name ?? null,
    email: row.email,
    name: row.name,
    source: row.source,
    interestType: row.interestType,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return NextResponse.json({ rows: mapped });
}
