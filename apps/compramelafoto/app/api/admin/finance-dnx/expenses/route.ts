import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { splitAmountByAllocation } from "@repo/finance-control";
import { parseExpenseForm } from "@/lib/finance-dnx/expense-form";
import { toExpenseEntryJson } from "@/lib/finance-dnx/expense-json";

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
      orderBy: { vendor: { name: "asc" } },
    });

    return NextResponse.json({ entries: entries.map(toExpenseEntryJson) });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/expenses ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo los gastos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const parsed = parseExpenseForm(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { value } = parsed;

    const vendor = await prisma.expenseVendor.findUnique({
      where: { id: value.vendorId },
      include: { allocations: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "El proveedor no existe." }, { status: 400 });
    }

    const reparto = splitAmountByAllocation(
      value.amountArsMinor,
      vendor.allocations.map((asignacion) => ({
        platformKey: asignacion.platformKey,
        sharePercent: asignacion.sharePercent.toNumber(),
      })),
    );

    const created = await prisma.expenseEntry.create({
      data: {
        vendorId: value.vendorId,
        periodYear: value.periodYear,
        periodMonth: value.periodMonth,
        amountOriginal: value.amountOriginalMinor / 100,
        currency: value.currency,
        fxRate: value.fxRate,
        taxPercent: value.taxPercent,
        amountArs: value.amountArsMinor / 100,
        status: value.status,
        source: "MANUAL",
        notes: value.notes,
        allocations: {
          create: reparto.map((parte) => ({
            platformKey: parte.platformKey,
            sharePercent: parte.sharePercent,
            amountArs: parte.amountArsMinor / 100,
          })),
        },
      },
      include: { allocations: true, vendor: true },
    });

    return NextResponse.json({ entry: toExpenseEntryJson(created) }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un gasto cargado para ese proveedor en ese período." },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/finance-dnx/expenses ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando el gasto", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
