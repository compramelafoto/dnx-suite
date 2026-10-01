import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  ConnectError,
  completeMpConnection,
} from "@repo/payments/mercado-pago-connect";
import { dependenciasDeConexion } from "@/lib/pagos/dependencias";
import { SUBILAFOTO_PRODUCTO, perfilDesdeReferencia } from "@/lib/pagos/constantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VUELTA = "/panel";

/**
 * Vuelta de MercadoPago con el código de autorización.
 *
 * El estado se valida contra la base y se marca usado **antes** de canjear el código: si
 * se pudiera reusar, alguien que capture esta URL podría reconectar la cuenta cuando
 * quisiera. Esa validación vive en el paquete y la comparten todos los productos.
 */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const volver = (mensaje: string) =>
    NextResponse.redirect(new URL(`${VUELTA}?pago=${mensaje}`, request.url));

  if (parametros.get("error")) return volver("cancelado");

  const codigo = parametros.get("code");
  const estado = parametros.get("state");
  if (!codigo || !estado) return volver("incompleto");

  try {
    const resultado = await completeMpConnection(
      { code: codigo, state: estado },
      { ...dependenciasDeConexion(), product: SUBILAFOTO_PRODUCTO },
    );

    const perfilId = perfilDesdeReferencia(resultado.organizationRef);
    if (perfilId) {
      // `mpConnected` es sólo para mostrar: la verdad de la conexión vive en
      // `DnxPaymentAccount`. Se guarda igual para no consultar la capa financiera
      // cada vez que se pinta el panel.
      await prisma.subilafotoSellerProfile.updateMany({
        where: { id: perfilId },
        data: { mpConnected: true },
      });
    }

    return volver("conectado");
  } catch (error) {
    const codigoDeError = error instanceof ConnectError ? error.code : "ERROR";
    console.error("[subilafoto][mp-conectar] falló el retorno", { codigo: codigoDeError });
    return volver(codigoDeError);
  }
}
