import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/lab/clientes/[email]
 * Actualizar datos de un cliente (actualiza todos sus pedidos)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { email: string } | Promise<{ email: string }> }
) {
  try {
    const { email } = await Promise.resolve(params);
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json().catch(() => ({}));
    const { labId, name, phone } = body;

    if (!labId || !Number.isFinite(Number(labId))) {
      return NextResponse.json(
        { error: "labId es requerido" },
        { status: 400 }
      );
    }

    const id = Number(labId);

    // Actualizar todos los pedidos del cliente con este email
    const result = await prisma.printOrder.updateMany({
      where: {
        labId: id,
        customerEmail: decodedEmail,
      },
      data: {
        ...(name !== undefined && { customerName: name.trim() || null }),
        ...(phone !== undefined && { customerPhone: phone.trim() || null }),
      },
    });

    return NextResponse.json(
      { success: true, updated: result.count },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PATCH /api/lab/clientes/[email] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando cliente", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lab/clientes/[email]
 * Eliminar registros de notificaciones de un cliente (solo elimina pedidos CANCELED con total 0)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { email: string } | Promise<{ email: string }> }
) {
  try {
    const { email } = await Promise.resolve(params);
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json().catch(() => ({}));
    const { labId } = body;

    if (!labId || !Number.isFinite(Number(labId))) {
      return NextResponse.json(
        { error: "labId es requerido" },
        { status: 400 }
      );
    }

    const id = Number(labId);

    // Eliminar solo pedidos CANCELED con total 0 (los "fantasma" creados para notificaciones)
    const deletedOrders = await prisma.printOrder.deleteMany({
      where: {
        labId: id,
        customerEmail: decodedEmail,
        status: "CANCELED",
        total: 0,
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        deletedOrders: deletedOrders.count 
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("DELETE /api/lab/clientes/[email] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando cliente", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
