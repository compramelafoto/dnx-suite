import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { filas } from "./comun";

const PREFIJO = "campos:";

/**
 * Cambios de "Más datos" (`FotofficeCustomValueChange`) de la persona: los de su ficha de
 * cliente y los de su ficha de socio, siempre acotados al workspace. Un evento por campo
 * cambiado, con antes → después legibles.
 */
export const proveedorCampos: Proveedor = {
  clave: "campos",
  tipo: "cambios",
  async traer(ctx, persona, antesDe, take, opciones) {
    const OR: { entityType: string; entityId: string }[] = [];
    if (persona.clientId) OR.push({ entityType: "CLIENTE", entityId: persona.clientId });
    if (persona.memberId) OR.push({ entityType: "SOCIO", entityId: persona.memberId });
    if (OR.length === 0) return [];
    const leidas = await prisma.fotofficeCustomValueChange.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR,
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.FotofficeCustomValueChangeWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, fieldId: true, before: true, after: true, actorLabel: true, createdAt: true },
    });
    if (leidas.length === 0) return [];
    const ids = [...new Set(leidas.map((f) => f.fieldId))];
    const nombres = await prisma.fotofficeCustomField.findMany({
      where: { workspaceId: ctx.workspaceId, id: { in: ids } },
      select: { id: true, name: true },
    });
    const nombre = new Map(nombres.map((n) => [n.id, n.name]));
    return leidas.map((f) => ({
      id: `${PREFIJO}${f.id}`,
      tipo: "cambios" as const,
      fecha: f.createdAt,
      actor: f.actorLabel || null,
      titulo: "Más datos modificados",
      cambios: [{ campo: nombre.get(f.fieldId) ?? "Campo borrado", antes: f.before ?? "vacío", despues: f.after ?? "vacío" }],
    }));
  },
};
