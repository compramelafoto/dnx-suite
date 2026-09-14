import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { leerEstado } from "@/lib/pagos/estado-oauth";
import { canjearCodigo } from "@/lib/pagos/oauth";
import { cifrarCredencial, claveDeCifrado } from "@/lib/pagos/credencial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vuelta de Mercado Pago después de que el vendedor autorizó.
 *
 * El `state` se verifica **antes** de tocar la base. Sin eso, cualquiera podría
 * llamar a esta ruta con su propio código y conectar su cuenta de Mercado Pago
 * al perfil de otro vendedor.
 */
export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams;
  const base = new URL(req.url).origin;
  const alPanel = (mensaje: string) =>
    NextResponse.redirect(`${base}/panel?pago=${encodeURIComponent(mensaje)}`);

  if (parametros.get("error")) return alPanel("cancelado");

  const codigo = parametros.get("code");
  const estado = parametros.get("state");
  const secreto = process.env.AUTH_SECRET?.trim();
  if (!codigo || !estado || !secreto) return alPanel("incompleto");

  const perfilId = leerEstado(estado, secreto);
  if (!perfilId) return alPanel("estado-invalido");

  let datos;
  try {
    datos = await canjearCodigo(codigo);
  } catch {
    return alPanel("rechazado");
  }

  // El token se guarda cifrado: con él se puede cobrar en nombre del vendedor.
  const credencial = cifrarCredencial(
    { accessToken: datos.access_token, refreshToken: datos.refresh_token ?? null },
    claveDeCifrado(),
  );

  await prisma.subilafotoSellerProfile.updateMany({
    where: { id: perfilId },
    data: {
      mpConnected: true,
      mpUserId: datos.user_id != null ? String(datos.user_id) : null,
      mpCredential: credencial,
      mpConnectedAt: new Date(),
      mpTokenExpiresAt: datos.expires_in
        ? new Date(Date.now() + datos.expires_in * 1000)
        : null,
    },
  });

  return alPanel("conectado");
}
