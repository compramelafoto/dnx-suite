import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20); // Máximo 20 resultados por tipo

    if (!q || q.length < 2) {
      return NextResponse.json({
        orders: [],
        users: [],
        labs: [],
        albums: [],
        total: 0,
      });
    }

    const searchTerm = q.toLowerCase();

    // Buscar en pedidos (PrintOrder)
    const orders = await prisma.printOrder.findMany({
      where: {
        OR: [
          { id: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { mpPaymentId: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        total: true,
        status: true,
        createdAt: true,
        lab: {
          select: {
            id: true,
            name: true,
          },
        },
        photographer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Buscar en usuarios (User)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { handler: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        handler: true,
        createdAt: true,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Buscar en laboratorios (Lab)
    const labs = await prisma.lab.findMany({
      where: {
        OR: [
          { id: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { publicPageHandler: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        province: true,
        approvalStatus: true,
        isActive: true,
        createdAt: true,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Buscar en álbumes (Album)
    const albums = await prisma.album.findMany({
      where: {
        OR: [
          { id: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { title: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { publicSlug: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        location: true,
        publicSlug: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            handler: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Buscar en precios base de laboratorios (LabBasePrice)
    const labPrices = await prisma.labBasePrice.findMany({
      where: {
        OR: [
          { size: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        size: true,
        unitPrice: true,
        isActive: true,
        lab: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
      orderBy: { labId: "asc" },
    });

    // Buscar en productos de laboratorios (LabProduct)
    const labProducts = await prisma.labProduct.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { size: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        size: true,
        photographerPrice: true,
        retailPrice: true,
        lab: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
      orderBy: { labId: "asc" },
    });

    // Buscar en tickets de soporte (SupportTicket)
    const tickets = await prisma.supportTicket.findMany({
      where: {
        OR: [
          { id: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { reason: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        printOrder: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = orders.length + users.length + labs.length + albums.length + labPrices.length + labProducts.length + tickets.length;

    return NextResponse.json({
      orders,
      users,
      labs,
      albums,
      labPrices,
      labProducts,
      tickets,
      total,
    });
  } catch (err: any) {
    console.error("GET /api/admin/search ERROR >>>", err);
    return NextResponse.json(
      { error: "Error en búsqueda", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
