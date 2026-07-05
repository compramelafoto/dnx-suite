import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await Promise.resolve(params);
  const eventId = Number(resolved.id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const photographers = await prisma.user.findMany({
    where: {
      uploadedPhotos: {
        some: {
          album: { eventId },
          isRemoved: false,
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    items: photographers
      .filter((p) => p.name)
      .map((p) => ({ id: p.id, name: p.name || "" })),
  });
}
