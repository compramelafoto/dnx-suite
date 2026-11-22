import { marcaPorHost } from "@/lib/marca";
import { robotsDe } from "@/lib/sitio/sitemap";

// Depende del dominio del pedido: no puede ser estática. El CDN lo cachea una hora por host.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const marca = marcaPorHost(req.headers.get("host"));
  return new Response(robotsDe(marca), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600", Vary: "Host" },
  });
}
