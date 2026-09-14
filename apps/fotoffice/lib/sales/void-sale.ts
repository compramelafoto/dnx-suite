import "server-only";
import { Prisma, type PrismaClient } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { buildReversal, type ReversalValues } from "@/lib/cash/reverse";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

/**
 * Anular una venta. Espejo de `record-sale.ts`, en sentido contrario.
 *
 * Anular no borra: hace TRES cosas simétricas a la venta, en la misma transacción que recibe
 * de quien llama (nunca abre la suya propia, mismo criterio que `recordSale`) —
 *
 *   1. marca la `Sale` como ANULADA, con motivo, fecha y quién;
 *   2. devuelve el stock de los renglones que lo controlan, con `reason: "DEVOLUCION"`;
 *   3. escribe el contramovimiento en Caja que arma `buildReversal` —nunca a mano—, para que
 *      esta anulación se comporte exactamente igual que la de un movimiento manual.
 *
 * Todo se resuelve y se valida ANTES del primer `create`/`update`: si el contramovimiento no
 * se puede escribir (por ejemplo, alguien ya anuló ese asiento a mano desde
 * `/caja/movimientos`), esto vuelve `{ ok: false }` sin haber tocado ni el stock ni la `Sale`.
 * Escribir la devolución de stock primero y recién después descubrir que Caja rechaza el
 * contramovimiento dejaría la venta completada con media anulación adentro — y como esta
 * función nunca lanza para ese caso (vuelve un resultado, no un `throw`), la transacción de
 * quien llama haría `COMMIT` igual si el orden fuera al revés.
 */

export type VoidSaleInput = {
  workspaceId: string;
  saleId: string;
  reason: string;
  userId: number | null;
};

export type VoidSaleResult = { ok: true; saleNumber: number } | { ok: false; error: string };

type Tx = Prisma.TransactionClient | PrismaClient;

export async function voidSale(tx: Tx, input: VoidSaleInput): Promise<VoidSaleResult> {
  // Motivo obligatorio, igual que la anulación de un movimiento de Caja (`buildReversal`).
  // Se verifica ANTES de leer nada: un motivo en blanco no amerita ni una consulta.
  const motivo = input.reason.trim();
  if (motivo === "") return { ok: false, error: "Escribí por qué se anula la venta." };

  const venta = await tx.sale.findFirst({
    where: { id: input.saleId, workspaceId: input.workspaceId },
    select: { id: true, saleNumber: true, status: true, cashMovementId: true },
  });
  if (!venta) return { ok: false, error: "Esa venta no existe." };

  // Una venta anulada no se vuelve a anular. El estado se verifica antes de tocar cualquier
  // otra tabla: ni el stock ni Caja se rozan si esto corta acá.
  if (venta.status === "ANULADA") return { ok: false, error: "Esa venta ya está anulada." };

  // El plan del contramovimiento se arma y se valida ANTES de escribir nada (ver el porqué
  // completo arriba). `null` significa "no hay nada que revertir en Caja", que es un
  // resultado válido —no depositó, o Caja está apagada—, no un error a medio camino.
  const plan = await planCashReversal(tx, input.workspaceId, venta, motivo);
  if (!plan.ok) return { ok: false, error: plan.error };

  await devolverStock(tx, input.workspaceId, venta.id, input.userId);

  if (plan.value) {
    await escribirContramovimiento(tx, input.workspaceId, plan.value, input.userId);
  }

  await tx.sale.update({
    where: { id: venta.id },
    data: {
      status: "ANULADA",
      voidedAt: new Date(),
      voidedByUserId: input.userId,
      voidReason: motivo,
    },
  });

  return { ok: true, saleNumber: venta.saleNumber };
}

/**
 * Decide qué contramovimiento escribir, sin escribir nada todavía.
 *
 * Devuelve `{ value: null }` —no es un error— en dos casos: la venta nunca depositó
 * (`cashMovementId` nulo, porque Caja estaba apagada cuando se vendió), o Caja está apagada
 * AHORA. La guarda de `isModuleEnabledForWorkspace` va ANTES de tocar `cashMovement` o
 * `cashShift` —es el error que ya volteó operaciones dos veces en la etapa anterior de este
 * proyecto ("Caja apagada" en `recordSale`, y antes en `depositBookingPayment`), y una
 * tercera acá si se consultara esa tabla con el módulo apagado.
 *
 * Devuelve `{ ok: false }` cuando SÍ había algo que revertir pero `buildReversal` lo rechaza
 * —por ejemplo, alguien ya anuló ese asiento a mano desde `/caja/movimientos`—: ahí no hay
 * forma correcta de anular la venta sin dejar el libro de Caja mintiendo, así que la
 * anulación entera aborta y quien está en el mostrador se entera del motivo real.
 */
