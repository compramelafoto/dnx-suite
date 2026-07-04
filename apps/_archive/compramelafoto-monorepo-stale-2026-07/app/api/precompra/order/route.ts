import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/precompra/order
 * Crear pedido de pre-venta. Body: { albumId, buyerEmail, buyerName?, buyerPhone?, schoolCourseId?, studentFirstName?, studentLastName?, items }
 * Si es álbum escolar (schoolId), schoolCourseId, studentFirstName, studentLastName son requeridos.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const albumId = Number(body.albumId);
    const buyerEmail = String(body.buyerEmail ?? "").trim();
    const buyerUserId = body.buyerUserId != null ? Number(body.buyerUserId) : null;
    const buyerName = body.buyerName ? String(body.buyerName).trim() : null;
    const buyerPhone = body.buyerPhone ? String(body.buyerPhone).trim() : null;
    const schoolCourseId = body.schoolCourseId != null ? Number(body.schoolCourseId) : null;
    const studentFirstName = body.studentFirstName ? String(body.studentFirstName).trim() : null;
    const studentLastName = body.studentLastName ? String(body.studentLastName).trim() : null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!Number.isInteger(albumId) || albumId <= 0 || !buyerEmail) {
      return NextResponse.json(
        { error: "albumId y buyerEmail son requeridos" },
        { status: 400 }
      );
    }

    const now = new Date();
    const album = await prisma.album.findFirst({
      where: {
        id: albumId,
        deletedAt: null,
        preCompraCloseAt: { not: null, gte: now },
      },
      include: { preCompraProducts: true, school: { include: { courses: true } } },
    });

    if (!album) {
      return NextResponse.json(
        { error: "Álbum no encontrado o pre-venta cerrada" },
        { status: 404 }
      );
    }

    const isSchool = !!album.schoolId && !!album.school;
    if (isSchool) {
      if (!schoolCourseId || !Number.isFinite(schoolCourseId)) {
        return NextResponse.json({ error: "Seleccioná el curso/división del alumno" }, { status: 400 });
      }
      if (!studentFirstName?.trim()) {
        return NextResponse.json({ error: "El nombre del alumno es requerido" }, { status: 400 });
      }
      if (!studentLastName?.trim()) {
        return NextResponse.json({ error: "El apellido del alumno es requerido" }, { status: 400 });
      }
      const courseExists = album.school?.courses.some((c) => c.id === schoolCourseId);
      if (!courseExists) {
        return NextResponse.json({ error: "Curso no válido para esta escuela" }, { status: 400 });
      }
    }

    const productIds = new Set(album.preCompraProducts.map((p) => p.id));
    let totalCents = 0;
    const orderItems: { albumProductId: number; priceCents: number; quantity: number }[] = [];

    for (const it of items) {
      const pid = Number(it.albumProductId);
      const qty = Math.max(1, Math.min(100, Number(it.quantity) || 1));
      if (!productIds.has(pid)) continue;
      const product = album.preCompraProducts.find((p) => p.id === pid);
      if (!product) continue;
      const priceCents = product.price * 100;
      orderItems.push({ albumProductId: pid, priceCents, quantity: qty });
      totalCents += priceCents * qty;
    }

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: "Agregá al menos un producto" },
        { status: 400 }
      );
    }

    const [order] = await prisma.$transaction([
      prisma.preCompraOrder.create({
        data: {
          albumId,
          buyerEmail,
          buyerUserId: Number.isFinite(buyerUserId) ? buyerUserId : null,
          buyerName: buyerName || null,
          buyerPhone: buyerPhone || null,
          schoolCourseId: isSchool ? schoolCourseId : null,
          studentFirstName: isSchool ? studentFirstName : null,
          studentLastName: isSchool ? studentLastName : null,
          status: "CREATED",
          totalCents,
        },
      }),
    ]);

    const itemRows: { orderId: number; albumProductId: number; status: "WAITING_SELFIE"; priceCents: number }[] = [];
    for (const it of orderItems) {
      for (let i = 0; i < it.quantity; i++) {
        itemRows.push({
          orderId: order.id,
          albumProductId: it.albumProductId,
          status: "WAITING_SELFIE",
          priceCents: it.priceCents,
        });
      }
    }
    await prisma.preCompraOrderItem.createMany({ data: itemRows });

    // Si es escolar, crear Subject con nombre/apellido y curso
    if (isSchool && studentFirstName && studentLastName) {
      const label = `${studentFirstName} ${studentLastName}`.trim();
      const subject = await prisma.subject.create({
        data: {
          albumId,
          label,
          firstName: studentFirstName,
          lastName: studentLastName,
          schoolCourseId,
          createdByOrderId: order.id,
        },
      });
      // Asignar el subject al primer ítem (cada ítem es un producto; si hay varios, el subject es el mismo)
      const firstItem = await prisma.preCompraOrderItem.findFirst({
        where: { orderId: order.id },
        select: { id: true },
      });
      if (firstItem) {
        await prisma.preCompraOrderItem.update({
          where: { id: firstItem.id },
          data: { subjectId: subject.id },
        });
      }
    }

    const created = await prisma.preCompraOrder.findUnique({
      where: { id: order.id },
      include: { items: { include: { albumProduct: true } } },
    });

    return NextResponse.json({ order: created });
  } catch (e) {
    console.error("precompra order create error:", e);
    return NextResponse.json({ error: "Error al crear el pedido" }, { status: 500 });
  }
}
