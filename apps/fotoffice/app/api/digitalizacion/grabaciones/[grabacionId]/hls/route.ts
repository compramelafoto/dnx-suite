import type { NextRequest } from "next/server";
import { contextoDigitalizacion } from "@/lib/digitalizacion/contexto";
import { respuestaPlaylist, respuestaSinPlaylist } from "@/lib/digitalizacion/hls";
import { playlistHlsFirmada } from "@/lib/digitalizacion/servidor/almacen";
import { hlsDeGrabacion } from "@/lib/digitalizacion/servidor/grabaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Ver video" de la lista de Digitalización (spec 2026-10-22, E10): la playlist HLS de una
 * grabación del negocio activo, con los segmentos firmados por 4 h. Pide sesión con permiso de
 * Digitalización (VIEW) en ESE negocio.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ grabacionId: string }> }) {
  const { grabacionId } = await params;
  const ctx = await contextoDigitalizacion("VIEW");
  if (!ctx) return respuestaSinPlaylist(403, "Sin permiso.");
  const r = await hlsDeGrabacion(ctx, grabacionId);
  if (!r.ok) return respuestaSinPlaylist(404, r.error);
  const texto = await playlistHlsFirmada(r.hlsKey);
  if (!texto) return respuestaSinPlaylist(404, "La versión para mirar no está disponible.");
  return respuestaPlaylist(texto);
}
