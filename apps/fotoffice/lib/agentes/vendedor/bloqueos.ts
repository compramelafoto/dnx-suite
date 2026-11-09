import "server-only";
import { prisma } from "@repo/db";

/**
 * Casillas a las que el Vendedor no le escribe, miradas por la dirección y no por el contacto:
 * - las de cualquier contacto en `NO_CONTACTAR` (aunque haya otra ficha con el mismo correo);
 * - las dadas de baja (`DnxVendedorBaja`), haya o no un contacto con esa casilla.
 */

export function normalizarDireccion(email: string): string {
  return email.trim().toLowerCase();
}

/** Anota la baja de una casilla. Si ya estaba, no hace nada. */
export async function registrarBajaDireccion(email: string): Promise<void> {
  const limpio = normalizarDireccion(email);
  if (!limpio) return;
  await prisma.dnxVendedorBaja.upsert({ where: { email: limpio }, create: { email: limpio }, update: {}, select: { id: true } });
}

/** true si a esa dirección no se le puede escribir. */
export async function direccionBloqueada(email: string): Promise<boolean> {
  const limpio = normalizarDireccion(email);
  if (!limpio) return true;
  const baja = await prisma.dnxVendedorBaja.findUnique({ where: { email: limpio }, select: { id: true } });
  if (baja) return true;
  const contacto = await prisma.dnxContacto.findFirst({
    where: { estado: "NO_CONTACTAR", OR: [{ claveEmail: limpio }, { email: { equals: email.trim(), mode: "insensitive" } }] },
    select: { id: true },
  });
  return contacto !== null;
}

/** Todas las casillas bloqueadas, en minúsculas: para armar la cola del día de una sola vez. */
export async function direccionesBloqueadas(): Promise<Set<string>> {
  const [contactos, bajas] = await Promise.all([
    prisma.dnxContacto.findMany({ where: { estado: "NO_CONTACTAR" }, select: { claveEmail: true, email: true } }),
    prisma.dnxVendedorBaja.findMany({ select: { email: true } }),
  ]);
  const todas = new Set<string>();
  for (const c of contactos) {
    if (c.claveEmail) todas.add(normalizarDireccion(c.claveEmail));
    if (c.email) todas.add(normalizarDireccion(c.email));
  }
  for (const b of bajas) todas.add(normalizarDireccion(b.email));
  return todas;
}
