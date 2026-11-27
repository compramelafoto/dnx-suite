import { prisma } from "@repo/db";
import { formatPesos, sellerFirstName } from "@/lib/catalogo/buscar";
import { sendPortalEmail, type PortalEmailTemplate } from "@/lib/correo";
import { fechaAr } from "@/lib/inventario/formato";
import { EquipoError } from "@/lib/inventario/equipos";
import { urlBaseDeLaApp } from "@/lib/sesion";

/**
 * Cierre de una venta: el vendedor marca al comprador (la publicación pasa a «vendida» y queda
 * pendiente), el comprador confirma y recién ahí el equipo cambia de dueño. Si no confirma en
 * `SALE_DAYS` días (o rechaza), todo vuelve al vendedor. Los correos salen después de la
 * transacción y nunca rompen la operación.
 */

export const SALE_DAYS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

export type VentaErrorCode = "NO_ENCONTRADA" | "NO_CONSULTO" | "YA_VENDIDA" | "NO_PENDIENTE" | "VENCIDA";

const MENSAJES: Record<VentaErrorCode, string> = {
  NO_ENCONTRADA: "No encontramos esa venta.",
  NO_CONSULTO: "Esa persona no consultó por esta publicación.",
  YA_VENDIDA: "Esta publicación ya está marcada como vendida.",
  NO_PENDIENTE: "Esta venta ya no está pendiente de confirmación.",
  VENCIDA: "El plazo para confirmar esta compra venció.",
};

export class VentaError extends Error {
  constructor(public readonly code: VentaErrorCode) {
    super(MENSAJES[code]);
    this.name = "VentaError";
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type SaleRow = {
  id: number;
  listingId: number;
  gearItemId: number;
  sellerId: number;
  buyerId: number;
  priceArs: number;
  expiresAt: Date;
  listing: { make: string; model: string };
};

type Party = { email: string; name: string | null };

async function partiesOf(sellerId: number, buyerId: number): Promise<{ seller?: Party; buyer?: Party }> {
  const users = (await prisma.user.findMany({
    where: { id: { in: [sellerId, buyerId] } },
    select: { id: true, email: true, name: true },
  })) as Array<{ id: number; email: string; name: string | null }>;
  return {
    seller: users.find((u) => u.id === sellerId),
    buyer: users.find((u) => u.id === buyerId),
  };
}

async function notify(to: string | undefined, template: PortalEmailTemplate, data: Record<string, string>): Promise<void> {
  if (!to) return;
  try {
    await sendPortalEmail(to, template, data);
  } catch (err) {
    console.error(`[ventas] No se pudo enviar "${template}":`, err);
  }
}

const nombreDePila = (name: string | null | undefined): string => {
  const first = sellerFirstName(name);
  return first === "Vendedor" && !name?.trim() ? "" : first;
};

const equipoDe = (s: { listing: { make: string; model: string } }) => `${s.listing.make} ${s.listing.model}`;

export async function markSold(
  sellerId: number,
  listingId: number,
  buyerId: number,
  priceArs: number,
): Promise<{ saleId: number }> {
  if (!Number.isInteger(priceArs) || priceArs <= 0) {
    throw new EquipoError("DATO_INVALIDO", "El precio tiene que ser un número entero mayor a cero.");
  }
  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId, sellerId },
    select: { id: true, gearItemId: true, status: true, make: true, model: true },
  });
  if (!listing) throw new VentaError("NO_ENCONTRADA");
  if (listing.status === "SOLD") throw new VentaError("YA_VENDIDA");
  if (listing.status !== "PUBLISHED" && listing.status !== "PAUSED") throw new VentaError("NO_ENCONTRADA");

  const contact = await prisma.gearListingContact.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
    select: { id: true },
  });
  if (!contact) throw new VentaError("NO_CONSULTO");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SALE_DAYS * DIA_MS);
  const readStatus = listing.status;

  const saleId = await prisma.$transaction(async (tx) => {
    const r = await tx.gearListing.updateMany({
      where: { id: listingId, sellerId, status: readStatus },
      data: { status: "SOLD", closedAt: now },
    });
    if (r.count === 0) throw new VentaError("YA_VENDIDA");
    // Una publicación pausada dejó el equipo en IN_USE: vuelve a FOR_SALE para poder traspasarlo al confirmar.
    const item = await tx.gearItem.updateMany({
      where: { id: listing.gearItemId, ownerId: sellerId, status: { in: ["FOR_SALE", "IN_USE"] } },
      data: { status: "FOR_SALE" },
    });
    if (item.count === 0) throw new VentaError("NO_ENCONTRADA");
    const sale = await tx.gearSale.create({
      data: { listingId, gearItemId: listing.gearItemId, sellerId, buyerId, priceArs, expiresAt },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: listing.gearItemId,
        type: "STATUS_CHANGED",
        detail: { listingId, accion: "vendido_pendiente", saleId: sale.id },
      },
    });
    return sale.id;
  });

  try {
    const { seller, buyer } = await partiesOf(sellerId, buyerId);
    await notify(buyer?.email, "confirmar_compra", {
      nombre: nombreDePila(buyer?.name),
      vendedor: sellerFirstName(seller?.name),
      equipo: `${listing.make} ${listing.model}`,
      precio: formatPesos(priceArs),
      vence: fechaAr(expiresAt),
      url: `${urlBaseDeLaApp()}/compras/${saleId}`,
    });
  } catch (err) {
    console.error("[ventas] No se pudo avisar al comprador:", err);
  }
  return { saleId };
}

