import "server-only";
import { prisma } from "@repo/db";
import { clientDisplayName } from "./display";

export type ClientRow = {
  id: string;
  clientNumber: number;
  displayName: string;
  docNumber: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  /// Número de socio, cuando este cliente también lo es. Para mostrarlo en el listado.
  memberNumber: string | null;
};

/**
 * El listado, con buscador.
 *
 * La búsqueda mira nombre, apellido, razón social, documento, correo y teléfono a la vez:
 * quien atiende el mostrador no sabe ni quiere saber por cuál de los seis campos está
 * buscando. `mode: "insensitive"` porque nadie escribe los acentos ni las mayúsculas igual
 * dos veces.
 */
export async function listClients(
  workspaceId: string,
  opts: { search?: string; status?: string } = {},
): Promise<ClientRow[]> {
  const q = opts.search?.trim();
  const rows = await prisma.client.findMany({
    where: {
      workspaceId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { businessName: { contains: q, mode: "insensitive" as const } },
              { docNumber: { contains: q.replace(/[.\-\s]/g, "") } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      clientNumber: true,
      kind: true,
      firstName: true,
      lastName: true,
      businessName: true,
      docNumber: true,
      email: true,
      phone: true,
      status: true,
      member: { select: { memberNumber: true } },
    },
    orderBy: { clientNumber: "desc" },
    take: 200,
  });

  return rows.map((r) => ({
    id: r.id,
    clientNumber: r.clientNumber,
    displayName: clientDisplayName(r),
    docNumber: r.docNumber,
    email: r.email,
    phone: r.phone,
    status: r.status,
    memberNumber: r.member?.memberNumber ?? null,
  }));
}

/** La ficha. Devuelve null si no existe o si es de otro workspace. */
export async function getClient(workspaceId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    include: { member: { select: { id: true, memberNumber: true } } },
  });
}

/** El último número usado en este workspace, para calcular el siguiente. */
export async function lastClientNumber(workspaceId: string): Promise<number | null> {
  const row = await prisma.client.findFirst({
    where: { workspaceId },
    orderBy: { clientNumber: "desc" },
    select: { clientNumber: true },
  });
  return row?.clientNumber ?? null;
}
