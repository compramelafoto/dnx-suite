import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Verificar autenticación y rol ADMIN
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json(
      { error: error || "No autorizado. Se requiere rol ADMIN." },
      { status: 401 }
    );
  }

  const vendors = await prisma.expenseVendor.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { allocations: true },
  });
  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  // Verificar autenticación y rol ADMIN
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json(
      { error: error || "No autorizado. Se requiere rol ADMIN." },
      { status: 401 }
    );
  }

  const parsed = parseVendorForm(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { allocations, ...vendor } = parsed.value;
  const created = await prisma.expenseVendor.create({
    data: { ...vendor, allocations: { create: allocations } },
    include: { allocations: true },
  });
  return NextResponse.json({ vendor: created }, { status: 201 });
}
