import { prisma } from "@/lib/prisma";

/**
 * Las versiones con marca de agua se generan en segundo plano después de cada subida. Un script
 * que termina antes las corta: esto espera a que las fotos del álbum terminen (o falle el plazo).
 */
export async function esperarVariantesDelAlbum(albumId: number, plazoMs = 300_000): Promise<number> {
  const hasta = Date.now() + plazoMs;
  for (;;) {
    const pendientes = await prisma.photo.count({
      where: { albumId, variantsStatus: { notIn: ["READY", "FAILED"] } },
    });
    if (pendientes === 0 || Date.now() > hasta) return pendientes;
    await new Promise((r) => setTimeout(r, 3000));
  }
}
