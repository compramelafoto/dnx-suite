import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { hostWithoutPort } from "@/lib/website/domain/normalize";
import { keptReturnParams, storeOrderCookieName, storeVisibleBase } from "@/lib/store/order-access";
import { findStoreOrderForPage, tokenOpensOrder } from "@/lib/store/order-page";
import { loadStoreWorkspace } from "@/lib/store/repository";

export const dynamic = "force-dynamic";

const COOKIE_DIAS = 30;

type Params = { params: Promise<{ workspaceSlug: string; publicId: string }> };

/**
 * Cambia el token de la dirección (`?t=`) por la cookie del pedido, y vuelve a la página del
 * pedido sin el token. Existe porque una página no puede poner cookies (sólo una acción o una
 * ruta como ésta): la página, al ver un `?t=` válido, manda acá.
 *
 * Un token que no abre el pedido responde 404, igual que un pedido que no existe: no se revela
 * cuál de las dos cosas falló.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { workspaceSlug, publicId } = await params;
  const noEncontrado = new NextResponse("No encontrado", { status: 404, headers: { "Referrer-Policy": "no-referrer" } });

  // Sin exigir la tienda abierta: un pedido pagado se ve aunque la tienda se cierre.
  const store = await loadStoreWorkspace(workspaceSlug);
  if (!store) return noEncontrado;
  const pedido = await findStoreOrderForPage(store.workspace.id, publicId);
  const token = request.nextUrl.searchParams.get("t");
  if (!pedido || !tokenOpensOrder(token, pedido)) return noEncontrado;

  const host = hostWithoutPort(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "");
  const base = storeVisibleBase({ slug: store.workspace.slug, host, fotofficeOrigin: appUrl() });
  const resto = keptReturnParams(request.nextUrl.searchParams).toString();
  const destino = `${base}/pedido/${pedido.publicId}${resto ? `?${resto}` : ""}`;

  // Dirección relativa a propósito: así sirve igual en el dominio de FOTOFFICE y en el propio de
  // la institución, donde la dirección interna (`/w/<slug>/...`) no es la que ve el navegador.
  const respuesta = new NextResponse(null, {
    status: 303,
    headers: { Location: destino, "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" },
  });
  respuesta.cookies.set(storeOrderCookieName(pedido.publicId), token as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_DIAS * 24 * 60 * 60,
    path: base,
  });
  return respuesta;
}
