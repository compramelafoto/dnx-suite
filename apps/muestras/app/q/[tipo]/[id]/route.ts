import { esDeQuienOrganiza, pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { destinoDelQr } from "@/lib/estadisticas/qr";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tipo: string; id: string }> };

/** 302 sin caché: cada escaneo vuelve a pasar por acá (decisión D12). */
function redirigir(req: Request, path: string) {
  return new Response(null, { status: 302, headers: { Location: new URL(path, req.url).toString(), "Cache-Control": "private, no-store" } });
}

/** QR impreso en fichas, carteles, catálogos y afiches: cuenta el escaneo y lleva a la página. */
export async function GET(req: Request, { params }: Ctx) {
  const { tipo, id } = await params;
  let destino;
  try {
    destino = await destinoDelQr(tipo, id);
  } catch (err) {
    console.error("[q] no se pudo leer el destino:", err instanceof Error ? err.message : String(err));
    return redirigir(req, "/");
  }
  if (!destino) return redirigir(req, "/");
  try {
    if (
      pedidoContable(req.headers) &&
      frenarPorIp("escaneos", ipDeLaPeticion(req.headers)).allowed &&
      !(await esDeQuienOrganiza(destino.proposedByUserId))
    ) {
      await sumarUno({ activityId: destino.activityId, workId: destino.workId, metric: destino.metric });
    }
  } catch (err) {
    // Contar nunca puede romper un QR impreso.
    console.error("[q] no se pudo contar el escaneo:", err instanceof Error ? err.message : String(err));
  }
  return redirigir(req, destino.path);
}

/** Algunos lectores de QR preguntan con HEAD antes de abrir: se redirige sin contar. */
export async function HEAD(req: Request, { params }: Ctx) {
  const { tipo, id } = await params;
  const destino = await destinoDelQr(tipo, id).catch(() => null);
  return redirigir(req, destino?.path ?? "/");
}
