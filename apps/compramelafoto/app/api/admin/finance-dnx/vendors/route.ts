import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";

export const dynamic = "force-dynamic";

export async function GET() {
  const vendors = await prisma.expenseVendor.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { allocations: true },
  });
  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  const parsed = parseVendorForm(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { allocations, ...vendor } = parsed.value;
  const created = await prisma.expenseVendor.create({
    data: { ...vendor, allocations: { create: allocations } },
    include: { allocations: true },
  });
  return NextResponse.json({ vendor: created }, { status: 201 });
}
