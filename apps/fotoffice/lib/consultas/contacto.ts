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

export type OpcionesContacto = {
  /**
   * "correo-o-telefono" (por defecto): altas del equipo e importación. "correo": formulario web
   * (regla R3): desde internet sólo se empareja por correo, porque el teléfono no se verifica y
   * un tercero que lo conozca podría colgar su consulta de la ficha de otro.
   */
  coincidir?: "correo" | "correo-o-telefono";
};

/**
 * El contacto de una consulta: toda consulta tiene uno (spec §2.1).
 *
 * Corre DENTRO de la transacción de quien llama (el alta crea la consulta y su contacto juntos:
 * si la consulta falla, el contacto no queda suelto) y nunca usa el `prisma` global.
 *
 * Busca primero por correo (sin distinguir mayúsculas) y después por teléfono normalizado
 * (sólo dígitos, como `client-form.ts` lo guarda); con `coincidir: "correo"` (formulario web),
 * sólo por correo. Si hay varios, el más reciente; si más de uno coincide por el mismo criterio
 * que eligió, avisa "posible duplicado". Si no encuentra a nadie, crea el `Client` con
 * `findOrCreateClient` (número, historial) y su perfil con categoría CONTACTO. Un cliente que ya
 * existía no recibe perfil: sin perfil cuenta como CLIENTE.
 */
export async function contactoParaConsulta(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  datos: DatosContacto,
  actor: Actor = ACTOR_SISTEMA,
  opciones: OpcionesContacto = {},
): Promise<ContactoDeConsulta> {
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim().replace(/\s+/g, " ") : "";
  if (!nombre) throw new Error("Falta el nombre del contacto.");
  if (nombre.length > MAX_NOMBRE_CONTACTO) throw new Error("El nombre del contacto es demasiado largo.");
  const soloCorreo = opciones.coincidir === "correo";
  const mail = typeof datos.email === "string" ? datos.email.trim().toLowerCase() || null : null;
  const tel = typeof datos.telefono === "string" ? soloDigitos(datos.telefono) || null : null;
  // El teléfono con el que se busca: ninguno si sólo vale el correo (igual se guarda al crear).
  const telBusqueda = soloCorreo ? null : tel;

  if (mail || telBusqueda) {
    const candidatos = await tx.client.findMany({
      where: {
        workspaceId,
        OR: [
          ...(mail ? [{ email: { equals: mail, mode: "insensitive" as const } }] : []),
          ...(telBusqueda ? [{ phone: telBusqueda }] : []),
        ],
      },
      // El más reciente primero: `matchExistingClient` se queda con el primero que coincide.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, docNumber: true, email: true, phone: true },
      take: MAX_CANDIDATOS,
    });
    const elegido = matchExistingClient(candidatos, { email: mail, phone: telBusqueda });
    if (elegido) {
      // "Posible duplicado" se mide con el mismo criterio que eligió: correo si alguno coincidió
      // por correo; si no, teléfono.
      const porCorreo = candidatos.filter((c) => mail !== null && !!c.email && c.email.trim().toLowerCase() === mail);
      const coinciden =
        porCorreo.length > 0
          ? porCorreo
          : candidatos.filter((c) => telBusqueda !== null && !!c.phone && soloDigitos(c.phone) === telBusqueda);
      return { clientId: elegido.id, creado: false, posibleDuplicado: coinciden.length > 1 };
    }
  }

  const { firstName, lastName } = partirNombre(nombre);
  const cliente = await findOrCreateClient(
    tx,
    { workspaceId, email: mail, phone: telBusqueda, firstName, lastName, createdByUserId: actor.userId },
    actor,
  );
  if (cliente.created) {
    // En modo "correo" el teléfono no participó de la búsqueda: se guarda recién ahora, sólo en
    // el cliente que nació con esta consulta.
    if (soloCorreo && tel) {
      await tx.client.update({ where: { id: cliente.id }, data: { phone: tel }, select: { id: true } });
    }
    await tx.fotofficeContactoPerfil.create({
      data: { workspaceId, clientId: cliente.id, category: CATEGORIA_CONTACTO_NUEVO },
      select: { id: true },
    });
  }
  return { clientId: cliente.id, creado: cliente.created, posibleDuplicado: false };
}
