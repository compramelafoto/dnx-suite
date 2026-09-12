import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendorId = Number(id);
  if (!Number.isInteger(vendorId)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const parsed = parseVendorForm(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { allocations, ...vendor } = parsed.value;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.vendorAllocation.deleteMany({ where: { vendorId } });
    return tx.expenseVendor.update({
      where: { id: vendorId },
      data: { ...vendor, allocations: { create: allocations } },
      include: { allocations: true },
    });
  });

  return NextResponse.json({ vendor: updated });
}
