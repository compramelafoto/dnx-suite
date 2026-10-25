import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { isSalePublicId } from "@repo/muestras";
import { cookieDePedido, tokenConForma } from "./cookie-pedido";
import { tokenValido } from "./pedido";

/**
 * La entrada del enlace del comprador (`/compras/<publicId>/entrar?t=…`, etapa 8, D25): si el token
 * abre el pedido (se compara con el hash guardado), pasa a la cookie del pedido; después redirige
 * (303) a `/compras/<publicId>` sin el token, para que no quede en el historial. Un token que no
 * abre el pedido no toca la cookie que ya hubiera.
 */
export async function entrarAlPedido(req: Request, publicId: string): Promise<Response> {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const valido = isSalePublicId(publicId) && tokenConForma(t)
    ? tokenValido(t, (await prisma.culturalSaleOrder.findUnique({ where: { publicId }, select: { accessTokenHash: true } }))?.accessTokenHash ?? "")
    : false;
  const destino = new URL(isSalePublicId(publicId) ? `/compras/${publicId}` : "/", url);
  const res = NextResponse.redirect(destino, 303);
  if (valido) res.cookies.set(cookieDePedido(publicId, t!));
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
