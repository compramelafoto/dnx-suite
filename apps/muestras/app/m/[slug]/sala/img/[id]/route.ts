import { leerDeR2 } from "@/lib/imagenes/r2";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { imagenDeSalaPermitida, paseDeSala } from "@/lib/sala/consultas";
import { MUCHAS_CONSULTAS, MUCHA_GENTE_EN_LA_RED, frenarEnSala } from "@/lib/sala/freno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sólo los formatos que genera la subida (y los comunes de foto). Cualquier otro tipo no se sirve. */
const TIPOS_PERMITIDOS = new Set(["image/webp", "image/jpeg", "image/png"]);

const noEncontrada = () =>
  new Response("No encontrada", { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });

/**
 * La imagen de una obra en la vista de sala (spec D32), por proxy: la dirección del bucket es
 * pública y no vence, así que nunca llega a la página. Valida el pase de sala (o que quien mira
 * sea del equipo) en cada pedido. Cualquier negativa responde 404: no se confirma que exista.
 */
const demasiados = (texto: string) =>
  new Response(texto, {
    status: 429,
    headers: { "Cache-Control": "private, no-store", "Retry-After": "60", "X-Content-Type-Options": "nosniff", "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const ip = ipDeLaPeticion(req.headers);
  // Alto por IP (el público comparte el Wi-Fi de la sala); el tope fino va por pase, ya validado.
  if (!frenarPorIp("imagenSalaRed", ip).allowed) return demasiados(MUCHA_GENTE_EN_LA_RED);
  const { slug, id } = await params;
  const p = await paseDeSala(slug).catch(() => null);
  if (!p || (!p.pase && !p.equipo)) return noEncontrada();
  if (!frenarEnSala("imagenSala", p, ip)) return demasiados(MUCHAS_CONSULTAS);
  const url = await imagenDeSalaPermitida(slug, id, p).catch(() => null);
  if (!url) return noEncontrada();
  const archivo = await leerDeR2(url);
  if (!archivo) return noEncontrada();
  const base = archivo.contentType.split(";")[0]!.trim().toLowerCase();
  if (!TIPOS_PERMITIDOS.has(base)) {
    await archivo.cuerpo.cancel().catch(() => {});
    return noEncontrada();
  }
  return new Response(archivo.cuerpo, {
    headers: {
      "Content-Type": base,
      // Privada: ni el CDN ni un proxy compartido la guardan para otra persona.
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
    },
  });
}
