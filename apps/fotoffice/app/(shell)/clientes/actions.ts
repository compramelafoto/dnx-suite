"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { parseClientForm } from "@/lib/clients/client-form";
import { crearClienteConNumero } from "@/lib/clients/alta";
import { requireClientsStaff } from "@/lib/clients/access";
import { CAMPOS_AUDITADOS_CLIENTE } from "@/lib/clients/audit";
import { diffCampos, registrarEventoPersona, type Actor } from "@/lib/ficha/eventos";
import { mudarPiezasDelSocioAlCliente } from "@/lib/ficha/mudanza";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";

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
  const actor: Actor = { userId: user.id, label: etiquetaDeUsuario(user) };

  if (clientId) {
    // El `where` de un update tiene que ser único, así que el workspace se verifica leyendo
    // antes, en la misma transacción que el update y el historial.
    const existia = await prisma.$transaction(async (tx) => {
      const antes = await tx.client.findFirst({ where: { id: clientId, workspaceId: workspace.id } });
      if (!antes) return false;
      await tx.client.update({ where: { id: clientId }, data: v });
      const cambios = diffCampos(antes, v, CAMPOS_AUDITADOS_CLIENTE);
      if (Object.keys(cambios).length > 0) {
        await tx.clientAudit.create({
          data: {
            workspaceId: workspace.id,
            clientId,
            action: "UPDATED",
            actorUserId: actor.userId,
            actorLabel: actor.label,
            changesJson: cambios as Prisma.InputJsonValue,
          },
        });
      }
      return true;
    });
    if (!existia) redirect(`${LISTA}?error=${encodeURIComponent("Ese cliente no existe.")}`);
    revalidatePath(LISTA);
    redirect(`${LISTA}/${clientId}?ok=1`);
  }

  const creadoId = await crearClienteConNumero(workspace.id, v, actor);

  if (creadoId === null) {
    redirect(`${destinoError}?error=${encodeURIComponent("No se pudo asignar un número. Probá de nuevo.")}`);
  }

  revalidatePath(LISTA);
  redirect(`${LISTA}/${creadoId}?ok=1`);
}

/**
 * Declarar que este cliente es además un socio de la institución.
 *
 * No lo decide el sistema: la pantalla lo *ofrece* cuando el contacto coincide con un socio,
 * y una persona confirma. Emparejar automáticamente a dos homónimos y fusionarles el
 * historial es un error que después no se puede deshacer.
 */
export async function linkClientToMemberAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireClientsStaff();
  const actor: Actor = { userId: user.id, label: etiquetaDeUsuario(user) };
  const clientId = String(formData.get("clientId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim() || null;

  const propio = await prisma.client.count({ where: { id: clientId, workspaceId: workspace.id } });
  if (propio === 0) redirect(`${LISTA}?error=${encodeURIComponent("Ese cliente no existe.")}`);

  if (memberId) {
    const socioPropio = await prisma.member.count({
      where: { id: memberId, workspaceId: workspace.id },
    });
    if (socioPropio === 0) {
      redirect(`${LISTA}/${clientId}?error=${encodeURIComponent("Ese socio no existe.")}`);
    }
  }

  let socioAnterior = null as string | null;
  try {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.client.findFirst({
        where: { id: clientId, workspaceId: workspace.id },
        select: { memberId: true },
      });
      if (!antes) throw new Error("Cliente inexistente");
      socioAnterior = antes.memberId;
      await tx.client.update({ where: { id: clientId }, data: { memberId } });

      const dueno = { clientId };
      if (antes.memberId && antes.memberId !== memberId) {
        await registrarEventoPersona(tx, {
          workspaceId: workspace.id,
          dueno,
          kind: "SOCIO_DESVINCULADO",
          detail: { memberId: antes.memberId },
          actor,
        });
      }
      if (memberId) {
        // Las piezas del socio pasan al cliente; al desvincular no vuelven: quedan en el cliente.
        await mudarPiezasDelSocioAlCliente(tx, { workspaceId: workspace.id, memberId, clientId });
        if (antes.memberId !== memberId) {
          await registrarEventoPersona(tx, {
            workspaceId: workspace.id,
            dueno,
            kind: "SOCIO_VINCULADO",
            detail: { memberId },
            actor,
          });
        }
      }
    });
  } catch (e) {
    // memberId es único: ese socio ya está enlazado a otra ficha de cliente.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`${LISTA}/${clientId}?error=${encodeURIComponent("Ese socio ya está enlazado a otro cliente.")}`);
    }
    throw e;
  }

  revalidatePath(`${LISTA}/${clientId}`);
  // La ficha del socio muestra este vínculo: la nueva y la anterior cambian.
  if (memberId) revalidatePath(`/members/${memberId}`);
  if (socioAnterior && socioAnterior !== memberId) revalidatePath(`/members/${socioAnterior}`);
  redirect(`${LISTA}/${clientId}?ok=1`);
}
