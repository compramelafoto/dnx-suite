import { createHash } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { esBot, esDelMismoSitio, esPrefetch, FRENO_VISITAS, MAX_LARGO_RUTA, normalizarRutaVisita } from "@/lib/website/visitas";
import { sitioParaContar, sumarVisita } from "@/lib/website/visitas.server";

/**
 * Cuenta una visita a una página del sitio público. La llama el beacon del navegador
 * (`components/website/render/contador-visitas.tsx`) después de que la página se dibujó, así no
 * frena el render ni cuenta lo que arma el servidor de antemano o sirve la CDN.
 *
 * Siempre responde 204 (sin cuerpo, sin cookies): que una visita no se cuente nunca es un error
 * para quien navega. No se cuentan bots, precargas, pedidos que no salen del mismo sitio, rutas
 * con token ni rutas que no son del sitio (ver `normalizarRutaVisita`). No se guarda IP ni nada
 * personal: el freno por conexión vive en memoria un minuto, con una huella de la IP.
 * Sirve igual en el dominio propio: ahí `/api/*` pasa sin tocar por el proxy.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El cuerpo es `{"ruta":"/…"}`: más que esto no es un beacon nuestro. */
const MAX_BYTES_CUERPO = 1024;

function nada(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  if (esBot(req.headers.get("user-agent")) || esPrefetch(req.headers) || !esDelMismoSitio(req.headers)) return nada();
  const largo = Number(req.headers.get("content-length") ?? "0");
  if (largo > MAX_BYTES_CUERPO) return nada();

  const texto = await req.text().catch(() => "");
  if (!texto || texto.length > MAX_BYTES_CUERPO) return nada();
  let ruta: unknown;
  try {
    ruta = (JSON.parse(texto) as { ruta?: unknown })?.ruta;
  } catch {
    return nada();
  }
  if (typeof ruta !== "string" || ruta.length > MAX_LARGO_RUTA) return nada();

  const { workspaceSlug } = await params;
  if (!/^[a-z0-9-]{1,80}$/i.test(workspaceSlug)) return nada();

  // Freno simple: hasta 60 avisos por minuto por conexión y sitio (por instancia, en memoria).
  const ip = clientIp(req.headers);
  if (ip !== "desconocido") {
    const huella = createHash("sha256").update(ip).digest("hex").slice(0, 24);
    if (!checkRateLimit({ key: `sitio-visita:${workspaceSlug}:${huella}`, ...FRENO_VISITAS }).allowed) return nada();
  }

  // Contar después de responder: el navegador no espera la escritura.
  after(async () => {
    try {
      const sitio = await sitioParaContar(workspaceSlug);
      if (!sitio) return;
      const normalizada = normalizarRutaVisita(ruta, workspaceSlug, sitio.paginasPropias);
      if (normalizada) await sumarVisita(sitio.workspaceId, normalizada);
    } catch (err) {
      console.error("[fotoffice][sitio] no se pudo contar la visita:", err);
    }
  });
  return nada();
}
