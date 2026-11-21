import { entrarAlPedido } from "@/lib/ventas/entrar-pedido";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ publicId: string }> };

/** El enlace del pedido del comprador: valida el token, lo guarda en la cookie y redirige sin él. */
export async function GET(req: Request, { params }: Ctx) {
  const { publicId } = await params;
  return entrarAlPedido(req, publicId);
}
