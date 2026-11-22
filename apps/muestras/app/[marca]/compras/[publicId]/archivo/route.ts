import { descargaDelComprador } from "@/lib/ventas/descarga-comprador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ publicId: string }> };

/** Descarga del comprador (etapa 8): sólo con la cookie del pedido, pedido pagado y copia emitida. */
export async function GET(_req: Request, { params }: Ctx) {
  const { publicId } = await params;
  return descargaDelComprador(publicId, "archivo");
}
