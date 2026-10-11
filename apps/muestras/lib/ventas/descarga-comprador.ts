import "server-only";
import { prisma } from "@repo/db";
import { frenarPorPedido } from "@/lib/limite";
import { archivoFirmado } from "./archivo-firmado";
import { pdfGuardado } from "./certificado";
import { abrirPedido } from "./pedido-comprador";

/**
 * Las descargas del comprador (etapa 8): el certificado (PDF) y, si compró la copia digital, el
 * archivo firmado. Sólo con el token o la cookie del pedido, sólo si el pedido está conciliado como
 * `PAID` y sólo para una copia `ISSUED` con certificado. Una copia anulada responde 410.
 */
const SIN_CACHE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

const texto = (cuerpo: string, status: number) => new Response(cuerpo, { status, headers: { ...SIN_CACHE, "Content-Type": "text/plain; charset=utf-8" } });

export async function descargaDelComprador(req: Request, publicId: string, pieza: "certificado" | "archivo"): Promise<Response> {
  const t = new URL(req.url).searchParams.get("t");
  const abierto = await abrirPedido(publicId, t);
  if (!abierto) return texto("No encontramos este pedido.", 404);
  const { pedido } = abierto;
  if (!frenarPorPedido("descargaVenta", pedido.publicId).allowed) return texto("Hiciste muchas descargas seguidas. Esperá un rato.", 429);
  const copia = pedido.copyId
    ? await prisma.culturalEditionCopy.findUnique({ where: { id: pedido.copyId }, select: { id: true, status: true, orderId: true, certificateCode: true } })
    : null;
  if (copia?.status === "VOIDED") return texto("Esta copia fue anulada.", 410);
  if (pedido.status !== "PAID" || !copia || copia.orderId !== pedido.id || copia.status !== "ISSUED" || !copia.certificateCode) {
    return texto("Todavía no hay nada para descargar en este pedido.", 404);
  }
  if (pieza === "certificado") {
    const pdf = await pdfGuardado(copia.id, "certificado");
    if (!pdf) return texto("Estamos preparando tu certificado. Probá en unos minutos.", 409);
    return new Response(Buffer.from(pdf), {
      headers: { ...SIN_CACHE, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="certificado-${copia.certificateCode}.pdf"` },
    });
  }
  const oferta = await prisma.culturalWorkOffer.findUnique({ where: { id: pedido.offerId }, select: { format: true } });
  if (oferta?.format !== "DIGITAL") return texto("Este pedido no incluye un archivo digital.", 404);
  const archivo = await archivoFirmado(pedido.id);
  if (!archivo) return texto("Estamos preparando tu archivo. Probá en unos minutos.", 409);
  return new Response(new Uint8Array(archivo.bytes), {
    headers: { ...SIN_CACHE, "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="${archivo.nombre}"` },
  });
}
