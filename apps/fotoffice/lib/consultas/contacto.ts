import "server-only";
import type { Prisma } from "@repo/db";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { matchExistingClient, soloDigitos } from "@/lib/clients/match";
import type { Actor } from "@/lib/ficha/eventos";
import { CATEGORIA_CONTACTO_NUEVO } from "./constantes";

const ACTOR_SISTEMA: Actor = { userId: null, label: "Sistema" };

export const MAX_NOMBRE_CONTACTO = 200;
/** Candidatos que se traen como máximo: alcanza de sobra para elegir y detectar duplicados. */
const MAX_CANDIDATOS = 50;

export type DatosContacto = {
  nombre: string;
  email?: string | null;
  telefono?: string | null;
};

export type ContactoDeConsulta = {
  clientId: string;
  /** true si el contacto nació con esta consulta (con perfil CONTACTO). */
  creado: boolean;
  /** Más de un cliente coincide por correo o teléfono: la ficha ofrece la fusión. */
  posibleDuplicado: boolean;
};

/** "Ana María Pérez" → Ana / María Pérez. Una sola palabra queda como nombre. */
export function partirNombre(nombre: string): { firstName: string; lastName: string | null } {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  const espacio = limpio.indexOf(" ");
  if (espacio === -1) return { firstName: limpio, lastName: null };
  return { firstName: limpio.slice(0, espacio), lastName: limpio.slice(espacio + 1) || null };
}

/**
 * El contacto de una consulta: toda consulta tiene uno (spec §2.1).
 *
 * Corre DENTRO de la transacción de quien llama (el alta crea la consulta y su contacto juntos:
 * si la consulta falla, el contacto no queda suelto) y nunca usa el `prisma` global.
 *
 * Busca primero por correo (sin distinguir mayúsculas) y después por teléfono normalizado
 * (sólo dígitos, como `client-form.ts` lo guarda). Si hay varios, el más reciente; si coincide
 * más de un cliente, avisa "posible duplicado". Si no encuentra a nadie, crea el `Client` con
 * `findOrCreateClient` (número, historial) y su perfil con categoría CONTACTO. Un cliente que ya
 * existía no recibe perfil: sin perfil cuenta como CLIENTE.
 */
export async function contactoParaConsulta(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  datos: DatosContacto,
  actor: Actor = ACTOR_SISTEMA,
): Promise<ContactoDeConsulta> {
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim().replace(/\s+/g, " ") : "";
  if (!nombre) throw new Error("Falta el nombre del contacto.");
  if (nombre.length > MAX_NOMBRE_CONTACTO) throw new Error("El nombre del contacto es demasiado largo.");
  const mail = typeof datos.email === "string" ? datos.email.trim().toLowerCase() || null : null;
  const tel = typeof datos.telefono === "string" ? soloDigitos(datos.telefono) || null : null;

  if (mail || tel) {
    const candidatos = await tx.client.findMany({
      where: {
        workspaceId,
        OR: [
          ...(mail ? [{ email: { equals: mail, mode: "insensitive" as const } }] : []),
          ...(tel ? [{ phone: tel }] : []),
        ],
      },
      // El más reciente primero: `matchExistingClient` se queda con el primero que coincide.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, docNumber: true, email: true, phone: true },
      take: MAX_CANDIDATOS,
    });
    const elegido = matchExistingClient(candidatos, { email: mail, phone: tel });
    if (elegido) {
      const coinciden = candidatos.filter(
        (c) =>
          (mail !== null && !!c.email && c.email.trim().toLowerCase() === mail) ||
          (tel !== null && !!c.phone && soloDigitos(c.phone) === tel),
      );
      return { clientId: elegido.id, creado: false, posibleDuplicado: coinciden.length > 1 };
    }
  }

  const { firstName, lastName } = partirNombre(nombre);
  const cliente = await findOrCreateClient(
    tx,
    { workspaceId, email: mail, phone: tel, firstName, lastName, createdByUserId: actor.userId },
    actor,
  );
  if (cliente.created) {
    await tx.fotofficeContactoPerfil.create({
      data: { workspaceId, clientId: cliente.id, category: CATEGORIA_CONTACTO_NUEVO },
      select: { id: true },
    });
  }
  return { clientId: cliente.id, creado: cliente.created, posibleDuplicado: false };
}
