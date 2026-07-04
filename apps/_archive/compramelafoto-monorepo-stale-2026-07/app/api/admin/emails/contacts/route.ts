import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const [users, interests] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, name: true, role: true },
      take: 20,
    }),
    prisma.albumInterest.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        album: { select: { id: true, title: true } },
      },
      take: 20,
    }),
  ]);

  const items = [
    ...users.map((u) => ({
      type: "USER",
      id: u.id,
      email: u.email,
      name: u.name,
      meta: u.role,
    })),
    ...interests.map((i) => ({
      type: "ALBUM_INTEREST",
      id: i.id,
      email: i.email,
      name: i.firstName || i.name || null,
      meta: i.album?.title || null,
    })),
  ];

  return NextResponse.json({ items });
}
