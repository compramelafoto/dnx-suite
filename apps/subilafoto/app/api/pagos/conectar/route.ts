import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import {
  ConnectError,
  startMpConnection,
} from "@repo/payments/mercado-pago-connect";
import { dependenciasDeConexion } from "@/lib/pagos/dependencias";
import { SUBILAFOTO_PRODUCTO, referenciaDelVendedor } from "@/lib/pagos/constantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VUELTA = "/panel";

/**
 * Empieza la vinculación de la cuenta de MercadoPago del vendedor.
 *
 * Manda a MercadoPago para que autorice. El estado queda del lado del servidor —sólo su
 * hash— y el verificador PKCE cifrado: aunque alguien intercepte el código de
 * autorización, no puede canjearlo.
 */
export async function GET(request: Request) {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) {
    return NextResponse.redirect(new URL("/login?next=%2Fpanel", request.url));
  }

  const perfil = await prisma.subilafotoSellerProfile.findFirst({
    where: { userId: usuario.id },
    select: { id: true, displayName: true },
  });
  if (!perfil) {
    return NextResponse.redirect(new URL(`${VUELTA}?pago=sin-perfil`, request.url));
  }

  try {
    const { authorizeUrl } = await startMpConnection(
      {
        organizationRef: referenciaDelVendedor(perfil.id),
        userId: usuario.id,
        legalName: perfil.displayName,
      },
      { ...dependenciasDeConexion(), product: SUBILAFOTO_PRODUCTO },
    );
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    // El detalle nunca llega al navegador: puede traer nombres de variables de entorno
    // o mensajes del proveedor.
    const codigo = error instanceof ConnectError ? error.code : "ERROR";
    console.error("[subilafoto][mp-conectar] falló el inicio", { codigo });
    return NextResponse.redirect(new URL(`${VUELTA}?pago=${codigo}`, request.url));
  }
}
