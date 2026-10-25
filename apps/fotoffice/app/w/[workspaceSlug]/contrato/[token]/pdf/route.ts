import type { NextRequest } from "next/server";
import { noEncontrado, pdfParaDescargar, respuestaPdf } from "@/lib/contratos/descarga";
import { resolverTokenFirmante } from "@/lib/contratos/enlace";
import { visitanteDeAccion } from "../visitante";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El PDF sellado, para quien firmó: el token personal de su enlace es la llave. Se vuelve a resolver en
 * cada pedido (sigue sirviendo después de firmar) y sólo entrega el PDF si el contrato ya quedó FIRMADO
 * por todas las partes y el PDF existe. Enlace desconocido, vencido, reemplazado, contrato anulado o
 * todavía sin firmar: el mismo 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceSlug: string; token: string }> }) {
  const { workspaceSlug, token } = await params;
  const visitante = await visitanteDeAccion("pdf", 20);
  if (!visitante.permitido) return new Response("Demasiados pedidos. Esperá unos minutos.", { status: 429, headers: { "Cache-Control": "no-store" } });
  const r = await resolverTokenFirmante(workspaceSlug, token);
  if (!r.ok || r.contrato.status !== "FIRMADO") return noEncontrado();
  const pdf = await pdfParaDescargar(r.workspaceId, r.contrato.id);
  return pdf.ok ? respuestaPdf(pdf.bytes, pdf.nombre) : noEncontrado();
}
