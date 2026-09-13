import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { buildMonthlySummary, type ExpenseStatus, type SummaryEntry } from "@repo/finance-control";
import { previousPeriod } from "@/lib/finance-dnx/expense-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const entries = await prisma.expenseEntry.findMany({
      where: { periodYear: year, periodMonth: month },
      include: { allocations: true, vendor: true },
    });

    const summaryEntries: SummaryEntry[] = entries.map((entry) => ({
      vendorKey: entry.vendor.key,
      amountArsMinor: Math.round(entry.amountArs.toNumber() * 100),
      amountRefundedMinor:
        entry.amountRefunded == null ? undefined : Math.round(entry.amountRefunded.toNumber() * 100),
      status: entry.status as ExpenseStatus,
      allocations: entry.allocations.map((parte) => ({
        platformKey: parte.platformKey,
        sharePercent: parte.sharePercent.toNumber(),
        amountArsMinor: Math.round(parte.amountArs.toNumber() * 100),
      })),
    }));

    const summary = buildMonthlySummary(summaryEntries);

    // Deuda acumulada de verdad: todas las facturas RECHAZADO o IMPAGO que
    // siguen abiertas, sin importar el mes. `summary.debtArsMinor` sólo mira
    // el período pedido, así que no alcanza para saber cuánto se debe en
    // total (la spec define "deuda acumulada" como algo que cruza meses).
    const deudaAcumulada = await prisma.expenseEntry.aggregate({
      _sum: { amountArs: true },
      where: { status: { in: ["RECHAZADO", "IMPAGO"] } },
    });
    const accumulatedDebtArsMinor = Math.round(
      (deudaAcumulada._sum.amountArs?.toNumber() ?? 0) * 100
    );

    // Aviso "te olvidaste de cargar esto": proveedores activos con gasto el
    // mes pasado que todavía no tienen ninguno cargado en el mes pedido.
    const anterior = previousPeriod(year, month);
    const cargadosEsteMs = new Set(entries.map((entry) => entry.vendorId));
    const entradasMesAnterior = await prisma.expenseEntry.findMany({
      where: {
        periodYear: anterior.year,
        periodMonth: anterior.month,
        vendor: { active: true },
        vendorId: { notIn: [...cargadosEsteMs] },
      },
      include: { vendor: true },
    });

    const faltantes = [
      ...new Map(
        entradasMesAnterior.map((entry) => [entry.vendorId, { id: entry.vendor.id, key: entry.vendor.key, name: entry.vendor.name }]),
      ).values(),
    ];

    return NextResponse.json({ summary, faltantes, accumulatedDebtArsMinor });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/summary ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo el resumen", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
