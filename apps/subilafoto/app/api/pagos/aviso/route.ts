import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { decidirDesdeElPago, type PagoDeMercadoPago } from "@/lib/pagos/aviso";
import { crearEvento } from "@/lib/crear-evento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aviso de pago de Mercado Pago.
 *
 * En Checkout Pro la URL de aviso viaja en cada preferencia, así que esta ruta recibe sólo
 * los pagos de SubiLaFoto. Igual se verifica el prefijo de la referencia: la cuenta de
 * Mercado Pago es la misma para toda la suite.
 *
 * **La idempotencia vive en la base.** `mpPaymentId` es único y el cambio de estado es un
 * `updateMany` condicionado a que la orden siga pendiente. Si el mismo aviso llega tres
 * veces —y llega, Mercado Pago reintenta— la segunda y la tercera cambian cero filas.
 *
 * Siempre responde 200, aun cuando el aviso no sirva: un 500 hace que Mercado Pago
 * reintente para siempre algo que nunca va a funcionar.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);

  let cuerpo: { data?: { id?: unknown }; type?: string } = {};
  try {
    cuerpo = await req.json();
  } catch {
    // Mercado Pago también avisa por query string. No es un error.
  }

  const idPago = String(cuerpo?.data?.id ?? url.searchParams.get("data.id") ?? "").trim();
  const tipo = cuerpo?.type ?? url.searchParams.get("type") ?? "";

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

  return NextResponse.json({ recibido: true, ...(await acreditar(decision.ordenId, decision.mpPaymentId)) });
}

/**
 * Marca la orden pagada y crea su evento. Sólo la primera vez hace algo.
 *
 * La condición `status: PENDING` la resuelve Postgres: si dos avisos llegan a la vez, el
 * segundo cambia cero filas y no crea ningún evento. Es lo que cumple el criterio 3.3 —
 * reenviar el mismo aviso tres veces crea **un** evento.
 */
async function acreditar(ordenId: string, mpPaymentId: string) {
  const cambio = await prisma.subilafotoOrder.updateMany({
    where: { id: ordenId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), mpPaymentId },
  });
  if (cambio.count === 0) return { accion: "PAGAR", yaEstaba: true };

  const orden = await prisma.subilafotoOrder.findUnique({
    where: { id: ordenId },
    select: {
      kind: true,
      sellerProfileId: true,
      buyerName: true,
      eventId: true,
      includesDownload: true,
    },
  });
  if (!orden) return { accion: "PAGAR", yaEstaba: false };

  /*
    El adicional de descarga no crea ningún evento: se compra sobre uno que ya existe. Lo
    único que cambia es que ese evento pasa a tener la descarga comprada, y de ahí sale la
    generación del paquete.
  */
  if (orden.kind === "DOWNLOAD_ADDON") {
    if (!orden.eventId) return { accion: "PAGAR", yaEstaba: false };
    await prisma.subilafotoEvent.updateMany({
      where: { id: orden.eventId, downloadStatus: { notIn: ["PURCHASED", "DELIVERED"] } },
      data: { downloadStatus: "PURCHASED" },
    });
    return { accion: "PAGAR", yaEstaba: false, descargaComprada: true };
  }

  if (orden.eventId) return { accion: "PAGAR", yaEstaba: false };

  /*
    El evento nace sin fecha: la pone el cliente al configurarlo. Crearlo con una fecha
    inventada haría que la ventana de 12 horas empiece a correr sin que nadie lo sepa.
  */
  const alta = await crearEvento({
    sellerProfileId: orden.sellerProfileId,
    nombre: `Evento de ${orden.buyerName}`,
    tipo: "OTRO",
    fechaHoraLocal: "",
    zonaHoraria: "America/Argentina/Buenos_Aires",
  });

  if (!alta.ok) {
    // La orden queda pagada igual: la plata entró. El evento se crea a mano y queda
    // registrado el motivo; perder el pago sería mucho peor que crear el evento tarde.
    console.error("[subilafoto][aviso] no se pudo crear el evento", {
      orden: ordenId,
      error: alta.error,
    });
    return { accion: "PAGAR", yaEstaba: false, eventoCreado: false };
  }

  await prisma.subilafotoOrder.update({
    where: { id: ordenId },
    data: { eventId: alta.eventoId },
  });

  /*
    Si la venta incluía la descarga, el evento nace con la descarga ya comprada. De ahí
    sale la entrega automática: el paquete se arma y se manda dentro de las 24 horas, sin
    que el cliente tenga que pedir nada.
  */
  if (orden.includesDownload) {
    await prisma.subilafotoEvent.update({
      where: { id: alta.eventoId },
      data: { downloadStatus: "PURCHASED" },
    });
  }

  return { accion: "PAGAR", yaEstaba: false, eventoCreado: true, conDescarga: orden.includesDownload };
}

/**
 * Le pregunta a Mercado Pago por el pago.
 *
 * **No se confía en el cuerpo del aviso**: cualquiera puede llamar a esta ruta diciendo
 * que un pago se aprobó. El estado se lee de la API con nuestro token, que es la única
 * fuente que vale.
 */
async function traerPago(idPago: string): Promise<PagoDeMercadoPago | null> {
  const token = process.env.SUBILAFOTO_MP_ACCESS_TOKEN?.trim();
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
