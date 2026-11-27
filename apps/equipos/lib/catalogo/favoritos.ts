import { prisma } from "@repo/db";
import { getPublicListingsByIds, type PublicListing } from "@/lib/catalogo/buscar";
import { EquipoError } from "@/lib/inventario/equipos";
import { VENDEDOR_VISIBLE } from "./visibilidad";

/**
 * Favoritos: publicaciones que una persona guarda para mirar después. Sólo se guardan
 * publicaciones visibles en el catálogo (publicadas, de un vendedor con la identidad aprobada y
 * sin la cuenta bloqueada) y ajenas; quitar una se puede siempre (aunque ya no esté visible).
 */

export const MENSAJE_FAVORITO_PROPIO = "No podés guardar tu propia publicación.";

/** Guarda la publicación si no estaba guardada; si estaba, la quita. */
export async function toggleFavorite(
  userId: number,
  listingId: number,
): Promise<{ favorite: boolean }> {
  const existente = await prisma.gearListingFavorite.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  if (existente) {
    await prisma.gearListingFavorite.deleteMany({ where: { userId, listingId } });
    return { favorite: false };
  }

  const listing = await prisma.gearListing.findFirst({
    where: { id: listingId, status: "PUBLISHED", seller: VENDEDOR_VISIBLE },
    select: { sellerId: true },
  });
  if (!listing) throw new EquipoError("NO_ENCONTRADO", "No encontramos esa publicación.");
  if (listing.sellerId === userId) throw new EquipoError("DATO_INVALIDO", MENSAJE_FAVORITO_PROPIO);

  try {
    await prisma.gearListingFavorite.create({ data: { userId, listingId }, select: { id: true } });
  } catch (err) {
    // Doble clic: el otro pedido ya la guardó, el resultado es el mismo.
    if ((err as { code?: string })?.code !== "P2002") throw err;
  }
  return { favorite: true };
}

/** Las guardadas que siguen publicadas, las últimas guardadas primero. */
export async function listFavorites(userId: number): Promise<PublicListing[]> {
  const favs = await prisma.gearListingFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { listingId: true },
  });
  return getPublicListingsByIds(favs.map((f) => f.listingId));
}

export async function isFavorite(userId: number, listingId: number): Promise<boolean> {
  const fav = await prisma.gearListingFavorite.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  return fav != null;
}

/** Cuántas personas guardaron la publicación (lo ve sólo el vendedor). */
export async function countFavorites(listingId: number): Promise<number> {
  return prisma.gearListingFavorite.count({ where: { listingId } });
}
