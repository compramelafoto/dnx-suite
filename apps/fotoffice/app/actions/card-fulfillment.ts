"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import {
  checkTransition,
  FULFILLMENT_STATES,
  type FulfillmentCapability,
  type FulfillmentState,
} from "@/lib/carnet/fulfillment";
import { notifyCardEvent } from "@/lib/carnet/notify";
import { resolveCardCapabilities } from "@/lib/carnet/operators";
import { releaseVoidedPrintOrderCharge } from "@/lib/carnet/void-order";

export type AdvanceCardResult = { ok: true } | { ok: false; error: string };

export type AdvanceManyResult =
  | { ok: true; moved: number; failures: { cardNumber: string; error: string }[] }
  | { ok: false; error: string };

const ESTADOS = new Set<FulfillmentState>(FULFILLMENT_STATES);

/**
 * Tope de una tanda.
 *
 * Un lote más grande que esto correría el riesgo de cortarse a la mitad por tiempo de
 * ejecución, y una tanda a medias es peor que dos tandas: nadie sabe cuál quedó afuera.
 */
const MAX_LOTE = 50;

type Actor = {
  userId: number;
  label: string | null;
  capabilities: readonly FulfillmentCapability[];
  workspaceId: string;
};

/**
 * Mueve UN carnet al siguiente paso.
 *
 * El cambio de estado, la baja del cargo cuando corresponde y el evento se guardan **juntos**:
 * un estado que avanzó sin registro de quién lo movió, o un pedido anulado con su deuda
 * todavía viva, son exactamente los dos agujeros que este recorrido viene a tapar.
 *
 * Es la única puerta: la acción de a uno y la de lote pasan las dos por acá, así que no hay
 * forma de que marcar cuarenta carnets juntos se saltee un control que sí se aplica de a uno.
 */
async function advanceOneCard(
  actor: Actor,
  cardId: string,
  destino: FulfillmentState,
  nota: string | null,
): Promise<AdvanceCardResult> {
  const card = await prisma.memberCard.findFirst({
    where: { id: cardId, workspaceId: actor.workspaceId },
    // Solo lo que decide la transición. Los datos del socio los lee el aviso, que es quien
    // los necesita: traerlos acá sería pasear datos personales por una función que no los usa.
    select: { id: true, fulfillmentState: true, format: true },
  });
  if (!card) return { ok: false, error: "No encontramos ese carnet." };
  if (card.format !== "PRINTED") {
    return { ok: false, error: "El carnet digital no se imprime ni se entrega." };
  }

  const origen = (card.fulfillmentState ?? "PENDIENTE_PAGO") as FulfillmentState;
  const control = checkTransition({
    from: origen,
    to: destino,
    capabilities: actor.capabilities,
    note: nota,
  });
  if (!control.ok) return { ok: false, error: control.message };

  const eventoId = await prisma.$transaction(async (tx) => {
    await tx.memberCard.update({
      where: { id: card.id },
      data: { fulfillmentState: destino, fulfillmentUpdatedAt: new Date() },
    });

    // Anular es deshacer el pedido, y un pedido deshecho no se cobra. Va DENTRO de esta
    // transacción: un carnet anulado con su deuda todavía viva es justo lo que hacía que el
    // socio terminara debiendo tarjetas que nunca recibió.
    if (destino === "ANULADO") {
      await releaseVoidedPrintOrderCharge(tx, card.id);
    }

    const evento = await tx.memberCardEvent.create({
      data: {
        cardId: card.id,
        fromState: origen,
        toState: destino,
        actorUserId: actor.userId,
        // Instantánea del actor: la historia tiene que entenderse dentro de cinco años,
        // aunque esa persona ya no esté en el sistema.
        actorLabel: actor.label,
        note: nota,
      },
      select: { id: true },
    });
    return evento.id;
  });

  // El aviso sale DESPUÉS de confirmar el cambio: el carnet se imprimió, eso ya es cierto, y
  // un correo que no sale no puede deshacerlo. El resultado queda registrado en el evento
  // para que la Secretaría lo vea y reintente.
  await notifyCardEvent({ cardId: card.id, eventId: eventoId, state: destino, note: nota });

  return { ok: true };
}

async function resolverActor(): Promise<Actor | null> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return null;
  return {
    userId: user.id,
    label: user.name?.trim() || user.email || null,
    capabilities: await resolveCardCapabilities(user.id, workspace.id),
    workspaceId: workspace.id,
  };
}

function revalidar(destino: FulfillmentState) {
  revalidatePath("/members/carnets");
  // Anular le bajó la deuda al socio: su pantalla de cuotas ya no dice lo mismo.
  if (destino === "ANULADO") revalidatePath("/portal/cuotas");
}

export async function advanceCardFulfillmentAction(
  formData: FormData,
): Promise<AdvanceCardResult> {
  const actor = await resolverActor();
  if (!actor) return { ok: false, error: "No hay una institución activa." };

  const cardId = String(formData.get("cardId") ?? "").trim();
  const destino = String(formData.get("toState") ?? "").trim() as FulfillmentState;
  const nota = String(formData.get("note") ?? "").trim() || null;

  if (!cardId || !ESTADOS.has(destino)) {
    return { ok: false, error: "El pedido no es válido." };
  }

  const r = await advanceOneCard(actor, cardId, destino, nota);
  if (r.ok) revalidar(destino);
  return r;
}

/**
 * Mueve una tanda de carnets al mismo paso.
 *
 * La Secretaría no imprime de a uno: llega el lote de la imprenta y se marca junto. Pero cada
 * carnet se resuelve **por separado** y con sus propias reglas: si uno del montón no admite
 * el paso, ese queda afuera con su motivo y los demás avanzan igual. Lo contrario —abortar
 * todo por uno— obligaría a adivinar cuál era.
 */
export async function advanceCardsFulfillmentAction(
  formData: FormData,
): Promise<AdvanceManyResult> {
  const actor = await resolverActor();
  if (!actor) return { ok: false, error: "No hay una institución activa." };

  const destino = String(formData.get("toState") ?? "").trim() as FulfillmentState;
  const nota = String(formData.get("note") ?? "").trim() || null;
  const cardIds = formData.getAll("cardId").map((v) => String(v).trim()).filter(Boolean);

  if (!ESTADOS.has(destino)) return { ok: false, error: "El paso no es válido." };
  if (cardIds.length === 0) return { ok: false, error: "No seleccionaste ningún carnet." };
  if (cardIds.length > MAX_LOTE) {
    return { ok: false, error: `Son demasiados de una vez. Hacelo de a ${MAX_LOTE}.` };
  }

  const numeros = new Map(
    (
      await prisma.memberCard.findMany({
        where: { id: { in: cardIds }, workspaceId: actor.workspaceId },
        select: { id: true, cardNumber: true },
      })
    ).map((c) => [c.id, c.cardNumber]),
  );

  let moved = 0;
  const failures: { cardNumber: string; error: string }[] = [];
  for (const cardId of cardIds) {
    const r = await advanceOneCard(actor, cardId, destino, nota);
    if (r.ok) moved += 1;
    else failures.push({ cardNumber: numeros.get(cardId) ?? cardId, error: r.error });
  }

  if (moved > 0) revalidar(destino);
  return { ok: true, moved, failures };
}
