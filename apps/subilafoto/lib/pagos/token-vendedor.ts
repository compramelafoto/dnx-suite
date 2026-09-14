import "server-only";

import { prisma } from "@repo/db";
import { claveDeCifrado, descifrarCredencial, esCredencial } from "./credencial";

/**
 * El token de Mercado Pago del vendedor, descifrado.
 *
 * Vive en su propio módulo y no dentro de una ruta: Next rechaza exportar
 * cualquier cosa que no sea un manejador desde un `route.ts`, y además esto lo
 * usan el checkout y el aviso de pago.
 *
 * Devuelve `null` si el vendedor todavía no conectó su cuenta, que es un estado
 * normal y no un error: recién conectada empieza a poder vender.
 */
export async function tokenDelVendedor(perfilId: string): Promise<string | null> {
  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { id: perfilId },
    select: { mpCredential: true },
  });
  if (!perfil || !esCredencial(perfil.mpCredential)) return null;
  return descifrarCredencial(perfil.mpCredential, claveDeCifrado()).accessToken;
}
