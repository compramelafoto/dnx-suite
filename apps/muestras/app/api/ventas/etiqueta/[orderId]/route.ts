import { descargarPieza } from "@/lib/ventas/descarga-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** La pieza "etiqueta" de un pedido pagado (o de una P/A con `?copia=<id>`), para quien prepara las copias. */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return descargarPieza(req, orderId, "etiqueta");
}
