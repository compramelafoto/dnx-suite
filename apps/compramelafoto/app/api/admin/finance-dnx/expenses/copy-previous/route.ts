import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { previousPeriod } from "@/lib/finance-dnx/expense-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const { year, month } = (await req.json()) as { year: number; month: number };
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }

    const anterior = previousPeriod(year, month);

    const origen = await prisma.expenseEntry.findMany({
      where: {
        periodYear: anterior.year,
        periodMonth: anterior.month,
        vendor: { active: true },
      },
      include: { allocations: true },
    });

    const yaCargados = await prisma.expenseEntry.findMany({
      where: { periodYear: year, periodMonth: month },
      select: { vendorId: true },
    });
    const ocupados = new Set(yaCargados.map((entrada) => entrada.vendorId));

    // Se omiten los proveedores que ya tienen gasto en el mes destino: la
    // restricción única lo impediría igual, pero fallar a mitad dejaría la
    // copia incompleta y sin aviso.
    const aCopiar = origen.filter((entrada) => !ocupados.has(entrada.vendorId));

    const creados = await prisma.$transaction(
      aCopiar.map((entrada) =>
        prisma.expenseEntry.create({
          data: {
            vendorId: entrada.vendorId,
            periodYear: year,
            periodMonth: month,
            amountOriginal: entrada.amountOriginal,
            currency: entrada.currency,
            fxRate: entrada.fxRate,
            taxPercent: entrada.taxPercent,
            amountArs: entrada.amountArs,
            // Se copia como estimado: son los números del mes pasado hasta que
            // llegue la factura de verdad.
            status: "ESTIMADO",
            source: "MANUAL",
            allocations: {
              create: entrada.allocations.map((parte) => ({
                platformKey: parte.platformKey,
                sharePercent: parte.sharePercent,
                amountArs: parte.amountArs,
              })),
            },
          },
        }),
      ),
    );

    return NextResponse.json({
      copiados: creados.length,
      omitidos: origen.length - aCopiar.length,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "La copia no se completó porque otros gastos fueron creados mientras se copiaba. Intentá de nuevo." },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/finance-dnx/expenses/copy-previous ERROR >>>", err);
    return NextResponse.json(
      { error: "Error copiando los gastos del mes anterior", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
