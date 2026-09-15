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
 * se puede escribir por un motivo que la pantalla de ventas no puede resolver sola (por
 * ejemplo, el asiento original es la pata de un pase entre cuentas), esto vuelve
 * `{ ok: false }` sin haber tocado ni el stock ni la `Sale`. Escribir la devolución de stock
 * primero y recién después descubrir que Caja rechaza el contramovimiento dejaría la venta
 * completada con media anulación adentro — y como esta función nunca lanza para ese caso
 * (vuelve un resultado, no un `throw`), la transacción de quien llama haría `COMMIT` igual si
 * el orden fuera al revés.
 *
 * Hay una excepción a propósito: si alguien ya anuló ese mismo asiento a mano desde
 * `/caja/movimientos`, la plata YA volvió — no hay nada que `voidSale` tenga que corregir en
 * Caja. Ahí `planCashReversal` no aborta: saltea el contramovimiento (ya existe) y deja
 * seguir a la venta. Ver el porqué completo en el comentario de `planCashReversal`.
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
 * `buildReversal` puede rechazar por dos motivos bien distintos, y acá se los trata distinto
 * a propósito:
 *
 *   - El asiento ya fue anulado a mano desde `/caja/movimientos` (`reversedBy !== null`): la
 *     plata YA volvió a la cuenta, alguien se adelantó. No hay nada roto en Caja que corregir
 *     — sólo falta que la venta se entere. Acá NO se aborta: se saltea el contramovimiento
 *     (escribir uno segundo duplicaría la devolución) y se deja constancia con un
 *     `console.warn`, mismo estilo que `depositBookingPayment` en `lib/bookings/cash-deposit.ts`.
 *     Abortar acá dejaría la `Sale` en `COMPLETADA` para siempre —el motivo de rechazo nunca
 *     cambia, así que nunca se puede reintentar— mientras Caja ya dice que la plata volvió: los
 *     dos libros contradiciéndose y sin forma de arreglarlo desde la interfaz, que es
 *     exactamente peor que saltear un contramovimiento que ya está hecho.
 *
 *     OJO, esto es DISTINTO de `reverseMovementAction` (`/caja/movimientos`), que ante el mismo
 *     rechazo SÍ aborta, y ahí abortar es lo correcto: la anulación de un movimiento suelto no
 *     tiene stock ni estado de venta pendientes — no hay "el resto" que deba completarse. Acá
 *     sí lo hay, y es independiente de Caja. No es una inconsistencia entre los dos lugares:
 *     es la misma regla ("no dejes un libro a medio corregir") aplicada a dos situaciones con
 *     distinta cantidad de libros en juego.
 *
 *   - Cualquier otro rechazo (hoy, sólo la pata de un pase entre cuentas): ahí sí hay algo
 *     roto que la pantalla de ventas no puede resolver por su cuenta —el pase inverso es una
 *     operación con nombre propio, en `/caja/pases`—, así que la anulación entera aborta y
 *     quien está en el mostrador se entera del motivo real.
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

  const yaAnuladoAMano = movimiento.reversedBy !== null;

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
      alreadyReversed: yaAnuladoAMano,
      transferId: movimiento.transferId,
    },
    reason,
  );
  if (resultado.ok) return { ok: true, value: resultado.values };

  // Se distingue con el dato que ya se leyó (`yaAnuladoAMano`), no con el texto del error de
  // `buildReversal` — ese texto es para mostrar en pantalla, no para tomar decisiones acá.
  if (yaAnuladoAMano) {
    console.warn(
      "[fotoffice][ventas] Caja ya tenía el contramovimiento hecho a mano: se anula la venta sin duplicar el asiento",
      { workspaceId, saleId: venta.id, saleNumber: venta.saleNumber, cashMovementId: movimiento.id },
    );
    return { ok: true, value: null };
  }

  return { ok: false, error: resultado.error };
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
