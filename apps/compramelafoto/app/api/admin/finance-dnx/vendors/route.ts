import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { parseVendorForm } from "@/lib/finance-dnx/vendor-form";
import { toVendorJson } from "@/lib/finance-dnx/vendor-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
    return NextResponse.json({ vendors: vendors.map(toVendorJson) });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/vendors ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo los proveedores", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const parsed = parseVendorForm(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    vendorKey = parsed.value.key;
    const { allocations, ...vendor } = parsed.value;
    const created = await prisma.expenseVendor.create({
      data: { ...vendor, allocations: { create: allocations } },
      include: { allocations: true },
    });
    return NextResponse.json({ vendor: toVendorJson(created) }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `Ya existe un proveedor con la clave "${vendorKey ?? ""}".` },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/finance-dnx/vendors ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando el proveedor", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
