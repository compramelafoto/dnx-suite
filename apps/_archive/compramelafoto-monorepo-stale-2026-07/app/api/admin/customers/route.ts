import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

const APP_URL = process.env.APP_URL || "https://www.compramelafoto.com";
const REFERRAL_SIGNUP_PATH = "/land";

type CustomerOrder = {
  id: number;
  createdAt: Date;
  total: number;
  status: string;
  paymentStatus: string;
  photographer: { id: number; name: string | null; email: string } | null;
};

type CustomerRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  createdAt: Date;
  isBlocked: boolean;
  isGuest: boolean;
  clientOrders: CustomerOrder[];
  photographers: Array<{ id: number; name: string | null; email: string; orderCount: number }>;
  lastOrderAt: Date | null;
  lastLoginAt?: Date | null;
  referralUrl?: string | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function hashEmailToId(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return -Math.abs(hash || 1);
}

function mapOrderStatusToPaymentStatus(status: string): string {
  if (status === "PAID") return "PAID";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "CANCELED") return "FAILED";
  return "PENDING";
}

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
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);

    const customersMap = new Map<string, CustomerRow>();

    const users = await prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        city: true,
        province: true,
        country: true,
        createdAt: true,
        isBlocked: true,
        lastLoginAt: true,
        referralCodeOwned: { select: { code: true } },
      },
    });

    users.forEach((u) => {
      const emailKey = normalizeEmail(u.email);
      if (!emailKey) return;
      const referralUrl = u.referralCodeOwned
        ? `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(u.referralCodeOwned.code)}`
        : null;
      customersMap.set(emailKey, {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        city: u.city,
        province: u.province,
        country: u.country,
        createdAt: u.createdAt,
        isBlocked: u.isBlocked,
        isGuest: false,
        clientOrders: [],
        referralUrl,
        photographers: [],
        lastOrderAt: null,
        lastLoginAt: u.lastLoginAt,
      });
    });

    const printOrders = await prisma.printOrder.findMany({
      select: {
        id: true,
        createdAt: true,
        total: true,
        status: true,
        paymentStatus: true,
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        photographer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    printOrders.forEach((order) => {
      const emailKey = normalizeEmail(order.customerEmail);
      if (!emailKey) return;

      if (!customersMap.has(emailKey)) {
        customersMap.set(emailKey, {
          id: hashEmailToId(emailKey),
          email: order.customerEmail || emailKey,
          name: order.customerName ?? null,
          phone: order.customerPhone ?? null,
          city: null,
          province: null,
          country: null,
          createdAt: order.createdAt,
          isBlocked: false,
          isGuest: true,
          clientOrders: [],
          photographers: [],
          lastOrderAt: null,
        });
      }

      const customer = customersMap.get(emailKey)!;
      customer.clientOrders.push({
        id: order.id,
        createdAt: order.createdAt,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        photographer: order.photographer ?? null,
      });

      if (!customer.lastOrderAt || order.createdAt > customer.lastOrderAt) {
        customer.lastOrderAt = order.createdAt;
      }

      if (order.photographer) {
        const existing = customer.photographers.find((p) => p.id === order.photographer!.id);
        if (existing) {
          existing.orderCount += 1;
        } else {
          customer.photographers.push({
            id: order.photographer.id,
            name: order.photographer.name,
            email: order.photographer.email,
            orderCount: 1,
          });
        }
      }
    });

    const digitalOrders = await prisma.order.findMany({
      select: {
        id: true,
        createdAt: true,
        totalCents: true,
        status: true,
        buyerEmail: true,
        album: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    digitalOrders.forEach((order) => {
      const emailKey = normalizeEmail(order.buyerEmail);
      if (!emailKey) return;

      if (!customersMap.has(emailKey)) {
        customersMap.set(emailKey, {
          id: hashEmailToId(emailKey),
          email: order.buyerEmail,
          name: null,
          phone: null,
          city: null,
          province: null,
          country: null,
          createdAt: order.createdAt,
          isBlocked: false,
          isGuest: true,
          clientOrders: [],
          photographers: [],
          lastOrderAt: null,
        });
      }

      const customer = customersMap.get(emailKey)!;
      customer.clientOrders.push({
        id: order.id,
        createdAt: order.createdAt,
        total: Math.round(order.totalCents),
        status: order.status,
        paymentStatus: mapOrderStatusToPaymentStatus(order.status),
        photographer: order.album?.user
          ? {
              id: order.album.user.id,
              name: order.album.user.name,
              email: order.album.user.email,
            }
          : null,
      });

      if (!customer.lastOrderAt || order.createdAt > customer.lastOrderAt) {
        customer.lastOrderAt = order.createdAt;
      }

      if (order.album?.user) {
        const existing = customer.photographers.find((p) => p.id === order.album!.user.id);
        if (existing) {
          existing.orderCount += 1;
        } else {
          customer.photographers.push({
            id: order.album.user.id,
            name: order.album.user.name,
            email: order.album.user.email,
            orderCount: 1,
          });
        }
      }
    });

    let customers = Array.from(customersMap.values());

    if (q) {
      customers = customers.filter((c) => {
        return (
          c.email.toLowerCase().includes(q) ||
          (c.name?.toLowerCase().includes(q) ?? false) ||
          (c.phone?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    customers.sort((a, b) => {
      const aDate = a.lastOrderAt ?? a.createdAt;
      const bDate = b.lastOrderAt ?? b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });

    const total = customers.length;
    const start = (page - 1) * pageSize;
    const paged = customers.slice(start, start + pageSize);

    return NextResponse.json({
      customers: paged,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/customers ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo clientes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
