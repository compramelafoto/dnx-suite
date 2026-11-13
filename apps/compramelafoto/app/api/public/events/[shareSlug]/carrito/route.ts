import { NextRequest, NextResponse } from "next/server";
import { POST as crearPedidoAlbum } from "@/app/api/a/[id]/orders/route";
import { cotizarCarrito, crearCarritoEvento } from "@/lib/split-1n-carrito-evento/crear";
import { marcarPedidoDeCarrito } from "@/lib/split-1n-carrito-evento/pedido-interno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encabezados del comprador que la ruta de pedidos usa (sesión, bot, auditoría). */
const ENCABEZADOS = ["cookie", "user-agent", "x-forwarded-for", "x-real-ip", "accept-language"];

/**
 * POST /api/public/events/[shareSlug]/carrito
 * Carrito de evento (Split 1:N): fotos de varios fotógrafos del evento, un solo pago.
 *
 * Body: { accion: "cotizar" | "comprar", fotos: number[], buyerEmail, buyerName, buyerPhone, termsAccepted }
 * Responde 404 mientras el carrito esté apagado para el evento.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ shareSlug: string }> }) {
  try {
    const { shareSlug } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.accion === "cotizar") {
      return responder(await cotizarCarrito(shareSlug, body.fotos));
    }
    if (body.accion !== "comprar") {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    const comprador = {
      buyerEmail: typeof body.buyerEmail === "string" ? body.buyerEmail : "",
      buyerName: typeof body.buyerName === "string" ? body.buyerName : null,
      buyerPhone: typeof body.buyerPhone === "string" ? body.buyerPhone : "",
      termsAccepted: body.termsAccepted === true,
    };
    const resultado = await crearCarritoEvento({
      shareSlug,
      fotos: body.fotos,
      crearPedido: async (albumId, items, basePorFoto) => {
        const headers = new Headers({ "content-type": "application/json" });
        for (const nombre of ENCABEZADOS) {
          const valor = req.headers.get(nombre);
          if (valor) headers.set(nombre, valor);
        }
        const interno = marcarPedidoDeCarrito(
          new NextRequest(new URL(`/api/a/${albumId}/orders`, req.nextUrl.origin), {
            method: "POST",
            headers,
            body: JSON.stringify({ ...comprador, items }),
          }),
          basePorFoto ? { basePorFoto } : {},
        );
        const res = await crearPedidoAlbum(interno, { params: Promise.resolve({ id: String(albumId) }) });
        const data = (await res.json().catch(() => ({}))) as { id?: unknown; carritoEvento?: unknown; error?: unknown };
        if (res.status === 201 && data.carritoEvento === true && typeof data.id === "number") {
          return { ok: true, pedidoId: data.id };
        }
        return {
          ok: false,
          status: res.status >= 400 ? res.status : 500,
          error: typeof data.error === "string" ? data.error : "No pudimos armar tu compra.",
        };
      },
    });
    return responder(resultado);
  } catch (err: unknown) {
    console.error("POST /api/public/events/[shareSlug]/carrito ERROR >>>", err);
    return NextResponse.json({ error: "No pudimos armar tu compra. Probá de nuevo." }, { status: 500 });
  }
}

function responder(r: Awaited<ReturnType<typeof cotizarCarrito>>) {
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  // Los motivos (quién no tiene consentimiento, etc.) quedan en el registro, no van al comprador.
  if (r.modo === "por_album") return NextResponse.json({ modo: r.modo, albumes: r.albumes });
  const { ok: _ok, ...resto } = r;
  return NextResponse.json(resto, { status: 200 });
}
