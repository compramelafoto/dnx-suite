import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: Crear ticket (público, pero puede estar autenticado)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      printOrderId,
      reason,
      description,
      requesterName,
      requesterEmail,
      requesterPhone,
      requesterRole,
    } = body;

    // Validaciones básicas
    if (!reason || !description) {
      return NextResponse.json(
        { error: "El motivo y la descripción son requeridos" },
        { status: 400 }
      );
    }

    // Intentar obtener usuario autenticado (opcional)
    let userId: number | null = null;
    let userRole: string | null = null;
    let userName: string | null = null;
    let userEmail: string | null = null;
    let userPhone: string | null = null;

    try {
      const authResult = await getAuthUser();
      if (authResult) {
        userId = authResult.id;
        userRole = authResult.role;
        userName = authResult.name || null;
        userEmail = authResult.email;
        // phone no está en AuthUser, necesitamos obtenerlo de la BD si es necesario
        userPhone = null;
      }
    } catch (e) {
      // Usuario no autenticado, continuar con datos del formulario
    }

    // Si hay un printOrderId, verificar que existe y que el usuario tiene acceso
    if (printOrderId) {
      const orderId = parseInt(printOrderId);
      const order = await prisma.printOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          clientId: true,
          photographerId: true,
          labId: true,
        },
      });

      if (!order) {
        return NextResponse.json(
          { error: "El pedido no existe" },
          { status: 404 }
        );
      }

      // Verificar que el usuario tiene acceso al pedido
      if (userId) {
        const hasAccess =
          order.clientId === userId ||
          order.photographerId === userId ||
          (userRole === Role.ADMIN);
        if (!hasAccess) {
          return NextResponse.json(
            { error: "No tenés acceso a este pedido" },
            { status: 403 }
          );
        }
      }
    }

    // Determinar el rol del solicitante
    let finalRequesterRole = requesterRole || userRole || "OTHER";
    if (finalRequesterRole === "CLIENT") {
      finalRequesterRole = "CUSTOMER";
    }

    // Crear el ticket
    const ticket = await prisma.supportTicket.create({
      data: {
        printOrderId: printOrderId ? parseInt(printOrderId) : null,
        reason,
        description,
        requesterName: requesterName || userName || null,
        requesterEmail: requesterEmail || userEmail || null,
        requesterPhone: requesterPhone || userPhone || null,
        requesterRole: finalRequesterRole,
        status: "OPEN",
      },
    });

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err: any) {
    console.error("POST /api/support/tickets ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando ticket", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// GET: Obtener tickets del usuario autenticado
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "Debés iniciar sesión para ver tus tickets" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const printOrderId = searchParams.get("printOrderId");

    const where: any = {};

    // Filtrar por pedido si se especifica
    if (printOrderId) {
      where.printOrderId = parseInt(printOrderId);
    } else {
      // Incluir tickets por acceso al pedido O por email del solicitante (tickets sin pedido vinculado)
      if (user.role === Role.CUSTOMER) {
        where.OR = [
          { printOrder: { clientId: user.id } },
          { printOrderId: null, requesterEmail: user.email },
        ];
      } else if (user.role === Role.PHOTOGRAPHER || user.role === Role.LAB_PHOTOGRAPHER) {
        where.OR = [
          { printOrder: { photographerId: user.id } },
          { printOrderId: null, requesterEmail: user.email },
        ];
      } else if (user.role === Role.LAB) {
        const lab = await prisma.lab.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });
        if (lab) {
          where.OR = [
            { printOrder: { labId: lab.id } },
            { printOrderId: null, requesterEmail: user.email },
          ];
        } else {
          return NextResponse.json({ tickets: [] });
        }
      } else if (user.role !== Role.ADMIN) {
        where.requesterEmail = user.email;
      }
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        printOrder: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (err: any) {
    console.error("GET /api/support/tickets ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo tickets", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
