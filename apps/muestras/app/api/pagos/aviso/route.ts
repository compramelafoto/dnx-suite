import { after } from "next/server";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { AVISO_ENCABEZADO, verificarAviso } from "@/lib/ventas/aviso-firma";
import { conciliarPedido } from "@/lib/ventas/conciliar";
import { credencialesDeVentas } from "@/lib/ventas/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El aviso firmado de CLF: "la orden X cambió" (etapa 8, D31). No dice nada del pago: Muestras le
 * pregunta a Mercado Pago con su propio token y concilia en segundo plano. Nunca dice si el pedido
 * existe.
 */
const MAX_BYTES = 2048;
const ID_ORDEN = /^[A-Z0-9]{8,64}$/;
const ENCABEZADOS = { "Cache-Control": "private, no-store" } as const;
const responder = (cuerpo: Record<string, unknown>, status: number) => Response.json(cuerpo, { status, headers: ENCABEZADOS });

export async function POST(req: Request) {
  const largo = Number(req.headers.get("content-length") ?? "0");
  if (largo > MAX_BYTES) return responder({ ok: false }, 413);
  const cuerpo = await req.text();
  if (Buffer.byteLength(cuerpo) > MAX_BYTES) return responder({ ok: false }, 413);

  const veredicto = verificarAviso(credencialesDeVentas().avisoSecret, req.headers.get(AVISO_ENCABEZADO), cuerpo, Math.floor(Date.now() / 1000));
  if (veredicto === "sin-configurar") return responder({ ok: false, error: "Falta MUESTRAS_AVISO_PAGOS_SECRET." }, 503);
  if (veredicto !== "ok") return responder({ ok: false }, 401);
  if (!frenarPorIp("avisoPagos", ipDeLaPeticion(req.headers)).allowed) return responder({ ok: false }, 429);

  let providerOrderId: unknown;
  try {
    providerOrderId = (JSON.parse(cuerpo) as { providerOrderId?: unknown } | null)?.providerOrderId;
  } catch {
    providerOrderId = null;
  }
  if (typeof providerOrderId !== "string" || !ID_ORDEN.test(providerOrderId)) return responder({ ok: false }, 400);

  const id = providerOrderId;
  after(async () => {
    try {
      await conciliarPedido({ providerOrderId: id }, "NOTICE");
    } catch (error) {
      console.error("[muestras][ventas] conciliar por aviso:", (error as { name?: string })?.name ?? "Error");
    }
  });
  return responder({ ok: true }, 202);
}
