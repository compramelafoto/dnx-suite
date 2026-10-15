import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { loadPublicPortfolioContact } from "@/lib/portfolio/public-queries";
import { portfolioWhatsappUrl } from "@/lib/portfolio/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; portfolioSlug: string }> };

/**
 * Lleva a WhatsApp con el mensaje ya escrito.
 *
 * ── Por qué existe en vez de un enlace directo ──
 *
 * Un `wa.me/549...` en el HTML pone el teléfono de la persona en el código fuente de la página, y
 * un directorio con cien fichas sería cien teléfonos listos para cosechar. Acá el número se resuelve
 * en el servidor, al momento del clic: quien quiere contactar a alguien puede, quien quiere
 * levantar la lista completa no.
 *
 * ── Las mismas siete condiciones ──
 *
 * Esta ruta aplica la MISMA regla de visibilidad que la ficha. Si no lo hiciera sería la puerta
 * lateral para sacarle el teléfono a alguien cuyo portfolio no está publicado, que es justo lo que
 * la regla existe para evitar.
 */
export async function GET(_req: Request, { params }: Props) {
  const { workspaceSlug, portfolioSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const contacto = await loadPublicPortfolioContact({
    workspaceId: branding.workspaceId,
    publicSlug: portfolioSlug,
  });
  // Mismo 404 que una dirección inventada: no se distingue "no existe" de "no está publicado".
  if (!contacto) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const url = portfolioWhatsappUrl({
    phone: contacto.phone,
    displayName: contacto.displayName,
    institution: branding.commercialName,
  });
  if (!url) return NextResponse.json({ error: "No existe." }, { status: 404 });

  /*
   * 302 y no 301: el número puede cambiar, y un 301 se queda cacheado en el navegador de la gente
   * para siempre. `no-store` por lo mismo.
   */
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
