import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_AVATAR, isAvatarFigure } from "@/lib/simulator/street/third-person";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/camofduty/avatar — el avatar elegido por el fotógrafo. */
export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const row = await prisma.camOfDutyAvatar.findUnique({ where: { userId: user.id } }).catch(() => null);
  return NextResponse.json({ figureId: row && isAvatarFigure(row.figureId) ? row.figureId : DEFAULT_AVATAR });
}

/** PUT /api/camofduty/avatar — { figureId }: guarda el avatar en el perfil. */
export async function PUT(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { figureId?: unknown } | null;
  if (!isAvatarFigure(body?.figureId)) return NextResponse.json({ error: "Avatar inválido" }, { status: 400 });
  try {
    await prisma.camOfDutyAvatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, figureId: body.figureId },
      update: { figureId: body.figureId },
    });
    return NextResponse.json({ figureId: body.figureId });
  } catch (err) {
    console.error("[camofduty] no se pudo guardar el avatar", { userId: user.id, err });
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
