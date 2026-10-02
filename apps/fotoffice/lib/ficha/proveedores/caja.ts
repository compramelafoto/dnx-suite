import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { filas } from "./comun";

const PREFIJO = "caja:";

const METODOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  TARJETA: "Tarjeta",
  OTRO: "Otro medio",
};

/** Movimientos de caja del cliente. Plata: el motor lo saltea sin `verDinero`. */
export const proveedorCaja: Proveedor = {
  clave: "caja",
  tipo: "plata",
  capacidad: "verDinero",
  async traer(ctx, persona, antesDe, take, opciones) {
    if (!persona.clientId) return [];
    const movimientos = await prisma.cashMovement.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        clientId: persona.clientId,
        AND: [whereCorte("occurredAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.CashMovementWhereInput],
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: {
        id: true,
        kind: true,
        amountArs: true,
        occurredAt: true,
        paymentMethod: true,
        description: true,
        reversesMovementId: true,
        account: { select: { name: true } },
      },
    });
    return movimientos.map((m) => {
      const importe = formatMinorArs(decimalArsToMinor(m.amountArs));
      const tipo = m.kind === "EGRESO" ? "Egreso" : "Ingreso";
      const detalle = [m.description, METODOS[m.paymentMethod] ?? m.paymentMethod, m.account?.name]
        .filter((s): s is string => !!s)
        .join(" · ");
      return {
        id: `${PREFIJO}${m.id}`,
        tipo: "plata" as const,
        fecha: m.occurredAt,
        actor: null,
        titulo: `${m.reversesMovementId ? "Anulación · " : ""}${tipo} en caja: ${importe}`,
        detalle,
        enlace: `/caja/movimientos?ver=${encodeURIComponent(m.id)}`,
      };
    });
  },
};
