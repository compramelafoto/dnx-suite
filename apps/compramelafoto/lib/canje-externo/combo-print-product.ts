/**
 * Producto de impresión con el que se piden las fotos del combo. El combo sólo dice un
 * tamaño ("15x21 cm"); el checkout necesita un `PhotographerProduct` concreto para cotizar.
 * Se elige entre los productos activos del fotógrafo de ese tamaño, prefiriendo uno
 * genérico ("Foto impresa") a uno con nombre de toma ("Foto grupal", "Con la seño").
 */

import { prisma } from "@/lib/prisma";
import { productsForAlbum } from "@/lib/pricing/album-scoped-products";
import { normalizePrintSize } from "./prepaid-print-credit";

export type ComboPrintProduct = {
  productId: number;
  name: string;
  size: string;
  finish: string | null;
};

function puntaje(name: string): number {
  const n = name.trim().toLowerCase();
  if (n === "foto impresa") return 0;
  if (n.startsWith("foto impresa")) return 1;
  if (n.includes("impres")) return 2;
  return 3;
}

export async function resolveComboPrintProduct(
  photographerId: number,
  size: string,
  albumId?: number | null
): Promise<ComboPrintProduct | null> {
  const target = normalizePrintSize(size);
  if (!target) return null;
  const products = await prisma.photographerProduct.findMany({
    where: { userId: photographerId, isActive: true },
    select: { id: true, name: true, size: true, acabado: true, albumId: true },
    orderBy: { id: "asc" },
  });
  const candidates = productsForAlbum(products, albumId)
    .filter((p) => normalizePrintSize(p.size) === target)
    .sort((a, b) => puntaje(a.name) - puntaje(b.name) || a.id - b.id);
  const p = candidates[0];
  if (!p || !p.size) return null;
  return { productId: p.id, name: p.name, size: p.size, finish: p.acabado ?? null };
}
