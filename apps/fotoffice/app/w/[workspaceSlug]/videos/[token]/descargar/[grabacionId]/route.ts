import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { registrarDescarga, type MotivoSinDescarga } from "@/lib/digitalizacion/servidor/videos-publicos";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXTOS: Record<MotivoSinDescarga, { estado: number; texto: string }> = {
  NO_EXISTE: { estado: 404, texto: "Este enlace no existe o ya no está disponible. Si te lo mandaron hace poco, pedile a quien te lo envió uno nuevo." },
  SALDO: { estado: 402, texto: "Para descargar tus videos primero tenés que pagar el saldo del pedido. Volvé a la página de tus videos para ver cómo pagarlo." },
  BORRADO: { estado: 410, texto: "Los videos de este pedido ya se borraron." },
  SIN_CUPO: { estado: 403, texto: "Ya usaste todas las descargas de este video." },
};

function pagina(motivo: MotivoSinDescarga, volver: string): Response {
  const { estado, texto } = TEXTOS[motivo];
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>No se pudo descargar</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.4rem">No se pudo descargar</h1><p>${texto}</p>${motivo === "NO_EXISTE" ? "" : `<p><a href="${volver}">Volver a mis videos</a></p>`}</body></html>`;
  return new Response(html, { status: estado, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/**
 * Descarga contada de un video (spec 2026-10-22, E5): valida token, pedido, saldo, vencimiento y
 * cupo, registra la descarga y redirige (302) a la URL firmada de 24 h con `attachment`. Una
 * descarga reanudada usa esa misma URL y no vuelve a pasar por acá.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceSlug: string; token: string; grabacionId: string }> }) {
  const { workspaceSlug, token, grabacionId } = await params;
  const volver = `/w/${encodeURIComponent(workspaceSlug)}/videos/${encodeURIComponent(token)}`;
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `videos-descargar:${ip}`, limit: 30, windowMs: 10 * 60 * 1000 }).allowed) {
    return new Response("Demasiados pedidos. Esperá unos minutos.", { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) return pagina("NO_EXISTE", volver);
  const r = await registrarDescarga(workspaceId, token, grabacionId);
  if (!r.ok) return pagina(r.motivo, volver);
  return new Response(null, { status: 302, headers: { Location: r.url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

/**
 * Sin esto Next responde HEAD llamando a GET, y un antivirus o una vista previa de enlaces que
 * pregunte con HEAD gastaría una descarga.
 */
export async function HEAD() {
  return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } });
}
