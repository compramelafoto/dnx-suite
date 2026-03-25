import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("ownerType");

    if (ownerType !== "USER" && ownerType !== "LAB") {
      return NextResponse.json({ error: "ownerType inválido" }, { status: 400 });
    }

    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    if (ownerType === "USER") {
      if (!["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mpAccessToken: null,
          mpRefreshToken: null,
          mpUserId: null,
          mpConnectedAt: null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (!["LAB", "LAB_PHOTOGRAPHER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const labId = user.labId ?? (await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true },
    }))?.id;

    if (!labId) {
      return NextResponse.json({ error: "No se encontró laboratorio asociado" }, { status: 404 });
    }

    await prisma.lab.update({
      where: { id: labId },
      data: {
        mpAccessToken: null,
        mpRefreshToken: null,
        mpUserId: null,
        mpConnectedAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/mercadopago/disconnect ERROR >>>", err);
    return NextResponse.json(
      { error: "Error desconectando Mercado Pago", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
