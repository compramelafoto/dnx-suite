import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PhotoStarRating } from "@/lib/simulator/camera-exposure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStars(value: unknown): PhotoStarRating | null {
  const stars = Math.round(Number(value));
  if (!Number.isFinite(stars) || stars < 0 || stars > 5) return null;
  return stars as PhotoStarRating;
}

/** PATCH /api/camofduty/captures/[id] — actualiza estrellas. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  if (!id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { stars?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const stars = parseStars(body.stars);
  if (stars === null) {
    return NextResponse.json({ error: "Clasificación inválida" }, { status: 400 });
  }

  const existing = await prisma.simulatorCapture.findFirst({
    where: { id, userId: user.id, expiresAt: { gt: new Date() } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  await prisma.simulatorCapture.update({
    where: { id },
    data: { stars },
  });

  return NextResponse.json({ ok: true });
}
