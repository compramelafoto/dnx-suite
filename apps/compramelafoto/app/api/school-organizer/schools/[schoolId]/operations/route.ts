import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";
import {
  emptyOperationBucketTotals,
  emptyOrganizerCommissionTotals,
  ORGANIZER_COMMISSION_BASE_DESCRIPTION,
} from "@/lib/school-organizer-commission-logic";
import { loadCommissionsByAlbum, loadOrderBucketsByAlbum } from "@/lib/school-organizer-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

/**
 * Reporte de operaciones para el colegio: por álbum, pedidos pagados / pendientes / cancelados /
 * reembolsados (cantidad e importe en pesos), beneficio calculado y liquidaciones registradas.
 * Sólo álbumes de ESTA escuela; excluye pedidos de prueba.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const albums = await prisma.album.findMany({
      where: { schoolId, deletedAt: null, isTest: false },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, organizerCommissionPercentage: true },
    });
    const albumIds = albums.map((a) => a.id);

    const [ordersByAlbum, commissions] = await Promise.all([
      loadOrderBucketsByAlbum(schoolId, albumIds),
      loadCommissionsByAlbum(schoolId),
    ]);

    return NextResponse.json({
      basis: ORGANIZER_COMMISSION_BASE_DESCRIPTION,
      albums: albums.map((album) => ({
        id: album.id,
        title: album.title,
        percentage: album.organizerCommissionPercentage,
        orders: ordersByAlbum.get(album.id) ?? emptyOperationBucketTotals(),
        commission: commissions.byAlbum.get(album.id) ?? emptyOrganizerCommissionTotals(),
      })),
      payouts: commissions.payouts,
    });
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]/operations:", err);
    return NextResponse.json({ error: "Error obteniendo operaciones" }, { status: 500 });
  }
}
