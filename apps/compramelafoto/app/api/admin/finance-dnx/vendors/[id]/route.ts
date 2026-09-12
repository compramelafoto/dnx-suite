import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";
import { toVendorJson } from "@/lib/finance-dnx/vendor-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let vendorKey: string | undefined;
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
    const vendorId = Number(id);
    if (!Number.isInteger(vendorId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const parsed = parseVendorForm(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    vendorKey = parsed.value.key;
    const { allocations, ...vendor } = parsed.value;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.vendorAllocation.deleteMany({ where: { vendorId } });
      return tx.expenseVendor.update({
        where: { id: vendorId },
        data: { ...vendor, allocations: { create: allocations } },
        include: { allocations: true },
      });
    });

    return NextResponse.json({ vendor: toVendorJson(updated) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `Ya existe un proveedor con la clave "${vendorKey ?? ""}".` },
        { status: 409 }
      );
    }
    console.error("PUT /api/admin/finance-dnx/vendors/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando el proveedor", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