async function planCashReversal(
  tx: Tx,
  workspaceId: string,
  venta: { id: string; saleNumber: number; cashMovementId: string | null },
  reason: string,
): Promise<{ ok: true; value: ReversalValues | null } | { ok: false; error: string }> {
  if (!venta.cashMovementId) return { ok: true, value: null };

  const cashEnabled = await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY);
  if (!cashEnabled) {
    console.warn("[fotoffice][ventas] Caja apagada: se anula la venta sin contramovimiento", {
      workspaceId,
      saleId: venta.id,
      saleNumber: venta.saleNumber,
    });
    return { ok: true, value: null };
  }

  const movimiento = await tx.cashMovement.findFirst({
    where: { id: venta.cashMovementId, workspaceId },
    select: {
      id: true,
      kind: true,
      amountArs: true,
      accountId: true,
      categoryId: true,
      paymentMethod: true,
      clientId: true,
      description: true,
      reversedBy: { select: { id: true } },
      transferId: true,
    },
  });
  // La referencia está rota (no debería pasar: `cashMovementId` es único y lo escribió
  // `recordSale`), pero si el asiento no aparece, no hay nada que revertir.
  if (!movimiento) return { ok: true, value: null };

  const resultado = buildReversal(
    {
      id: movimiento.id,
      kind: movimiento.kind as "INGRESO" | "EGRESO",
      amountMinor: decimalArsToMinor(movimiento.amountArs),
      accountId: movimiento.accountId,
      categoryId: movimiento.categoryId,
      paymentMethod: movimiento.paymentMethod,
      clientId: movimiento.clientId,
      description: movimiento.description,
      alreadyReversed: movimiento.reversedBy !== null,
      transferId: movimiento.transferId,
    },
    reason,
  );
  if (!resultado.ok) return { ok: false, error: resultado.error };
  return { ok: true, value: resultado.values };
}

/** Escribe el contramovimiento que ya armó y validó `buildReversal`. */
async function escribirContramovimiento(
  tx: Tx,
  workspaceId: string,
  v: ReversalValues,
  userId: number | null,
): Promise<void> {
  // Si la anulación pasa con el turno todavía abierto, el contramovimiento entra en su
  // arqueo igual que cualquier otro — mismo criterio que `reverseMovementAction` en Caja.
  const turno = await tx.cashShift.findFirst({
    where: { workspaceId, accountId: v.accountId, status: "ABIERTO" },
    select: { id: true },
  });
  await tx.cashMovement.create({
    data: {
      workspaceId,
      accountId: v.accountId,
      shiftId: turno?.id ?? null,
      kind: v.kind,
      amountArs: minorToDecimalString(v.amountMinor),
      occurredAt: new Date(),
      categoryId: v.categoryId,
      paymentMethod: v.paymentMethod,
      clientId: v.clientId,
      description: v.description,
      sourceModule: v.sourceModule,
      sourceRef: v.sourceRef,
      reversesMovementId: v.reversesMovementId,
      reverseReason: v.reverseReason,
      transferId: v.transferId,
      createdByUserId: userId,
    },
  });
}

/**
 * Devuelve el stock de los renglones cuyo producto controla existencia, con un
 * `StockMovement` por renglón y motivo `DEVOLUCION`. Espejo de `descontarStock` en
 * `record-sale.ts`: mismo filtro por `tracksStock`, misma relectura de `Product` por
 * `workspaceId` (defensiva: un `productId` de otro negocio no debería poder llegar hasta acá,
 * pero si llegara, esto no lo toca). La cantidad viaja positiva —`SaleItem.qty` ya lo es—
 * porque una devolución suma, igual que una entrada.
 */
async function devolverStock(
  tx: Tx,
  workspaceId: string,
  saleId: string,
  userId: number | null,
): Promise<void> {
  const items = await tx.saleItem.findMany({
    where: { saleId },
    select: { productId: true, qty: true },
  });

  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => id !== null))];
  if (productIds.length === 0) return;

  const productos = await tx.product.findMany({
    where: { id: { in: productIds }, workspaceId },
    select: { id: true, tracksStock: true },
  });
  const controlaExistencia = new Map(productos.map((p) => [p.id, p.tracksStock]));

  for (const item of items) {
    if (item.productId === null) continue;
    if (!controlaExistencia.get(item.productId)) continue;

    await tx.stockMovement.create({
      data: {
        workspaceId,
        productId: item.productId,
        qty: item.qty,
        reason: "DEVOLUCION",
        sourceModule: "sales",
        sourceRef: saleId,
        createdByUserId: userId,
      },
    });
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQty: { increment: item.qty } },
    });
  }
}
