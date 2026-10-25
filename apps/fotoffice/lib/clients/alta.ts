import { prisma, Prisma } from "@repo/db";
import type { Actor } from "@/lib/ficha/eventos";
import { nextClientNumber } from "./client-number";
import { lastClientNumber } from "./repository";

export type DatosAltaCliente = Omit<Prisma.ClientUncheckedCreateInput, "workspaceId" | "clientNumber" | "createdByUserId">;

/**
 * Alta de un cliente con el número siguiente del workspace.
 *
 * El número se calcula leyendo el último y sumando uno, lo que tiene una carrera: dos altas
 * simultáneas leen el mismo último. Se resuelve dejando que choque contra el índice único
 * `(workspaceId, clientNumber)` y reintentando (tres intentos alcanzan de sobra).
 *
 * Cada intento va en su propia transacción: crea el cliente, su `ClientAudit CREATED` y, si
 * se pasa `dentro`, lo que deba quedar atado a esa alta (todo o nada). Devuelve el id o
 * `null` si no se pudo asignar un número.
 */
export async function crearClienteConNumero(
  workspaceId: string,
  datos: DatosAltaCliente,
  actor: Actor,
  dentro?: (tx: Prisma.TransactionClient, clientId: string) => Promise<void>,
): Promise<string | null> {
  for (let intento = 0; intento < 3; intento++) {
    const clientNumber = nextClientNumber(await lastClientNumber(workspaceId));
    try {
      return await prisma.$transaction(async (tx) => {
        const creado = await tx.client.create({
          data: { ...datos, workspaceId, clientNumber, createdByUserId: actor.userId },
          select: { id: true },
        });
        await tx.clientAudit.create({
          data: { workspaceId, clientId: creado.id, action: "CREATED", actorUserId: actor.userId, actorLabel: actor.label },
        });
        if (dentro) await dentro(tx, creado.id);
        return creado.id;
      });
    } catch (e) {
      // P2002 = choque con un índice único. Sólo puede ser el número: lo demás no es único.
      const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!choque) throw e;
    }
  }
  return null;
}
