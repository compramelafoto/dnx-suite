import "server-only";
import { prisma } from "@repo/db";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede, type AccesoEfectivo } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { BANDEJA_MODULE_KEY } from "./constantes";

/** Una persona del equipo que ve la Bandeja. `puedeOperar`: tiene Gestionar (se le puede derivar). */
export type PersonaDeLaBandeja = { userId: number; nombre: string; puedeOperar: boolean };

type Deps = { accesoDe?: (userId: number) => Promise<AccesoEfectivo> };

/**
 * Las personas del workspace con "Ver" o más en la Bandeja (dueño, admins y roles con el módulo),
 * ordenadas por nombre. Alimenta el filtro «quién atiende» y el menú «Derivar a…» (que usa sólo
 * las que pueden operar). Son pocas: se resuelve el acceso de cada una con la misma regla que la sesión.
 */
export async function personasDeLaBandeja(workspaceId: string, deps: Deps = {}): Promise<PersonaDeLaBandeja[]> {
  const accesoDe = deps.accesoDe ?? ((userId: number) => resolverAcceso(userId, workspaceId));
  const miembros = (await prisma.workspaceMembership.findMany({ where: { workspaceId }, select: { userId: true } })) as { userId: number }[];
  const ids = [...new Set(miembros.map((m) => m.userId))];
  if (ids.length === 0) return [];
  const usuarios = (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })) as {
    id: number; name: string | null; email: string | null;
  }[];
  const filas = await Promise.all(
    usuarios.map(async (u) => {
      const acceso = await accesoDe(u.id).catch(() => null);
      if (!acceso || !puede(acceso, "ver", BANDEJA_MODULE_KEY)) return null;
      return { userId: u.id, nombre: etiquetaDeUsuario(u), puedeOperar: puede(acceso, "operar", BANDEJA_MODULE_KEY) };
    }),
  );
  return filas.filter((f): f is PersonaDeLaBandeja => f !== null).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}

/** Persona del equipo que puede atender (Gestionar) en este workspace, o `null`. */
export async function personaQuePuedeAtender(workspaceId: string, userId: number, deps: Deps = {}): Promise<PersonaDeLaBandeja | null> {
  const p = (await personasDeLaBandeja(workspaceId, deps)).find((x) => x.userId === userId);
  return p?.puedeOperar ? p : null;
}

/** Chats abiertos (BOT o HUMANO) asignados a cada persona del workspace. Si falla, vacío. */
export async function contarAbiertosPorPersona(workspaceId: string): Promise<Map<number, number>> {
  try {
    const filas = (await prisma.fotofficeWaChat.groupBy({
      by: ["asignadoUserId"],
      where: { workspaceId, estado: { in: ["BOT", "HUMANO"] }, asignadoUserId: { not: null } },
      _count: { _all: true },
    })) as unknown as { asignadoUserId: number | null; _count: { _all: number } }[];
    return new Map(filas.flatMap((f) => (f.asignadoUserId !== null ? [[f.asignadoUserId, f._count._all] as const] : [])));
  } catch {
    return new Map();
  }
}
