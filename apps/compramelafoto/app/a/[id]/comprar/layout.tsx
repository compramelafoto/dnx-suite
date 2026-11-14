import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { shouldUseIntlFlow } from "@/lib/international/intl-order";

/**
 * CLF internacional (piloto): un álbum en otra moneda no usa la compra argentina
 * (impresiones, packs, videos). Cualquier entrada a /comprar va a la compra internacional.
 */
export default async function ComprarLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const albumId = Number(id);
  let intl = false;
  if (Number.isInteger(albumId) && albumId > 0) {
    try {
      const album = await prisma.album.findUnique({ where: { id: albumId }, select: { currency: true } });
      intl = Boolean(album && shouldUseIntlFlow(album.currency));
    } catch {
      // Si la consulta falla, la compra argentina sigue como siempre.
      intl = false;
    }
  }
  if (intl) redirect(`/a/${albumId}/comprar-intl`);
  return <>{children}</>;
}
