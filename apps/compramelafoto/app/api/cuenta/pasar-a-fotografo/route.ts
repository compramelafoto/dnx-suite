import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PHOTOGRAPHER_COVERAGE_RADIUS_KM,
  decideCustomerToPhotographer,
} from "@/lib/cuenta/customer-to-photographer";
import { CLF_POST_LOGIN_PATHS } from "@/lib/auth/post-login-destination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cuenta/pasar-a-fotografo
 * Pasa a fotógrafo una cuenta que se registró como cliente por error.
 * Sólo si nunca compró (pedidos, precompras ni impresiones, por id o por email).
 */
export async function POST() {
  try {
    const { error, user } = await requireAuth([Role.CUSTOMER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const email = user.email.trim();
    const byEmail = { equals: email, mode: "insensitive" as const };
    const [orders, preCompras, printOrders] = await Promise.all([
      prisma.order.count({ where: { OR: [{ buyerUserId: user.id }, { buyerEmail: byEmail }] } }),
      prisma.preCompraOrder.count({
        where: { OR: [{ buyerUserId: user.id }, { buyerEmail: byEmail }] },
      }),
      prisma.printOrder.count({ where: { OR: [{ clientId: user.id }, { customerEmail: byEmail }] } }),
    ]);

    const decision = decideCustomerToPhotographer({
      role: user.role,
      purchaseCount: orders + preCompras + printOrders,
    });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.message, reason: decision.reason }, { status: 409 });
    }

    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { workingCoverageRadiusKm: true },
    });
    await prisma.user.update({
      where: { id: user.id, role: Role.CUSTOMER },
      data: {
        role: Role.PHOTOGRAPHER,
        workingCoverageRadiusKm:
          current?.workingCoverageRadiusKm ?? DEFAULT_PHOTOGRAPHER_COVERAGE_RADIUS_KM,
      },
    });

    return NextResponse.json({ success: true, redirect: CLF_POST_LOGIN_PATHS.PHOTOGRAPHER });
  } catch (err: unknown) {
    console.error("POST /api/cuenta/pasar-a-fotografo ERROR >>>", err);
    return NextResponse.json({ error: "No pudimos cambiar tu cuenta" }, { status: 500 });
  }
}