export async function confirmPurchase(buyerId: number, saleId: number): Promise<void> {
  const sale = (await prisma.gearSale.findFirst({
    where: { id: saleId, buyerId },
    select: {
      id: true,
      listingId: true,
      gearItemId: true,
      sellerId: true,
      buyerId: true,
      status: true,
      priceArs: true,
      expiresAt: true,
      listing: { select: { make: true, model: true } },
    },
  })) as (SaleRow & { status: string }) | null;
  if (!sale) throw new VentaError("NO_ENCONTRADA");
  if (sale.status !== "PENDING_BUYER") throw new VentaError("NO_PENDIENTE");
  const now = new Date();
  if (sale.expiresAt.getTime() < now.getTime()) throw new VentaError("VENCIDA");

  await prisma.$transaction(async (tx) => {
    const r = await tx.gearSale.updateMany({
      where: { id: saleId, buyerId, status: "PENDING_BUYER", expiresAt: { gte: now } },
      data: { status: "CONFIRMED", resolvedAt: now },
    });
    if (r.count === 0) throw new VentaError("NO_PENDIENTE");
    // Un equipo denunciado (robado/perdido) mientras la venta esperaba nunca se traspasa.
    const moved = await tx.gearItem.updateMany({
      where: { id: sale.gearItemId, status: "FOR_SALE", ownerId: sale.sellerId },
      data: {
        ownerId: buyerId,
        status: "IN_USE",
        notes: null,
        declaredValueArs: null,
        declaredValueUsd: null,
        sightingId: null,
      },
    });
    if (moved.count === 0) throw new VentaError("NO_PENDIENTE");
    await tx.gearItemEvent.create({
      data: { gearItemId: sale.gearItemId, type: "STATUS_CHANGED", detail: { accion: "traspaso", saleId } },
    });
  });

  try {
    const { seller, buyer } = await partiesOf(sale.sellerId, buyerId);
    const base = {
      equipo: equipoDe(sale),
      precio: formatPesos(sale.priceArs),
    };
    await notify(buyer?.email, "venta_confirmada", {
      ...base,
      nombre: nombreDePila(buyer?.name),
      rol: "comprador",
      otraParte: sellerFirstName(seller?.name),
      url: `${urlBaseDeLaApp()}/compras/${saleId}`,
    });
    await notify(seller?.email, "venta_confirmada", {
      ...base,
      nombre: nombreDePila(seller?.name),
      rol: "vendedor",
      otraParte: sellerFirstName(buyer?.name),
      url: `${urlBaseDeLaApp()}/ventas/${saleId}`,
    });
  } catch (err) {
    console.error("[ventas] No se pudo avisar la confirmación:", err);
  }
}

/** Resuelve sin traspaso (rechazo o vencimiento): la publicación se cierra y el equipo vuelve al vendedor. */
async function resolveWithoutSale(sale: SaleRow, status: "DECLINED" | "EXPIRED", now: Date): Promise<void> {
  await prisma.$transaction(async (tx: Tx) => {
    const r = await tx.gearSale.updateMany({
      where: { id: sale.id, status: "PENDING_BUYER" },
      data: { status, resolvedAt: now },
    });
    if (r.count === 0) throw new VentaError("NO_PENDIENTE");
    await tx.gearListing.updateMany({
      where: { id: sale.listingId, status: "SOLD" },
      data: { status: "CLOSED" },
    });
    // Sólo si sigue a la venta: un equipo denunciado mientras tanto no se pisa.
    await tx.gearItem.updateMany({
      where: { id: sale.gearItemId, status: "FOR_SALE", ownerId: sale.sellerId },
      data: { status: "IN_USE" },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: sale.gearItemId,
        type: "STATUS_CHANGED",
        detail: { accion: "venta_no_confirmada", saleId: sale.id },
      },
    });
  });

  try {
    const { seller, buyer } = await partiesOf(sale.sellerId, sale.buyerId);
    await notify(seller?.email, "venta_no_confirmada", {
      nombre: nombreDePila(seller?.name),
      comprador: nombreDePila(buyer?.name) || "El comprador",
      equipo: equipoDe(sale),
      motivo: status === "EXPIRED" ? "vencio" : "rechazo",
      url: `${urlBaseDeLaApp()}/ventas/${sale.id}`,
    });
  } catch (err) {
    console.error("[ventas] No se pudo avisar al vendedor:", err);
  }
}

