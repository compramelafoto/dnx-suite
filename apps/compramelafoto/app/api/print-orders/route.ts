import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { DEFAULT_PUBLIC_PHOTOGRAPHER_ID, DEFAULT_PUBLIC_LAB_HANDLER } from "@/lib/public-flow-config";
import { registerAuditEvent, getRequestMetadata } from "@/lib/antifraud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingItem = {
  fileKey: string;
  size: string;
  quantity: number;
  finish?: string;       // compat
  acabado?: string;      // compat
  originalName?: string; // ✅
  productId?: number | null;
  productName?: string | null;
  meta?: Record<string, unknown> | null;
};

const REQUIRED_PRODUCT_NAMES = new Set(["foto carnet", "fotos carnet", "polaroid", "polaroids"]);

function normalizeProductName(name: string) {
  return name.split(" - ")[0].trim().toLowerCase();
}

function productMatchesItem(
  item: { productId?: number | null; productName?: string | null; size?: string | null; finish?: string | null },
  product: { id: number; name: string; size: string | null; acabado: string | null }
) {
  if (item.productId && Number(item.productId) === Number(product.id)) return true;
  if (!item.productName) return false;
  const normalized = normalizeProductName(item.productName);
  const finish = (item.finish ?? "").toString().trim().toUpperCase() || null;
  const size = item.size || null;
  const productFinish = (product.acabado ?? "").toString().trim().toUpperCase() || null;
  if (normalizeProductName(product.name) !== normalized) return false;
  if (size && (product.size || null) !== size) return false;
  if (finish && productFinish !== finish) return false;
  return true;
}

function findMatchingProduct<T extends { id: number; name: string; size: string | null; acabado: string | null }>(
  item: { productId?: number | null; productName?: string | null; size?: string | null; finish?: string | null },
  products: T[]
) {
  return products.find((product) => productMatchesItem(item, product)) || null;
}

