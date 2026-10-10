import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { obrasDelAnticipo } from "@/lib/anticipo/elegir";
import { recordarAnticipo, ultimoAnticipo } from "@/lib/anticipo/memoria";
import { frenarPorIp, huellaDeIp, ipDeLaPeticion } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENCABEZADOS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } as const;
const responder = (obras: unknown[], status = 200) => NextResponse.json({ obras }, { status, headers: ENCABEZADOS });

/**
 * "Cambian para cada visitante" (spec D23). La página de la muestra sigue en caché y no trae
 * ninguna obra expuesta: su galería pide acá N obras, elegidas en el servidor en cada pedido. Nunca
 * viaja el conjunto completo. Pasado el freno por IP, la misma respuesta que la última vez.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return responder([], 404);
  const ip = ipDeLaPeticion(req.headers);
  const huella = huellaDeIp(ip);
  if (!frenarPorIp("anticipo", ip).allowed) return responder(ultimoAnticipo(huella, slug));
  let obras;
  try {
    obras = await obrasDelAnticipo(slug, randomInt);
  } catch (err) {
    console.error("[anticipo] no se pudo elegir:", err instanceof Error ? err.message : String(err));
    return responder([], 500);
  }
  if (!obras) return responder([], 404);
  recordarAnticipo(huella, slug, obras);
  return responder(obras);
}
