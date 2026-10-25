import "server-only";
import { prisma } from "@repo/db";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { TOPE_IDS_POR_CONSULTA } from "@/lib/listado/presupuesto";
import { veCostosDePedido, type CtxPedidos } from "./acceso";
import { esEstadoPedido } from "./constantes";
import { resumenDePlan } from "./estado";
import {
  informeACobrar,
  informeAPagar,
  informeCobrado,
  mesElegido,
  rangoDelMes,
  type CuentaPendiente,
  type InformeACobrar,
  type InformeAPagar,
  type InformeCobrado,
  type SaldoDeCuota,
} from "./informes";
import { fechaDeBase, pesosDeBase, planesDe } from "./plan";
import { nombreDeContacto } from "./pedidos";

/**
 * Lectura de los informes de Pedidos. Los montos son dinero de la organización: sólo con
 * `veCostosDePedido` (`configurar` o `verDinero`). Sin ese permiso no se lee nada y la página
 * recibe `null` (nunca importes). Los saldos salen de `planesDe` + `resumenDePlan`, igual que la
 * ficha y la lista, y los cobros anulados no cuentan.
 */

const LOTE = 1000;
const TOPE_COBROS = 50_000;
const TOPE_CUENTAS = 20_000;
export const AVISO_DEMASIADOS = "Hay demasiados registros para armar este informe completo.";

export type InformesDelPedido = {
  hoy: string;
  mes: string;
  aCobrar: InformeACobrar | null;
  cobrado: InformeCobrado | null;
  aPagar: InformeAPagar | null;
  avisos: string[];
};

export function puedeVerMontosDeInformes(ctx: CtxPedidos): boolean {
  return veCostosDePedido(ctx);
}

export async function cargarInformes(ctx: CtxPedidos, mesPedido: unknown, ahora: Date = new Date()): Promise<InformesDelPedido> {
  const hoy = diaEnBuenosAires(ahora);
  const mes = mesElegido(mesPedido, hoy);
  if (!puedeVerMontosDeInformes(ctx)) return { hoy, mes, aCobrar: null, cobrado: null, aPagar: null, avisos: [] };
  const workspaceId = ctx.workspaceId;
  const avisos: string[] = [];

  // A cobrar: cuotas con saldo de pedidos sin cancelar.
  const pedidos = await prisma.fotofficePedido.findMany({
    where: { workspaceId, status: { in: ["CONFIRMADO", "EN_CURSO", "COMPLETADO"] } },
    select: { id: true, number: true, clientId: true, status: true, totalArs: true, client: { select: { firstName: true, lastName: true, businessName: true } } },
    take: TOPE_IDS_POR_CONSULTA + 1,
  });
  let aCobrar: InformeACobrar | null = null;
  if (pedidos.length > TOPE_IDS_POR_CONSULTA) {
    avisos.push(`${AVISO_DEMASIADOS} (A cobrar)`);
  } else {
    const saldos: SaldoDeCuota[] = [];
    for (let i = 0; i < pedidos.length; i += LOTE) {
      const lote = pedidos.slice(i, i + LOTE);
      const planes = await planesDe(workspaceId, lote.map((p) => p.id));
      for (const p of lote) {
        if (!esEstadoPedido(p.status)) continue;
        const plan = planes.get(p.id) ?? { cuotas: [], imputaciones: [] };
        const r = resumenDePlan(plan.cuotas, plan.imputaciones, { hoy, estadoPedido: p.status, total: pesosDeBase(p.totalArs) });
        for (const c of r.cuotas) {
          if (c.saldo > 0) saldos.push({ pedidoId: p.id, pedidoNumero: p.number, clienteId: p.clientId, clienteNombre: nombreDeContacto(p.client), dueDate: c.dueDate, saldo: c.saldo });
        }
      }
    }
    aCobrar = informeACobrar(saldos, hoy);
  }

  // Cobrado del mes: cobros vigentes, por fecha de pago en Argentina.
  const { desde, hasta } = rangoDelMes(mes);
  const cobros = await prisma.fotofficeCobro.findMany({
    where: { workspaceId, voidedAt: null, paidAt: { gte: desde, lt: hasta } },
    select: { paidAt: true, method: true, amountArs: true },
    take: TOPE_COBROS + 1,
  });
  let cobrado: InformeCobrado | null = null;
  if (cobros.length > TOPE_COBROS) avisos.push(`${AVISO_DEMASIADOS} (Cobrado)`);
  else cobrado = informeCobrado(cobros.map((c) => ({ paidAt: c.paidAt, method: c.method, amountArs: pesosDeBase(c.amountArs) })), mes);

  // A pagar: cuentas sin pago vigente.
  const cuentas = await prisma.fotofficeCuentaPagar.findMany({
    where: { workspaceId, paidAt: null },
    select: { id: true, supplierClientId: true, dueDate: true, amountArs: true, supplier: { select: { firstName: true, lastName: true, businessName: true } } },
    take: TOPE_CUENTAS + 1,
  });
  let aPagar: InformeAPagar | null = null;
  if (cuentas.length > TOPE_CUENTAS) avisos.push(`${AVISO_DEMASIADOS} (A pagar)`);
  else {
    const pend: CuentaPendiente[] = cuentas.map((c) => ({
      id: c.id,
      proveedorId: c.supplierClientId,
      proveedorNombre: c.supplier ? nombreDeContacto(c.supplier) : "Sin proveedor",
      dueDate: c.dueDate ? fechaDeBase(c.dueDate) : null,
      importe: pesosDeBase(c.amountArs),
    }));
    aPagar = informeAPagar(pend, hoy);
  }
  return { hoy, mes, aCobrar, cobrado, aPagar, avisos };
}
