import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { respuestaPlaylist, respuestaSinPlaylist } from "@/lib/digitalizacion/hls";
import { playlistHlsFirmada } from "@/lib/digitalizacion/servidor/almacen";
import { vistaDeEntregaPublica, type MotivoSinVista } from "@/lib/digitalizacion/servidor/videos-publicos";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESTADOS: Record<MotivoSinVista, number> = { NO_EXISTE: 404, CANCELADO: 410, SALDO: 402, BORRADO: 410, PREPARANDO: 404 };

/**
 * "Ver" de la página pública de videos (spec 2026-10-22, E10), sin sesión: el token es la llave.
 * Devuelve la playlist HLS 720p con los segmentos firmados (4 h o lo que le quede a la entrega).
 * Mirar no cuenta descargas y nunca firma el MP4 Full HD.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceSlug: string; token: string; grabacionId: string }> }) {
  const { workspaceSlug, token, grabacionId } = await params;
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `videos-ver:${ip}`, limit: 120, windowMs: 10 * 60 * 1000 }).allowed) {
    return respuestaSinPlaylist(429, "Demasiados pedidos. Esperá unos minutos.");
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) return respuestaSinPlaylist(404, "No disponible.");
  const r = await vistaDeEntregaPublica(workspaceId, token, grabacionId);
  if (!r.ok) return respuestaSinPlaylist(ESTADOS[r.motivo], "No disponible.");
  const texto = await playlistHlsFirmada(r.hlsKey, r.segundos);
  if (!texto) return respuestaSinPlaylist(404, "No disponible.");
  return respuestaPlaylist(texto);
}
