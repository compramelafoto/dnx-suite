import { NextRequest, NextResponse } from "next/server";
import { crearGrupoConPago } from "@/lib/preventa-canjeable/pago-grupo/servicio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/precompra/grupo-pago
 * Body: { orderIds: number[], buyerEmail: string }
 *
 * Varios packs de preventa en UN solo pago: recibe los pedidos (uno por pack) que la pantalla
 * acaba de armar y devuelve el link de Mercado Pago que cobra todos juntos. Si no se pueden
 * cobrar juntos responde 409 y la pantalla sigue con un pago por pack (pagos encadenados).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderIds: number[] = Array.isArray(body?.orderIds)
      ? body.orderIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    const buyerEmail = typeof body?.buyerEmail === "string" ? body.buyerEmail.trim() : "";
    if (orderIds.length < 2 || orderIds.length > 20 || !buyerEmail) {
      return NextResponse.json({ error: "Faltan los pedidos o el email.", code: "DATOS_INVALIDOS" }, { status: 400 });
    }
    const r = await crearGrupoConPago({ orderIds, buyerEmail });
    if (!r.ok) return NextResponse.json({ error: r.error, code: r.codigo }, { status: r.httpStatus });
    return NextResponse.json({ initPoint: r.initPoint, paymentGroupId: r.grupoId, orderIds: r.orderIds, reused: r.reused });
  } catch (err: unknown) {
    console.error("[preventa-grupo] POST grupo-pago falló", { err: String(err) });
    return NextResponse.json({ error: "No pudimos abrir el pago conjunto.", code: "ERROR" }, { status: 500 });
  }
}
