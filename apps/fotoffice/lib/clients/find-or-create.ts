import "server-only";
import { Prisma } from "@repo/db";
import { matchExistingClient } from "./match";
import { nextClientNumber } from "./client-number";

/**
 * La única puerta por la que los otros módulos consiguen un cliente.
 *
 * Recibe una transacción y no el cliente global: quien llama está creando una reserva o una
 * venta, y el cliente tiene que nacer o no nacer junto con eso. Un cliente creado y una
 * venta que falló deja basura en el padrón.
 *
 * Busca entre los candidatos que comparten algún dato de contacto y no entre todos los
 * clientes del workspace: con un padrón de miles, traerlos a todos para compararlos en
 * memoria sería absurdo.
 */
export async function findOrCreateClient(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    docNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    businessName?: string | null;
    createdByUserId?: number | null;
  },
): Promise<{ id: string; created: boolean }> {
  const doc = input.docNumber?.replace(/[.\-\s]/g, "") || null;
  const mail = input.email?.trim().toLowerCase() || null;
  const tel = input.phone?.trim() || null;

  if (doc || mail || tel) {
    const candidatos = await tx.client.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          ...(doc ? [{ docNumber: doc }] : []),
          ...(mail ? [{ email: mail }] : []),
          ...(tel ? [{ phone: tel }] : []),
        ],
      },
      select: { id: true, docNumber: true, email: true, phone: true },
      take: 50,
    });
    const encontrado = matchExistingClient(candidatos, { docNumber: doc, email: mail, phone: tel });
    if (encontrado) return { id: encontrado.id, created: false };
  }

  // Mismo reintento que `saveClientAction`: el número se calcula leyendo el último y sumando
  // uno, y dos altas simultáneas leen el mismo. Acá importa más que en el formulario, porque
  // por esta puerta entran las reservas y las ventas, que sí pueden llegar a la vez.
  const datos = {
    workspaceId: input.workspaceId,
    kind: input.businessName ? "EMPRESA" : "PERSONA",
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    businessName: input.businessName ?? null,
    docNumber: doc,
    docType: doc ? (doc.length === 11 ? "CUIT" : "DNI") : null,
    email: mail,
    phone: tel,
    createdByUserId: input.createdByUserId ?? null,
  };

  for (let intento = 0; intento < 3; intento++) {
    const ultimo = await tx.client.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { clientNumber: "desc" },
      select: { clientNumber: true },
    });
    try {
      const creado = await tx.client.create({
        data: { ...datos, clientNumber: nextClientNumber(ultimo?.clientNumber ?? null) },
        select: { id: true },
      });
      return { id: creado.id, created: true };
    } catch (e) {
      const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!choque) throw e;
    }
  }

  throw new Error("No se pudo asignar un número de cliente después de tres intentos.");
}
