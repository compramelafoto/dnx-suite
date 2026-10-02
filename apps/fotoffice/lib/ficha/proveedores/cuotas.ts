import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { chargeConceptLabel, chargePeriodLabel, fechaLegible } from "@/lib/membership/charge-labels";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { paymentMethodLabel } from "@/lib/membership/payment-method";
import { whereCorte, type EventoFicha, type Proveedor } from "../linea-de-tiempo";
import { filas } from "./comun";

const PREFIJO_CARGO = "cuotas:cargo:";
const PREFIJO_PAGO = "cuotas:pago:";

/**
 * Cuotas del socio: los cargos generados (por su fecha de alta) y los pagos acreditados (por
 * la fecha en que se pagaron). Plata: el motor lo saltea sin `verDinero`.
 */
export const proveedorCuotas: Proveedor = {
  clave: "cuotas",
  tipo: "plata",
  capacidad: "verDinero",
  async traer(ctx, persona, antesDe, take, opciones) {
    if (!persona.memberId) return [];
    const n = filas(take);
    const [cargos, pagos] = await Promise.all([
      prisma.membershipCharge.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          memberId: persona.memberId,
          AND: [whereCorte("createdAt", PREFIJO_CARGO, antesDe, opciones?.idTope) as Prisma.MembershipChargeWhereInput],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: n,
        select: { id: true, concept: true, period: true, amountArs: true, dueDate: true, createdAt: true },
      }),
      prisma.membershipPayment.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          memberId: persona.memberId,
          status: "ACREDITADO",
          paidAt: { not: null },
          AND: [whereCorte("paidAt", PREFIJO_PAGO, antesDe, opciones?.idTope) as Prisma.MembershipPaymentWhereInput],
        },
        orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        take: n,
        select: {
          id: true,
          amountArs: true,
          method: true,
          providerPaymentRef: true,
          paidAt: true,
          allocations: { select: { charge: { select: { period: true } } } },
        },
      }),
    ]);

    const eventos: EventoFicha[] = cargos.map((c) => ({
      id: `${PREFIJO_CARGO}${c.id}`,
      tipo: "plata",
      fecha: c.createdAt,
      actor: null,
      titulo: `Cuota generada: ${chargePeriodLabel(c.period)}`,
      detalle: `${chargeConceptLabel(c.concept, c.period)} · ${formatMinorArs(decimalArsToMinor(c.amountArs))} · vence el ${fechaLegible(c.dueDate)}`,
    }));
    for (const p of pagos) {
      const periodos = [...new Set(p.allocations.map((a) => chargePeriodLabel(a.charge.period)))];
      const medio = paymentMethodLabel({ method: p.method, hasProviderRef: !!p.providerPaymentRef });
      eventos.push({
        id: `${PREFIJO_PAGO}${p.id}`,
        tipo: "plata",
        fecha: p.paidAt!,
        actor: null,
        titulo: `Pago acreditado: ${formatMinorArs(decimalArsToMinor(p.amountArs))}`,
        detalle: [medio, periodos.length > 0 ? `Cubre: ${periodos.join(", ")}` : null].filter(Boolean).join(" · "),
      });
    }
    return eventos;
  },
};
