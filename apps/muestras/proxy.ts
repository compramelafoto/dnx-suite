import { NextResponse, type NextRequest } from "next/server";
import { isSalePublicId } from "@repo/muestras";
import { cookieDePedido, tokenConForma } from "@/lib/ventas/cookie-pedido";

/**
 * El enlace del pedido del comprador (`/compras/<publicId>?t=…`, etapa 8, D25): el token pasa a la
 * cookie del pedido y se redirige (303) a la misma dirección sin el token, para que no quede en el
 * historial ni en una captura de pantalla. Acá no se valida contra la base: la página y las
 * descargas comparan siempre el token con el hash guardado, y uno que no abre nada no sirve.
 */
export function proxy(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const publicId = req.nextUrl.pathname.split("/")[2] ?? "";
  if (!tokenConForma(t) || !isSalePublicId(publicId)) return NextResponse.next();
  const destino = req.nextUrl.clone();
  destino.searchParams.delete("t");
  const res = NextResponse.redirect(destino, 303);
  res.cookies.set(cookieDePedido(publicId, t));
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = { matcher: ["/compras/:publicId"] };
