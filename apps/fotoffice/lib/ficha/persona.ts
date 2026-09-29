import "server-only";
import { prisma } from "@repo/db";

/**
 * La "persona" de la ficha: alguien puede ser cliente, socio o las dos cosas a la vez.
 * Las notas, etiquetas y adjuntos se guardan bajo UNA de las dos identidades (el dueño),
 * pero se leen de las dos para no perder lo que se cargó antes del vínculo.
 */
export type PersonaRef = { clientId: string | null; memberId: string | null };
export type Dueno = { clientId: string } | { memberId: string };

/** A quién se le escribe lo nuevo: el cliente si existe; si no, el socio. */
export function duenoDe(p: PersonaRef): Dueno {
  if (p.clientId) return { clientId: p.clientId };
  if (p.memberId) return { memberId: p.memberId };
  throw new Error("PersonaRef sin cliente ni socio");
}

/** Filtro para leer lo guardado de los dos lados. Siempre acotado al workspace. */
export function wherePersona(workspaceId: string, p: PersonaRef) {
  const OR: ({ clientId: string } | { memberId: string })[] = [];
  if (p.clientId) OR.push({ clientId: p.clientId });
  if (p.memberId) OR.push({ memberId: p.memberId });
  return { workspaceId, OR };
}

export async function resolverPersonaPorCliente(workspaceId: string, clientId: string): Promise<PersonaRef | null> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { id: true, memberId: true },
  });
  return c ? { clientId: c.id, memberId: c.memberId } : null;
}

export async function resolverPersonaPorSocio(workspaceId: string, memberId: string): Promise<PersonaRef | null> {
  const m = await prisma.member.findFirst({
    where: { id: memberId, workspaceId },
    select: { id: true, clientLink: { select: { id: true } } },
  });
  return m ? { clientId: m.clientLink?.id ?? null, memberId: m.id } : null;
}
