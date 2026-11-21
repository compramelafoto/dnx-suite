/**
 * Crea el link compartido de regalo de un álbum: UN link para todas las familias, cada una
 * deja sus datos y recibe N fotos impresas de regalo (ver lib/canje-externo/shared-voucher-link.ts).
 *
 * Uso:
 *   tsx scripts/canje-externo/crear-link-compartido.ts --album 1649 [--unidades 3] \
 *     [--tamano "15x20"] [--con-digital] [--dias 120]
 *
 * El link sólo se ve en la salida de este script (en la base queda su hash).
 */

import { prisma } from "@/lib/prisma";
import { createSharedGiftLink } from "@/lib/canje-externo/shared-voucher-link";
import { resolveComboPrintProduct } from "@/lib/canje-externo/combo-print-product";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const albumId = Number(arg("album"));
  const unidades = Number(arg("unidades") ?? 3);
  const tamano = (arg("tamano") ?? "15x20").trim();
  const dias = Number(arg("dias") ?? 120);
  const conDigital = process.argv.includes("--con-digital");
  if (!Number.isInteger(albumId) || albumId <= 0) throw new Error("Falta --album");
  if (!Number.isInteger(unidades) || unidades < 1) throw new Error("--unidades tiene que ser un entero ≥ 1");
  if (!Number.isInteger(dias) || dias < 1) throw new Error("--dias tiene que ser un entero ≥ 1");

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, userId: true, deletedAt: true },
  });
  if (!album || album.deletedAt) throw new Error(`Álbum ${albumId} no encontrado`);
  const product = await resolveComboPrintProduct(album.userId, tamano, album.id);
  if (!product) throw new Error(`El álbum no tiene un producto impreso activo de ${tamano}`);

  const baseUrl = (process.env.CANJE_BASE_URL || "https://www.compramelafoto.com").replace(/\/+$/, "");
  const link = await createSharedGiftLink({
    albumId,
    printUnits: unidades,
    size: product.size,
    includesDigital: conDigital,
    ttlDays: dias,
  });
  console.log(`Álbum: ${album.title}`);
  console.log(`Producto: ${product.name} ${product.size} (${product.productId})`);
  console.log(`Pedido plantilla: ${link.orderId} · vence ${link.expiresAt.toISOString()}`);
  console.log(`LINK: ${baseUrl}/canje/${link.token}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
