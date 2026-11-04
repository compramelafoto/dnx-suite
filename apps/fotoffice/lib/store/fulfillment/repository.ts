import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, type StoreOrderStatus } from "@repo/db";
import { buildFulfillmentCsv } from "./feed";

/**
 * Los pedidos que produce un proveedor (dropshipping): la planilla en vivo, los pendientes del
 * panel y el enlace secreto. Todo filtra por `workspaceId`; la planilla pública lo saca del
 * proveedor dueño del enlace, nunca de la dirección.
 */

/** Pedidos pagados que el productor tiene que ver (los cancelados o vencidos, no). */
export const FEED_ORDER_STATUSES: StoreOrderStatus[] = ["PAID", "READY", "SHIPPED", "DELIVERED"];
export const FEED_WINDOW_DAYS = 60;
/** 32 bytes en base64url son 43 caracteres; menos que esto no es un enlace nuestro. */
export const FEED_TOKEN_MIN_LENGTH = 32;

export function newFeedToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isPlausibleFeedToken(token: string): boolean {
  return token.length >= FEED_TOKEN_MIN_LENGTH && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token);
}

/** La dirección de la planilla, para `=IMPORTDATA(...)`. */
export function feedPath(token: string): string {
  return `/api/tienda/productor/${token}.csv`;
}

const SELECT_ITEM = {
  id: true,
  sku: true,
  productName: true,
  variantName: true,
  qty: true,
  printFileUrl: true,
  imageUrl: true,
  fulfillmentSentAt: true,
  order: {
    select: {
      id: true,
      publicId: true,
      orderNumber: true,
      paidAt: true,
      buyerName: true,
      buyerPhone: true,
      deliveryMethod: true,
      shippingMethod: true,
      shippingAddressJson: true,
      shippingAgencyJson: true,
      trackingNumber: true,
    },
  },
} as const;

function ventana(now: Date): Date {
  return new Date(now.getTime() - FEED_WINDOW_DAYS * 24 * 60 * 60_000);
}

async function lineasDelProveedor(
  workspaceId: string,
  proveedorId: string,
  opts: { now?: Date; soloPendientes?: boolean } = {},
) {
  const now = opts.now ?? new Date();
  return prisma.storeOrderItem.findMany({
    where: {
      fulfillmentProveedorId: proveedorId,
      ...(opts.soloPendientes ? { fulfillmentSentAt: null } : {}),
      order: { workspaceId, status: { in: FEED_ORDER_STATUSES }, paidAt: { gte: ventana(now) } },
    },
    orderBy: [{ order: { paidAt: "asc" } }, { order: { orderNumber: "asc" } }, { id: "asc" }],
    select: SELECT_ITEM,
  });
}

async function direccionDeRetiro(workspaceId: string): Promise<string | null> {
  const s = await prisma.storeSettings.findUnique({ where: { workspaceId }, select: { pickupAddress: true } });
  return s?.pickupAddress ?? null;
}

/** El CSV de un proveedor del workspace. */
export async function buildFeedCsv(workspaceId: string, proveedorId: string, now = new Date()): Promise<string> {
  const [items, retiro] = await Promise.all([
    lineasDelProveedor(workspaceId, proveedorId, { now }),
    direccionDeRetiro(workspaceId),
  ]);
  return buildFulfillmentCsv(items, retiro);
}

/**
 * La planilla pública por enlace secreto: `null` si el enlace no es de ningún proveedor activo.
 * La búsqueda es por el índice único, sin comparar a mano.
 */
export async function loadFeedByToken(token: string): Promise<{ csv: string; proveedorName: string } | null> {
  if (!isPlausibleFeedToken(token)) return null;
  const proveedor = await prisma.fotofficeProveedor.findUnique({
    where: { ordersFeedToken: token },
    select: { id: true, workspaceId: true, name: true, active: true },
  });
  if (!proveedor || !proveedor.active) return null;
  return { csv: await buildFeedCsv(proveedor.workspaceId, proveedor.id), proveedorName: proveedor.name };
}

export type ProductorView = {
  id: string;
  name: string;
  active: boolean;
  token: string | null;
  listingsCount: number;
  pending: PendingOrderView[];
};

export type PendingOrderView = {
  orderId: string;
  orderNumber: number;
  paidAt: Date | null;
  buyerName: string;
  lines: { id: string; sku: string | null; productName: string; variantName: string | null; qty: number; printFileUrl: string | null }[];
};

/** Los productores del panel: los que tienen productos asignados o ya tienen enlace. */
export async function listProductores(workspaceId: string, now = new Date()): Promise<ProductorView[]> {
  const proveedores = await prisma.fotofficeProveedor.findMany({
    where: {
      workspaceId,
      OR: [{ ordersFeedToken: { not: null } }, { listingsProducidos: { some: { workspaceId } } }],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      active: true,
      ordersFeedToken: true,
      _count: { select: { listingsProducidos: { where: { workspaceId } } } },
    },
  });

  return Promise.all(
    proveedores.map(async (p) => {
      const items = await lineasDelProveedor(workspaceId, p.id, { now, soloPendientes: true });
      const porPedido = new Map<string, PendingOrderView>();
      for (const i of items) {
        const grupo = porPedido.get(i.order.id) ?? {
          orderId: i.order.id,
          orderNumber: i.order.orderNumber,
          paidAt: i.order.paidAt,
          buyerName: i.order.buyerName,
          lines: [],
        };
        grupo.lines.push({
          id: i.id,
          sku: i.sku,
          productName: i.productName,
          variantName: i.variantName,
          qty: i.qty,
          printFileUrl: i.printFileUrl,
        });
        porPedido.set(i.order.id, grupo);
      }
      return {
        id: p.id,
        name: p.name,
        active: p.active,
        token: p.ordersFeedToken,
        listingsCount: p._count.listingsProducidos,
        pending: [...porPedido.values()],
      };
    }),
  );
}

/** ¿El proveedor es de este workspace? */
export async function proveedorDelWorkspace(workspaceId: string, proveedorId: string) {
  return prisma.fotofficeProveedor.findFirst({
    where: { id: proveedorId, workspaceId },
    select: { id: true, name: true, active: true, ordersFeedToken: true },
  });
}

/** Marca como pasadas al productor las líneas pendientes de ese pedido. Devuelve cuántas. */
export async function markOrderSentToProveedor(
  workspaceId: string,
  orderId: string,
  proveedorId: string,
  now = new Date(),
): Promise<number> {
  const r = await prisma.storeOrderItem.updateMany({
    where: {
      orderId,
      fulfillmentProveedorId: proveedorId,
      fulfillmentSentAt: null,
      order: { workspaceId, status: { in: FEED_ORDER_STATUSES } },
    },
    data: { fulfillmentSentAt: now },
  });
  return r.count;
}

/** Genera (o reemplaza) el enlace secreto. El anterior deja de funcionar en el acto. */
export async function regenerateFeedToken(workspaceId: string, proveedorId: string): Promise<string | null> {
  const token = newFeedToken();
  const r = await prisma.fotofficeProveedor.updateMany({
    where: { id: proveedorId, workspaceId },
    data: { ordersFeedToken: token },
  });
  return r.count === 1 ? token : null;
}

/** Productor y estado de cada línea, para el detalle del pedido en el panel. */
export async function proveedorNames(workspaceId: string, ids: readonly string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const filas = await prisma.fotofficeProveedor.findMany({
    where: { workspaceId, id: { in: unicos } },
    select: { id: true, name: true },
  });
  return new Map(filas.map((f) => [f.id, f.name]));
}
