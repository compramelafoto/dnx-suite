import { prisma } from "@repo/db";
import { sendPortalEmail } from "@/lib/correo";
import { EquipoError } from "@/lib/inventario/equipos";
import { findActiveReportForSerial } from "@/lib/publicaciones/denuncia-activa";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { formatRating, getUserRating } from "@/lib/ventas/calificaciones";

/**
 * Contacto entre comprador y vendedor. Los datos del vendedor sólo salen por acá, y sólo a
 * quien tiene identidad verificada (la server action lo exige antes de llamar).
 */

export type ContactErrorCode = "PROPIA" | "NO_DISPONIBLE" | "LIMITE";

const MENSAJES: Record<ContactErrorCode, string> = {
  PROPIA: "Esta publicación es tuya.",
  NO_DISPONIBLE: "Esta publicación ya no está disponible.",
  LIMITE: "Llegaste al máximo de contactos por hoy. Probá mañana.",
};

export class ContactoError extends Error {
  constructor(public readonly code: ContactErrorCode) {
    super(MENSAJES[code]);
    this.name = "ContactoError";
  }
}

const MAX_CONTACTOS_POR_DIA = 20;
const DIA_MS = 24 * 60 * 60 * 1000;

export type SellerContact = {
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string | null;
  firstTime: boolean;
};

async function datosDelVendedor(sellerId: number) {
  const [user, identity, phone] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sellerId },
      select: { email: true },
    }),
    // Sólo el nombre legal de una verificación APROBADA: una rechazada o vencida no vale.
    prisma.identityVerification.findUnique({
      where: { userId: sellerId, status: "APPROVED" },
      select: { legalName: true },
    }),
    prisma.phoneVerification.findUnique({
      where: { userId: sellerId },
      select: { phone: true, verifiedAt: true },
    }),
  ]);
  if (!user) throw new ContactoError("NO_DISPONIBLE");
  return {
    sellerName: identity?.legalName?.trim() || "Vendedor verificado",
    sellerEmail: user.email,
    sellerPhone: phone?.verifiedAt ? phone.phone : null,
  };
}

export async function contactSeller(
  buyer: { id: number; displayName: string | null },
  listingId: number,
): Promise<SellerContact> {
  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      make: true,
      model: true,
      gearItem: { select: { serialNormalized: true } },
      // Mismo criterio que el catálogo: sólo vendedores con la identidad aprobada HOY.
      seller: {
        select: { identityVerification: { select: { status: true } } },
      },
    },
  });
  if (!listing || listing.status !== "PUBLISHED")
    throw new ContactoError("NO_DISPONIBLE");
  if (listing.sellerId === buyer.id) throw new ContactoError("PROPIA");
  // Antes de revelar nada (también en contactos repetidos): vendedor verificado y sin denuncia activa.
  if (listing.seller?.identityVerification?.status !== "APPROVED") {
    throw new ContactoError("NO_DISPONIBLE");
  }
  const serial = listing.gearItem?.serialNormalized;
  if (serial && (await findActiveReportForSerial(serial, listing.sellerId))) {
    throw new ContactoError("NO_DISPONIBLE");
  }

  const seller = await datosDelVendedor(listing.sellerId);

  const existente = await prisma.gearListingContact.findUnique({
    where: { listingId_buyerId: { listingId, buyerId: buyer.id } },
    select: { id: true },
  });
  if (existente) return { ...seller, firstTime: false };

  const recientes = await prisma.gearListingContact.count({
    where: {
      buyerId: buyer.id,
      createdAt: { gte: new Date(Date.now() - DIA_MS) },
    },
  });
  if (recientes >= MAX_CONTACTOS_POR_DIA) throw new ContactoError("LIMITE");

  try {
    await prisma.gearListingContact.create({
      data: { listingId, buyerId: buyer.id },
    });
  } catch (err) {
    // Dos pedidos a la vez: el otro ya lo creó y ya avisó al vendedor.
    if ((err as { code?: string })?.code === "P2002")
      return { ...seller, firstTime: false };
    throw err;
  }

  try {
    const calificacion = formatRating(await getUserRating(buyer.id));
    await sendPortalEmail(seller.sellerEmail, "nueva_consulta", {
      comprador: buyer.displayName?.trim() || "Una persona verificada",
      equipo: `${listing.make} ${listing.model}`,
      calificacion,
      url: `${urlBaseDeLaApp()}/mis-publicaciones/${listingId}`,
    });
  } catch (err) {
    console.error("[contacto] No se pudo avisar al vendedor:", err);
  }
  return { ...seller, firstTime: true };
}

/** ¿Esta persona es la vendedora de la publicación? Sólo del lado del servidor. */
export async function isSellerOf(
  userId: number,
  listingId: number,
): Promise<boolean> {
  const l = await prisma.gearListing.findFirst({
    where: { id: listingId, sellerId: userId },
    select: { id: true },
  });
  return l !== null;
}

export async function contactedBefore(
  buyerId: number,
  listingId: number,
): Promise<boolean> {
  const c = await prisma.gearListingContact.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
    select: { id: true },
  });
  return c !== null;
}

export async function listInterested(
  sellerId: number,
  listingId: number,
): Promise<{
  views: number;
  viewers: number;
  contacts: Array<{ buyerId: number; name: string; at: Date }>;
}> {
  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId, sellerId },
    select: { id: true },
  });
  if (!listing) throw new EquipoError("NO_ENCONTRADO");

  const [vistas, consultas] = await Promise.all([
    prisma.gearListingView.aggregate({
      where: { listingId },
      _sum: { count: true },
      _count: { _all: true },
    }),
    prisma.gearListingContact.findMany({
      where: { listingId },
      orderBy: { createdAt: "desc" },
      select: {
        buyerId: true,
        createdAt: true,
        buyer: { select: { name: true } },
      },
    }),
  ]);

  const legales = consultas.length
    ? await prisma.identityVerification.findMany({
        where: {
          userId: { in: consultas.map((c) => c.buyerId) },
          status: "APPROVED",
        },
        select: { userId: true, legalName: true },
      })
    : [];
  const nombrePorId = new Map(
    legales.map((i) => [i.userId, i.legalName?.trim()]),
  );

  return {
    views: vistas._sum.count ?? 0,
    viewers: vistas._count._all,
    contacts: consultas.map((c) => ({
      buyerId: c.buyerId,
      name: nombrePorId.get(c.buyerId) || c.buyer.name || "Persona verificada",
      at: c.createdAt,
    })),
  };
}
