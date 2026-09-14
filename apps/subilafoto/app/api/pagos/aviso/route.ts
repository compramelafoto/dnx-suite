import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { decidirDesdeElPago, type PagoDeMercadoPago } from "@/lib/pagos/aviso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aviso de pago de Mercado Pago.
 *
 * **La idempotencia vive en la base, no acá.** `mpPaymentId` es único y el
 * cambio de estado es un `updateMany` condicionado a que la orden siga
 * pendiente. Si el mismo aviso llega tres veces —y llega: Mercado Pago
 * reintenta— la segunda y la tercera cambian cero filas y se van.
 *
 * Siempre se responde 200, aun cuando el aviso no se pueda usar. Un 500 hace
 * que Mercado Pago reintente para siempre un aviso que nunca va a servir.
 */
export async function POST(req: Request) {
  let cuerpo: { data?: { id?: unknown }; type?: string; action?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ recibido: true, nota: "cuerpo ilegible" });
  }

  const url = new URL(req.url);
  const idPago = String(cuerpo?.data?.id ?? url.searchParams.get("data.id") ?? "").trim();
  const tipo = cuerpo?.type ?? url.searchParams.get("type") ?? "";

  // Sólo interesan los avisos de pago. Los demás se aceptan y se descartan.
  if (tipo !== "payment" || !idPago) {
    return NextResponse.json({ recibido: true, nota: "no es un aviso de pago" });
  }

  const pago = await traerPago(idPago);
  if (!pago) return NextResponse.json({ recibido: true, nota: "no se pudo leer el pago" });

  const decision = decidirDesdeElPago(pago);
  if (decision.accion === "ESPERAR" || decision.accion === "IGNORAR") {
    return NextResponse.json({ recibido: true, accion: decision.accion });
  }

  if (decision.accion === "FALLAR") {
    await prisma.subilafotoOrder.updateMany({
      where: { id: decision.ordenId, status: "PENDING" },
      data: { status: "FAILED", mpPaymentId: decision.mpPaymentId },
    });
    return NextResponse.json({ recibido: true, accion: "FALLAR" });
  }

  if (decision.accion === "DEVOLVER") {
    await prisma.subilafotoOrder.updateMany({
      where: { id: decision.ordenId, status: "PAID" },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    return NextResponse.json({ recibido: true, accion: "DEVOLVER" });
  }

  const creado = await marcarPagada(decision.ordenId, decision.mpPaymentId);
  return NextResponse.json({ recibido: true, accion: "PAGAR", ...creado });
}

/**
 * Marca la orden como pagada. Sólo la primera vez hace algo.
 *
 * La condición `status: PENDING` la resuelve Postgres: si dos avisos llegan a
 * la vez, el segundo cambia cero filas y no crea ningún evento. Es lo que
 * cumple el criterio 3.3 — reenviar el mismo aviso tres veces crea **un** evento.
 */
async function marcarPagada(ordenId: string, mpPaymentId: string) {
  const cambio = await prisma.subilafotoOrder.updateMany({
    where: { id: ordenId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), mpPaymentId },
  });

  if (cambio.count === 0) return { yaEstaba: true };

  return { yaEstaba: false };
}

/**
 * Le pregunta a Mercado Pago por el pago.
 *
 * **No se confía en el cuerpo del aviso**: cualquiera puede llamar a esta ruta
 * diciendo que un pago se aprobó. El estado se lee de la API de Mercado Pago
 * con nuestro propio token, que es la única fuente que vale.
 */
async function traerPago(idPago: string): Promise<PagoDeMercadoPago | null> {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) return null;

  try {
    const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${idPago}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as PagoDeMercadoPago;
  } catch {
    return null;
  }
}
