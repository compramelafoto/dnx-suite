import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { splitAmountByAllocation } from "@repo/finance-control";
import { parseExpenseForm } from "@/lib/finance-dnx/expense-form";
import { toExpenseEntryJson } from "@/lib/finance-dnx/expense-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const entryId = Number(id);
    if (!Number.isInteger(entryId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
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

    // El importe pudo cambiar, así que el reparto por plataforma se recalcula
    // desde cero: se borran las filas viejas y se recrean sobre el reparto
    // vigente del proveedor. Todo dentro de una transacción para que nunca
    // quede un gasto con un reparto a medio actualizar (las partes tienen
    // que sumar siempre el total).
    const reparto = splitAmountByAllocation(
      value.amountArsMinor,
      vendor.allocations.map((asignacion) => ({
        platformKey: asignacion.platformKey,
        sharePercent: asignacion.sharePercent.toNumber(),
      })),
    );

    const updated = await prisma.$transaction(async (tx) => {
      await tx.expenseEntryAllocation.deleteMany({ where: { entryId } });
      return tx.expenseEntry.update({
        where: { id: entryId },
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
          dueDate: value.dueDate,
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
    });

    return NextResponse.json({ entry: toExpenseEntryJson(updated) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un gasto cargado para ese proveedor en ese período." },
        { status: 409 }
      );
    }
    if (err?.code === "P2025") {
      return NextResponse.json(
        { error: "El gasto que se intenta editar no existe." },
        { status: 404 }
      );
    }
    console.error("PUT /api/admin/finance-dnx/expenses/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando el gasto", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const entryId = Number(id);
    if (!Number.isInteger(entryId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    // El reparto (ExpenseEntryAllocation) se borra solo por el
    // onDelete: CASCADE del esquema; no hace falta borrarlo a mano.
    await prisma.expenseEntry.delete({ where: { id: entryId } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json(
        { error: "El gasto que se intenta borrar no existe." },
        { status: 404 }
      );
    }
    console.error("DELETE /api/admin/finance-dnx/expenses/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error borrando el gasto", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
