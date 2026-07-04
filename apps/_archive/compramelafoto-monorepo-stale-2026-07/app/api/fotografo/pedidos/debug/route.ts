import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fotografo/pedidos/debug
 * Diagnóstico: userId, role, labId, conteos de pedidos por criterio.
 * Usar solo para depuración; eliminar en producción.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.LAB,
      Role.ADMIN,
    ]);

    if (error || !user) {
      return NextResponse.json(
        {
          error: error || "No autenticado",
          ok: false,
          hint: "Iniciá sesión en /fotografo/login y volvé a abrir esta URL en la misma pestaña.",
        },
        { status: 401 }
      );
    }

    const id = user.id;

    let labId: number | null = null;
    if (user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.LAB) {
      const lab = await prisma.lab.findUnique({
        where: { userId: id },
        select: { id: true, name: true },
      });
      if (lab) labId = lab.id;
    }

    const [countByPhotographer, countByLab, totalPrintOrders] = await Promise.all([
      prisma.printOrder.count({ where: { photographerId: id } }),
      labId != null ? prisma.printOrder.count({ where: { labId } }) : Promise.resolve(0),
      prisma.printOrder.count({
        where:
          labId != null
            ? { OR: [{ photographerId: id }, { labId }] }
            : { photographerId: id },
      }),
    ]);

    const digitalCount = await prisma.order.count({
      where: {
        OR: [
          { album: { userId: id } },
          { album: { photos: { some: { userId: id } } } },
        ],
        status: { in: ["PAID", "PENDING", "FAILED"] },
      },
    });

    return NextResponse.json({
      ok: true,
      userId: id,
      role: user.role,
      labId,
      counts: {
        printByPhotographerId: countByPhotographer,
        printByLabId: countByLab,
        totalPrintOrders,
        digitalOrders: digitalCount,
      },
    });
  } catch (err: any) {
    console.error("GET /api/fotografo/pedidos/debug ERROR >>>", err);
    return NextResponse.json(
      { error: String(err?.message ?? err), ok: false },
      { status: 500 }
    );
  }
}
