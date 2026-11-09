import "server-only";
import { prisma } from "@repo/db";
import { resolveUnsubscribeSecret, verifyUnsubscribeToken } from "@/lib/mailing/unsubscribe-token";
import { cambiarEstado } from "../buscador/contactos";
import { registrarBajaDireccion } from "./bloqueos";
import { AMBITO_BAJA_VENDEDOR } from "./correo";
import { AUTOR_VENDEDOR } from "./tipos";

/**
 * Baja de los correos del Vendedor. El token es el mismo firmado de las bajas de FOTOFFICE, pero con
 * el ámbito `dnx-vendedor` en lugar de una institución: una baja de socios no sirve acá, ni al revés.
 *
 * Dar de baja anota la casilla en `DnxVendedorBaja` (siempre, haya o no un contacto con ella: el
 * Vendedor no le escribe más a esa dirección), pasa a `NO_CONTACTAR` (permanente) todos los contactos
 * con esa casilla y cierra sus hilos.
 */

/** La casilla del token, o null si no es un token válido de baja del Vendedor. */
export function leerBajaVendedor(token: string | null | undefined): { email: string } | null {
  const secreto = resolveUnsubscribeSecret();
  if (!secreto) return null;
  const p = verifyUnsubscribeToken(token, secreto);
  if (!p || p.workspaceId !== AMBITO_BAJA_VENDEDOR) return null;
  return { email: p.email };
}

export async function darDeBajaVendedor(token: string | null): Promise<"OK" | "INVALIDO"> {
  const p = leerBajaVendedor(token);
  if (!p) return "INVALIDO";

  await registrarBajaDireccion(p.email);

  const contactos = await prisma.dnxContacto.findMany({
    where: { OR: [{ claveEmail: p.email }, { email: { equals: p.email, mode: "insensitive" } }] },
    select: { id: true },
  });
  const ids = contactos.map((c) => c.id);
  for (const id of ids) {
    const r = await cambiarEstado(id, "NO_CONTACTAR", AUTOR_VENDEDOR);
    if (!r.ok) throw new Error(`Vendedor: no se pudo dar de baja un contacto (${r.motivo ?? "sin motivo"})`);
  }
  if (ids.length > 0) {
    await prisma.dnxVendedorHilo.updateMany({
      where: { contactoId: { in: ids }, estado: { not: "BAJA" } },
      data: { estado: "BAJA", cierre: "BAJA" },
    });
  }
  return "OK";
}
