"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { parseClientForm } from "@/lib/clients/client-form";
import { nextClientNumber } from "@/lib/clients/client-number";
import { lastClientNumber } from "@/lib/clients/repository";
import { requireClientsStaff } from "@/lib/clients/access";

const LISTA = "/clientes";

/**
 * Alta y edición de un cliente.
 *
 * El número se calcula leyendo el último y sumando uno, lo que tiene una carrera obvia: dos
 * altas simultáneas leen el mismo último número. No se resuelve con un bloqueo ni con una
 * tabla de secuencias —sería inventar infraestructura para un caso que pasa una vez al año—
 * sino dejando que choque contra el índice único y reintentando. Tres intentos alcanzan de
 * sobra para un mostrador.
 */
export async function saveClientAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireClientsStaff();

  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const destinoError = clientId ? `${LISTA}/${clientId}` : `${LISTA}/nuevo`;

  const parsed = parseClientForm(formData);
  if (!parsed.ok) redirect(`${destinoError}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (clientId) {
    // El `where` de un update tiene que ser único, así que el workspace no puede viajar ahí.
    const propio = await prisma.client.count({ where: { id: clientId, workspaceId: workspace.id } });
    if (propio === 0) redirect(`${LISTA}?error=${encodeURIComponent("Ese cliente no existe.")}`);
    await prisma.client.update({ where: { id: clientId }, data: v });
    revalidatePath(LISTA);
    redirect(`${LISTA}/${clientId}?ok=1`);
  }

  let creadoId: string | null = null;
  for (let intento = 0; intento < 3 && creadoId === null; intento++) {
    const clientNumber = nextClientNumber(await lastClientNumber(workspace.id));
    try {
      const creado = await prisma.client.create({
        data: { ...v, workspaceId: workspace.id, clientNumber, createdByUserId: user.id },
        select: { id: true },
      });
      creadoId = creado.id;
    } catch (e) {
      // P2002 = choque con un índice único. Sólo puede ser el número: lo demás no es único.
      const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!choque) throw e;
    }
  }

  if (creadoId === null) {
    redirect(`${destinoError}?error=${encodeURIComponent("No se pudo asignar un número. Probá de nuevo.")}`);
  }

  revalidatePath(LISTA);
  redirect(`${LISTA}/${creadoId}?ok=1`);
}
