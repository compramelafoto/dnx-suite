import { descargaDelComprador } from "@/lib/ventas/descarga-comprador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ publicId: string }> };

/** Descarga del comprador (etapa 8): sólo con su token o su cookie, pedido pagado y copia emitida. */
export async function GET(req: Request, { params }: Ctx) {
  const { publicId } = await params;
  return descargaDelComprador(req, publicId, "certificado");
}
