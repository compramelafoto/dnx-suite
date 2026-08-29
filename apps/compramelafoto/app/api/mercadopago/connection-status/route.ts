import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getMercadoPagoConnectionHealth } from "@/lib/mercadopago/mp-connection-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
      if (!["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ORGANIZER", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      const data = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mpAccessToken: true, mpUserId: true, mpConnectedAt: true },
      });
      // Un token guardado puede estar vencido: se consulta el estado real contra Mercado Pago.
      const health = data?.mpAccessToken
        ? await getMercadoPagoConnectionHealth({ ownerType: "USER", ownerId: user.id })
        : ({ status: "NOT_CONNECTED", selfHealed: false } as const);
      return NextResponse.json({
        connected: Boolean(data?.mpAccessToken),
        status: health.status,
        mpUserId: data?.mpUserId ?? null,
        updatedAt: data?.mpConnectedAt ? data.mpConnectedAt.toISOString() : null,
      });
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

    const data = await prisma.lab.findUnique({
      where: { id: labId },
      select: { mpAccessToken: true, mpUserId: true, mpConnectedAt: true },
    });

    const labHealth = data?.mpAccessToken
      ? await getMercadoPagoConnectionHealth({ ownerType: "LAB", ownerId: labId })
      : ({ status: "NOT_CONNECTED", selfHealed: false } as const);
    return NextResponse.json({
      connected: Boolean(data?.mpAccessToken),
      status: labHealth.status,
      mpUserId: data?.mpUserId ?? null,
      updatedAt: data?.mpConnectedAt ? data.mpConnectedAt.toISOString() : null,
    });
  } catch (err: any) {
    console.error("GET /api/mercadopago/connection-status ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo estado de conexión", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
