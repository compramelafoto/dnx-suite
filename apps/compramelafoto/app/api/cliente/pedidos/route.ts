import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId es requerido" },
        { status: 400 }
      );
    }

    const id = Number(clientId);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "clientId inválido" },
        { status: 400 }
      );
    }

    // Buscar pedidos donde clientId coincide, o donde customerEmail coincide con el email del usuario
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true },
    });

    if (!user || user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Usuario no encontrado o no es cliente" },
        { status: 404 }
      );
    }

    // Buscar pedidos por clientId o por email del cliente
    const orders = await prisma.printOrder.findMany({
      where: {
        OR: [
          { clientId: id },
          { customerEmail: user.email },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        items: true,
        lab: {
          select: { name: true },
        },
      },
    });

    const rows = orders.map((o) => ({
      id: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      pickupBy: o.pickupBy,
      labName: o.lab?.name ?? "Fotógrafo",
      createdAtText: new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(o.createdAt),
      statusUpdatedAtText: new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(o.statusUpdatedAt),
      itemsCount: o.items.length,
      currency: o.currency,
      total: o.total,
      status: o.status,
      paymentStatus: o.paymentStatus,
    }));

    return NextResponse.json(rows, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/cliente/pedidos ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pedidos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
