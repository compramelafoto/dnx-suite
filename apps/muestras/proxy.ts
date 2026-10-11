import { NextResponse, type NextRequest } from "next/server";
import { isSalePublicId } from "@repo/muestras";
import { tokenConForma } from "@/lib/ventas/cookie-pedido";

/**
 * El enlace del pedido del comprador (`/compras/<publicId>?t=…`, etapa 8, D25) pasa por
 * `/compras/<publicId>/entrar?t=…`, que compara el token con el hash guardado y sólo entonces lo
 * guarda en la cookie del pedido (acá no hay base: nunca se escribe la cookie desde el proxy, así un
 * `?t=` cualquiera no pisa la que ya tiene el comprador).
 */
export function proxy(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const publicId = req.nextUrl.pathname.split("/")[2] ?? "";
  if (!tokenConForma(t) || !isSalePublicId(publicId)) return NextResponse.next();
  const destino = req.nextUrl.clone();
  destino.pathname = `/compras/${publicId}/entrar`;
  destino.search = "";
  destino.searchParams.set("t", t);
  const res = NextResponse.redirect(destino, 303);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = { matcher: ["/compras/:publicId"] };