export async function declinePurchase(buyerId: number, saleId: number): Promise<void> {
  const sale = (await prisma.gearSale.findFirst({
    where: { id: saleId, buyerId },
    select: {
      id: true,
      listingId: true,
      gearItemId: true,
      sellerId: true,
      buyerId: true,
      status: true,
      priceArs: true,
      expiresAt: true,
      listing: { select: { make: true, model: true } },
    },
  })) as (SaleRow & { status: string }) | null;
  if (!sale) throw new VentaError("NO_ENCONTRADA");
  if (sale.status !== "PENDING_BUYER") throw new VentaError("NO_PENDIENTE");
  await resolveWithoutSale(sale, "DECLINED", new Date());
}

/** Vence las ventas pendientes cuyo plazo pasó. Idempotente: una venta ya resuelta no repite correos. */
export async function expirePendingSales(now: Date = new Date()): Promise<{ expired: number }> {
  const pending = (await prisma.gearSale.findMany({
    where: { status: "PENDING_BUYER", expiresAt: { lt: now } },
    select: {
      id: true,
      listingId: true,
      gearItemId: true,
      sellerId: true,
      buyerId: true,
      priceArs: true,
      expiresAt: true,
      listing: { select: { make: true, model: true } },
    },
  })) as SaleRow[];
  let expired = 0;
  for (const sale of pending) {
    try {
      await resolveWithoutSale(sale, "EXPIRED", now);
      expired += 1;
    } catch (err) {
      // Otra corrida (o el comprador) ya la resolvió: no se cuenta ni se avisa de nuevo.
      if (!(err instanceof VentaError && err.code === "NO_PENDIENTE")) throw err;
    }
  }
  return { expired };
}

export type SaleSummary = {
  id: number;
  equipo: string;
  priceArs: number;
  status: "PENDING_BUYER" | "CONFIRMED" | "DECLINED" | "EXPIRED";
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
  /** Nombre de pila de la otra parte. */
  otraParte: string;
};

type SummaryRow = {
  id: number;
  status: SaleSummary["status"];
  priceArs: number;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
  listing: { make: string; model: string };
};

const toSummary = (row: SummaryRow, otro: { name: string | null }): SaleSummary => ({
  id: row.id,
  equipo: equipoDe(row),
  priceArs: row.priceArs,
  status: row.status,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  resolvedAt: row.resolvedAt,
  otraParte: sellerFirstName(otro.name),
});

const SUMMARY_SELECT = {
  id: true,
  status: true,
  priceArs: true,
  createdAt: true,
  expiresAt: true,
  resolvedAt: true,
  listing: { select: { make: true, model: true } },
} as const;

export async function listMyPurchases(buyerId: number): Promise<SaleSummary[]> {
  const rows = (await prisma.gearSale.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    select: { ...SUMMARY_SELECT, seller: { select: { name: true } } },
  })) as Array<SummaryRow & { seller: { name: string | null } }>;
  return rows.map((r) => toSummary(r, r.seller));
}

export async function listMySales(sellerId: number): Promise<SaleSummary[]> {
  const rows = (await prisma.gearSale.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    select: { ...SUMMARY_SELECT, buyer: { select: { name: true } } },
  })) as Array<SummaryRow & { buyer: { name: string | null } }>;
  return rows.map((r) => toSummary(r, r.buyer));
}

export type SaleDetail = SaleSummary & {
  listingId: number;
  gearItemId: number;
  sellerId: number;
  buyerId: number;
  rol: "COMPRADOR" | "VENDEDOR";
};

/** La venta, sólo si quien pregunta es el comprador o el vendedor. */
export async function getSaleForParty(userId: number, saleId: number): Promise<SaleDetail | null> {
  const row = (await prisma.gearSale.findFirst({
    where: { id: saleId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: {
      ...SUMMARY_SELECT,
      listingId: true,
      gearItemId: true,
      sellerId: true,
      buyerId: true,
      seller: { select: { name: true } },
      buyer: { select: { name: true } },
    },
  })) as
    | (SummaryRow & {
        listingId: number;
        gearItemId: number;
        sellerId: number;
        buyerId: number;
        seller: { name: string | null };
        buyer: { name: string | null };
      })
    | null;
  if (!row) return null;
  const esComprador = row.buyerId === userId;
  return {
    ...toSummary(row, esComprador ? row.seller : row.buyer),
    listingId: row.listingId,
    gearItemId: row.gearItemId,
    sellerId: row.sellerId,
    buyerId: row.buyerId,
    rol: esComprador ? "COMPRADOR" : "VENDEDOR",
  };
}
