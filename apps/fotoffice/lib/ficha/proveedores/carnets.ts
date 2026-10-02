import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { stateLabel, type FulfillmentState } from "@/lib/carnet/fulfillment";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { filas } from "./comun";

const PREFIJO = "carnets:";

/**
 * Recorrido de los carnets impresos del socio. `MemberCardEvent` no tiene `workspaceId`:
 * se acota por la tarjeta, que sí lo tiene y es del socio.
 */
export const proveedorCarnets: Proveedor = {
  clave: "carnets",
  tipo: "carnets",
  async traer(ctx, persona, antesDe, take, opciones) {
    if (!persona.memberId) return [];
    const eventos = await prisma.memberCardEvent.findMany({
      where: {
        card: { workspaceId: ctx.workspaceId, memberId: persona.memberId },
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.MemberCardEventWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, toState: true, actorLabel: true, note: true, createdAt: true, card: { select: { cardNumber: true } } },
    });
    return eventos.map((e) => ({
      id: `${PREFIJO}${e.id}`,
      tipo: "carnets" as const,
      fecha: e.createdAt,
      actor: e.actorLabel || null,
      titulo: `Carnet ${e.card.cardNumber}: ${stateLabel(e.toState as FulfillmentState) ?? e.toState}`,
      ...(e.note ? { detalle: e.note } : {}),
    }));
  },
};