/**
 * GET /api/print-orders?labId=X&limit=N
 * Lista pedidos de impresión para un laboratorio. Solo muestra pedidos con paymentStatus PAID.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }
    const { searchParams } = new URL(req.url);
    const labIdParam = searchParams.get("labId");
    const requestedLabId = labIdParam ? Number(labIdParam) : null;
    if (!Number.isFinite(requestedLabId) || requestedLabId !== lab.id) {
      return NextResponse.json({ error: "labId inválido o no coincide con tu laboratorio" }, { status: 403 });
    }
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500);
    const orders = await prisma.printOrder.findMany({
      where: { labId: lab.id, paymentStatus: "PAID" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        items: true,
        photographer: { select: { id: true, name: true, address: true, companyAddress: true } },
        lab: { select: { name: true, address: true } },
      },
    });
    return NextResponse.json(orders);
  } catch (err: unknown) {
    console.error("GET /api/print-orders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando pedidos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Verificar Content-Type
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("POST /api/print-orders: Invalid Content-Type", { contentType });
      return NextResponse.json(
        { error: "Content-Type debe ser application/json" },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (err: any) {
      console.error("POST /api/print-orders: Error parsing JSON", err);
      return NextResponse.json(
        { error: "Error al parsear el JSON del request", detail: err?.message },
        { status: 400 }
      );
    }

    const ownerType = (body.ownerType ?? "").toString().toUpperCase() as "PHOTOGRAPHER" | "LAB" | "";
    const ownerId = body.ownerId != null ? Number(body.ownerId) : null;

    console.log("POST /api/print-orders: Request body", {
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      ownerType: ownerType || undefined,
      ownerId: ownerId ?? undefined,
      labId: body.labId,
      clientId: body.clientId,
      pickupBy: body.pickupBy,
      itemsCount: Array.isArray(body.items) ? body.items.length : 0,
      items: Array.isArray(body.items) ? body.items.slice(0, 2) : null,
    });

    const customerName = (body.customerName ?? "").toString().trim() || null;
    let customerEmail = (body.customerEmail ?? "").toString().trim() || null;
    const customerPhone = (body.customerPhone ?? "").toString().trim() || null;

    if (!customerName) {
      console.error("POST /api/print-orders: Missing customerName");
      return NextResponse.json(
        { error: "El nombre del cliente es requerido" },
        { status: 400 }
      );
    }

    // FASE 1: owner-based routing. Si viene ownerType + ownerId, el pedido va al dueño de la landing (fotógrafo o lab).
    // TODO FASE 2: impresión directa al lab; permitir selección de laboratorio por cliente cuando corresponda.
    let photographerId: number | null = null;
    let labId: number | null = null;
    let flow: "PRINT_PHOTOGRAPHER" | "PRINT_PUBLIC" = "PRINT_PHOTOGRAPHER";

    if (ownerType === "PHOTOGRAPHER" && Number.isFinite(ownerId) && ownerId !== null) {
      photographerId = ownerId;
      labId = null;
      flow = "PRINT_PHOTOGRAPHER";
    } else if (ownerType === "LAB" && Number.isFinite(ownerId) && ownerId !== null) {
      labId = ownerId;
      flow = "PRINT_PUBLIC";
      // Pedidos del lab por defecto de compramelafoto.com (dnxestudio2) van al fotógrafo ID 79
      const lab = await prisma.lab.findUnique({
        where: { id: ownerId },
        select: { userId: true, publicPageHandler: true },
      });
      const isDefaultLab =
        lab?.publicPageHandler?.toLowerCase() === DEFAULT_PUBLIC_LAB_HANDLER ||
        lab?.userId === DEFAULT_PUBLIC_PHOTOGRAPHER_ID;
      photographerId = isDefaultLab ? DEFAULT_PUBLIC_PHOTOGRAPHER_ID : null;
    } else {
      // Compatibilidad: sin ownerType/ownerId, se exige photographerId y opcionalmente labId (o preferredLab).
      const legacyPhotographerId = body.photographerId ? Number(body.photographerId) : null;
      if (!legacyPhotographerId || !Number.isFinite(legacyPhotographerId)) {
        return NextResponse.json(
          { error: "ownerType/ownerId o photographerId es requerido para calcular precios" },
          { status: 400 }
        );
      }
      photographerId = legacyPhotographerId;
      const requestedLabId = Number(body.labId);
      labId = Number.isFinite(requestedLabId) ? requestedLabId : null;
      if (!labId) {
        const photographer = await prisma.user.findUnique({
          where: { id: photographerId },
          select: { preferredLabId: true },
        });
        if (photographer?.preferredLabId && Number.isFinite(photographer.preferredLabId)) {
          labId = photographer.preferredLabId;
        }
      }
      flow = body.flow === "PUBLIC" ? "PRINT_PUBLIC" : "PRINT_PHOTOGRAPHER";
    }

    // Cliente autenticado (opcional - si viene del frontend)
    const clientId = (body.clientId !== null && body.clientId !== undefined && body.clientId !== "")
      ? Number(body.clientId)
      : null;

    // Si hay clientId, verificar que el usuario existe y es CUSTOMER
    if (clientId !== null && clientId !== undefined) {
      if (!Number.isFinite(clientId)) {
        console.error("POST /api/print-orders: Invalid clientId format", { clientId });
        return NextResponse.json(
          { error: "clientId debe ser un número válido" },
          { status: 400 }
        );
      }
      const clientUser = await prisma.user.findUnique({
        where: { id: clientId },
        select: { role: true, email: true },
      });
      if (!clientUser || (clientUser.role as string) !== "CUSTOMER") {
        console.error("POST /api/print-orders: Invalid clientId", { clientId, clientUser });
        return NextResponse.json(
          { error: "clientId inválido o no es un cliente", clientId, role: clientUser?.role },
          { status: 400 }
        );
      }
      // Si hay clientId y no hay customerEmail, usar el email del cliente
      if (!customerEmail && clientUser.email) {
        customerEmail = clientUser.email;
      }
    }

    // Validar email después de intentar obtenerlo del cliente
    if (!customerEmail) {
      console.error("POST /api/print-orders: Missing customerEmail");
      return NextResponse.json(
        { error: "El email del cliente es requerido" },
        { status: 400 }
      );
    }

    if (!customerPhone) {
      console.error("POST /api/print-orders: Missing customerPhone");
      return NextResponse.json(
        { error: "El teléfono de WhatsApp es obligatorio" },
        { status: 400 }
      );
    }
    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!isValidPhoneForPurchase(customerPhone)) {
      return NextResponse.json(
        { error: "Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos)" },
        { status: 400 }
      );
    }

    // Logística: quién retira/recibe el pedido
    const pickupBy = (body.pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT") as
      | "CLIENT"
      | "PHOTOGRAPHER";

    const items: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      console.error("POST /api/print-orders: No items in request", { body });
      return NextResponse.json({ error: "El pedido no tiene items." }, { status: 400 });
    }

    // 1) Normalizar items (y validar mínimos)
    const normalized = items
      .map((it) => ({
        fileKey: (it.fileKey ?? "").toString().trim(),
        size: (it.size ?? "").toString().trim(),
        quantity: Number(it.quantity ?? 1),
        productId: it.productId ? Number(it.productId) : null,
        productName: (it.productName ?? "").toString().trim() || null,
        meta: it.meta && typeof it.meta === "object" ? it.meta : null,
        // ✅ acepta finish o acabado, default BRILLO
        finish: ((it.acabado ?? it.finish ?? "BRILLO") as string)
          .toString()
          .trim()
          .toUpperCase(),
        // ✅ guarda nombre original si viene
        originalName: (it.originalName ?? "").toString().trim() || undefined,
      }))
      .filter((it) => it.fileKey && it.size && Number.isFinite(it.quantity) && it.quantity > 0);

     if (!normalized.length) {
      console.error("POST /api/print-orders: Invalid items after normalization", { items, normalized });
      return NextResponse.json({ error: "Items inválidos (faltan fileKey/size/quantity).", items, normalized }, { status: 400 });
    }

    const itemsRequiringProduct = normalized.filter((it) => {
      if (!it.productName) return false;
      return REQUIRED_PRODUCT_NAMES.has(normalizeProductName(it.productName));
    });
    if (itemsRequiringProduct.length) {
      if (!photographerId && !labId) {
        return NextResponse.json(
          { error: "No se pudo validar el precio del producto." },
          { status: 400 }
        );
      }
      if (labId) {
        const products = await prisma.labProduct.findMany({
          where: { labId, isActive: true },
          select: { id: true, name: true, size: true, acabado: true, retailPrice: true, photographerPrice: true },
        });
        const missing = itemsRequiringProduct.find((it) => {
          const matched = findMatchingProduct(it, products);
          if (!matched) return true;
          return !(Number(matched.retailPrice) > 0 || Number(matched.photographerPrice) > 0);
        });
        if (missing) {
          return NextResponse.json(
            { error: "El producto no tiene precio configurado. Contactá al laboratorio." },
            { status: 400 }
          );
        }
      } else if (photographerId) {
        const products = await prisma.photographerProduct.findMany({
          where: { userId: photographerId, isActive: true },
          select: { id: true, name: true, size: true, acabado: true, retailPrice: true },
        });
        const missing = itemsRequiringProduct.find((it) => {
          const matched = findMatchingProduct(it, products);
          if (!matched) return true;
          return !(Number(matched.retailPrice) > 0);
        });
        if (missing) {
          return NextResponse.json(
            { error: "El producto no tiene precio configurado. Contactá al estudio." },
            { status: 400 }
          );
        }
      }
    }

    // 2) Calcular tamaños pedidos
    const sizes = Array.from(new Set(normalized.map((it) => it.size)));

    // 3) Validar MP del receptor del pedido (fotógrafo o lab)
    const isTestMode = process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") || process.env.NODE_ENV !== "production";
    if (!isTestMode) {
      if (photographerId) {
        const photographer = await prisma.user.findUnique({
          where: { id: photographerId },
          select: { mpConnectedAt: true, mpAccessToken: true },
        });
        if (!photographer?.mpConnectedAt || !photographer?.mpAccessToken) {
          return NextResponse.json(
            { error: "El fotógrafo no tiene Mercado Pago conectado y no puede recibir pedidos" },
            { status: 403 }
          );
        }
      } else if (labId) {
        const lab = await prisma.lab.findUnique({
          where: { id: labId },
          select: { mpAccessToken: true },
        });
        if (!lab?.mpAccessToken) {
          return NextResponse.json(
            { error: "El laboratorio no tiene Mercado Pago conectado y no puede recibir pedidos" },
            { status: 403 }
          );
        }
      }
    }

    // 5) Calcular unitPrice/subtotal por item (motor unificado)
    const totals = await computeCheckoutTotals({
      flow,
      photographerId,
      labId,
      items: normalized,
    });

    const itemsToCreate = totals.items.map((computed) => {
      const original = normalized[computed.inputIndex];
      const printType = typeof original.meta?.printType === "string" ? original.meta.printType : null;
      const shouldExpire = printType === "CARNET" || printType === "POLAROID";
      const printExpiresAt = shouldExpire
        ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        : null;
      return {
        fileKey: original.fileKey,
        originalName: original.originalName,
        size: original.size,
        quantity: computed.quantity,
        acabado: original.finish,
        unitPrice: computed.unitPriceCents,
        subtotal: computed.subtotalCents,
        meta: original.meta ?? undefined,
        printExpiresAt,
      };
    });

    const total = totals.displayTotalCents;

    // 6) Crear pedido (ownerType/ownerId para trazabilidad FASE 1)
    let order;
    const printTypes = Array.from(
      new Set(
        normalized
          .map((it) => (typeof it.meta?.printType === "string" ? it.meta.printType : null))
          .filter((value): value is string => Boolean(value))
      )
    );
    const tags = printTypes.length === 1
      ? [printTypes[0] === "CARNET" ? "PRINT_CARNET" : "PRINT_POLAROID"]
      : [];

    const baseData: any = {
      ...(labId != null ? { labId } : {}),
      ...(photographerId != null ? { photographerId } : {}),
      ...(ownerType === "PHOTOGRAPHER" && ownerId != null ? { ownerType: "PHOTOGRAPHER" as const, ownerId } : {}),
      ...(ownerType === "LAB" && ownerId != null ? { ownerType: "LAB" as const, ownerId } : {}),
      ...(clientId && Number.isFinite(clientId) ? { clientId } : {}),
      pickupBy,
      customerName,
      customerEmail,
      customerPhone,
      currency: "ARS",
      total,
      pricingSnapshot: totals.snapshot,
      ...(tags.length ? { tags } : {}),
      items: {
        create: itemsToCreate,
      },
    };

    try {
      order = await prisma.printOrder.create({
        data: baseData,
        include: { items: true },
      });
    } catch (createErr: any) {
      const msg = String(createErr?.message ?? "");
      if (msg.includes("pricingSnapshot") && (msg.includes("Unknown argument") || msg.includes("Unknown column"))) {
        const fallbackData = { ...baseData };
        delete fallbackData.pricingSnapshot;
        order = await prisma.printOrder.create({
          data: fallbackData,
          include: { items: true },
        });
      } else {
        throw createErr;
      }
    }

    // Auditoría antifraude
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await registerAuditEvent({
      targetOrderType: "PRINT_ORDER",
      targetOrderId: order.id,
      eventType: "ORDER_CREATED",
      ipAddress,
      userAgent,
      metadata: { photographerId, labId },
    });

    // El email al fotógrafo/lab se envía solo cuando el pago está aprobado (webhook MP).

    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/print-orders ERROR >>>", err);
    const errorMessage = err?.message || String(err) || "Error desconocido";
    const errorDetail = err?.stack || err?.toString();
    const errorCode = err?.code || err?.name || "UNKNOWN_ERROR";
    console.error("POST /api/print-orders ERROR DETAILS:", { 
      errorMessage, 
      errorDetail,
      errorCode,
      errorType: typeof err,
      errString: String(err)
    });
    
    // Asegurar que siempre devolvemos JSON válido
    try {
      return NextResponse.json(
        { 
          error: "Error creando pedido", 
          detail: errorMessage,
          code: errorCode,
          ...(process.env.NODE_ENV !== "production" && { stack: errorDetail })
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    } catch (jsonError: any) {
      // Si incluso el JSON falla, devolver texto plano pero con Content-Type JSON
      console.error("CRITICAL: Failed to create JSON error response:", jsonError);
      return new NextResponse(
        JSON.stringify({ 
          error: "Error creando pedido", 
          detail: errorMessage 
        }),
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
}
