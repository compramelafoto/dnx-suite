import "server-only";
import { Prisma, type PrismaClient } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { lineTotalMinor, ticketTotals, type TicketLine } from "./ticket";
import { nextSaleNumber } from "./sale-number";
import { SALES_CASH_CATEGORY_NAME, type SalePaymentMethod } from "./constants";
import type { CheckoutClientResolution } from "./checkout";

/**
 * La venta de mostrador. Es el corazón del módulo: todo lo demás existe para que esto
 * funcione.
 *
 * Hace TRES cosas en la misma transacción, o no hace ninguna: escribe la `Sale` y sus
 * `SaleItem`, deposita en Caja, y descuenta el stock. Recibe la transacción de quien llama
 * —nunca la abre— porque las tres cosas nacen juntas o no nacen: una venta sin su ingreso
 * deja el libro mintiendo, y un ingreso sin su venta deja plata sin explicación.
 */
export type RecordSaleInput = {
  workspaceId: string;
  createdByUserId: number | null;
  occurredAt: Date;
  paymentMethod: SalePaymentMethod;
  discountMinor: number;
  note: string | null;
  client: CheckoutClientResolution;
  lines: readonly TicketLine[];
};

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Resuelve —o da de alta— el `Client` de la venta, o `null` si no corresponde tocar nada.
 *
 * La guarda va PRIMERO, antes de CUALQUIER acceso a `Client`: es la misma forma que
 * `resolveBookingClient` en `lib/bookings/cash-deposit.ts`, y por el mismo motivo. `Client`
 * viene de una migración que en este repo se aplica a mano después de desplegar el código:
 * si esto consultara la tabla antes de preguntar, una venta en un workspace donde esa
 * migración todavía no corrió reventaría con un error de Postgres DENTRO de la transacción
 * de la venta, y volcaría el cobro entero. Con el módulo Clientes apagado, la venta se
 * registra igual, sin cliente identificado.
 */
async function resolveSaleClient(
  tx: Tx,
  workspaceId: string,
  createdByUserId: number | null,
  client: CheckoutClientResolution,
): Promise<string | null> {
  if (client.mode === "none") return null;

  const clientsEnabled = await isModuleEnabledForWorkspace(workspaceId, CLIENTS_MODULE_KEY);
  if (!clientsEnabled) return null;

  if (client.mode === "existing") {
    // El `where` de una venta no puede llevar el cliente como único: la pertenencia se
    // verifica con un `count` aparte, antes de escribir (§regla 5). A diferencia de un
    // `productId` ajeno —que sí rechaza el ticket entero, porque cambia precio y stock—, un
    // `clientId` que no es de este workspace sólo hace que la venta quede sin cliente
    // identificado: es metadata, no algo que valga la pena bloquear un cobro para corregir.
    const propio = await tx.client.count({ where: { id: client.clientId, workspaceId } });
    return propio > 0 ? client.clientId : null;
  }

  // "new": nace junto con la venta, dentro de esta misma transacción — un cliente creado y
  // una venta que después falló dejaría basura en el padrón.
  const { id } = await findOrCreateClient(tx as Prisma.TransactionClient, {
    workspaceId,
    email: client.email,
    phone: client.phone,
    firstName: client.firstName,
    lastName: client.lastName,
    createdByUserId,
  });
  return id;
}

/**
 * Descuenta el stock de los renglones cuyo producto controla existencia, con un
 * `StockMovement` por renglón. Vender NUNCA se bloquea por falta de stock (§regla 2): la
 * existencia puede quedar negativa, y eso es información —falta cargar una entrada—, no un
 * error. Por eso esto sólo resta, nunca verifica que alcance.
 */
async function descontarStock(
  tx: Tx,
  workspaceId: string,
  saleId: string,
  createdByUserId: number | null,
  lines: readonly TicketLine[],
): Promise<void> {
  const productIds = [...new Set(lines.map((l) => l.productId).filter((id): id is string => id !== null))];
  if (productIds.length === 0) return;

  const productos = await tx.product.findMany({
    where: { id: { in: productIds }, workspaceId },
    select: { id: true, tracksStock: true },
  });
  const controlaExistencia = new Map(productos.map((p) => [p.id, p.tracksStock]));

  for (const line of lines) {
    if (line.productId === null) continue;
    if (!controlaExistencia.get(line.productId)) continue;

    await tx.stockMovement.create({
      data: {
        workspaceId,
        productId: line.productId,
        // Firmado: la venta resta.
        qty: -line.qty,
        reason: "VENTA",
        sourceModule: "sales",
        sourceRef: saleId,
        createdByUserId,
      },
    });
    await tx.product.update({
      where: { id: line.productId },
      data: { stockQty: { decrement: line.qty } },
    });
  }
}

/**
 * Deposita el total de la venta en Caja, o no deposita nada si el módulo está apagado —la
 * venta se registra igual (§regla 3). La guarda de `isModuleEnabledForWorkspace` va antes de
 * tocar `cashAccount`/`cashCategory`, por el mismo motivo que en `resolveSaleClient`: es el
 * error que ya se cometió dos veces en la etapa anterior de este proyecto.
 */
async function depositarEnCaja(
  tx: Tx,
  input: { workspaceId: string; saleId: string; saleNumber: number; clientId: string | null } & Pick<
    RecordSaleInput,
    "paymentMethod" | "occurredAt"
  >,
  totalMinor: number,
): Promise<string | null> {
  // Sin importe no hay nada que depositar: un ticket que da $0 (descuento igual al
  // subtotal) es válido y no genera movimiento — `recordCashMovement` rechaza un importe en
  // cero, así que ni se intenta.
  if (totalMinor <= 0) return null;

  const cashEnabled = await isModuleEnabledForWorkspace(input.workspaceId, CASH_MODULE_KEY);
  if (!cashEnabled) return null;

  const destino = resolveDepositTarget({
    cashEnabled,
    paymentMethod: input.paymentMethod,
    accounts: await tx.cashAccount.findMany({
      where: { workspaceId: input.workspaceId, isActive: true },
      select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
      orderBy: { order: "asc" },
    }),
    categories: await tx.cashCategory.findMany({
      where: { workspaceId: input.workspaceId, kind: "INGRESO", isActive: true },
      select: { id: true, name: true, kind: true },
    }),
    // Si "Ventas" no existe como categoría, se deposita sin categoría: no es un error.
    categoryName: SALES_CASH_CATEGORY_NAME,
  });
  if (!destino.ok) return null;

  const movimiento = await recordCashMovement(tx, {
    workspaceId: input.workspaceId,
    accountId: destino.accountId,
    categoryId: destino.categoryId,
    clientId: input.clientId,
    kind: "INGRESO",
    amountMinor: totalMinor,
    occurredAt: input.occurredAt,
    description: `Venta #${input.saleNumber}`,
    paymentMethod: input.paymentMethod,
    sourceModule: "sales",
    sourceRef: input.saleId,
  });
  return movimiento.id;
}

export async function recordSale(
  tx: Tx,
  input: RecordSaleInput,
): Promise<{ saleId: string; saleNumber: number }> {
  const totals = ticketTotals(input.lines, input.discountMinor);

  const clientId = await resolveSaleClient(tx, input.workspaceId, input.createdByUserId, input.client);

  // El número correlativo se calcula leyendo el último y sumando uno, con reintento ante
  // choque del índice único `(workspaceId, saleNumber)` — mismo criterio que `clientNumber`
  // (`lib/clients/find-or-create.ts`), pero NO con la misma implementación.
  //
  // Ahí el `create` se envuelve en un `try/catch` de P2002 porque `findOrCreateClient` corre
  // dentro de la transacción de QUIEN LO LLAMA sin abrir la suya propia — pero mirá
  // `app/(shell)/clientes/actions.ts`: `saveClientAction`, el alta suelta de un cliente desde
  // su propia pantalla, ni siquiera abre `$transaction`, así que cada `create` es su propia
  // sentencia autónoma y un P2002 no deja nada abortado. Acá NO: este `for` corre dentro del
  // `$transaction` que abre `checkoutAction`, junto con el descuento de stock y el depósito en
  // Caja — los tres tienen que nacer juntos o no nacer (ver el comentario de arriba del
  // archivo). En PostgreSQL, un error DENTRO de un `BEGIN…COMMIT` aborta la transacción
  // ENTERA: la sentencia siguiente no corre, revienta con "current transaction is aborted"
  // (25P02), y el `catch` nunca llega a ver el P2002 limpio que espera — el reintento no podía
  // funcionar nunca. Es el MISMO defecto que ya se corrigió en `lib/sales/global-catalog.ts`
  // (Tarea 5) para `upsertGlobalProduct`, con el mismo arreglo: `createMany` + `skipDuplicates`
  // compila a `ON CONFLICT DO NOTHING`, así que un choque de unicidad deja de ser un error de
  // SQL y la transacción sigue viva para releer y reintentar con el próximo número. Ésta es la
  // TERCERA vez que este proyecto tropieza con la misma familia de bug (welcome de vuelta,
  // "un `catch` de P2002 no puede vivir dentro de una transacción interactiva"): si en algún
  // momento esto "se simplifica" de vuelta a un `create` con `catch`, va a romperse apenas dos
  // cajas cobren al mismo tiempo, y las pruebas con una sola caja nunca lo van a notar.
  let creada: { id: string; saleNumber: number } | null = null;
  for (let intento = 0; intento < 3 && !creada; intento++) {
    const ultima = await tx.sale.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { saleNumber: "desc" },
      select: { saleNumber: true },
    });
    const saleNumber = nextSaleNumber(ultima?.saleNumber ?? null);

    const resultado = await tx.sale.createMany({
      data: [
        {
          workspaceId: input.workspaceId,
          saleNumber,
          clientId,
          occurredAt: input.occurredAt,
          subtotalArs: minorToDecimalString(totals.subtotalMinor),
          discountArs: minorToDecimalString(totals.discountMinor),
          totalArs: minorToDecimalString(totals.totalMinor),
          paymentMethod: input.paymentMethod,
          note: input.note,
          createdByUserId: input.createdByUserId,
        },
      ],
      skipDuplicates: true,
    });

    if (resultado.count === 1) {
      // Ganamos la carrera con este número. `createMany` no devuelve el `id` que Prisma le
      // generó (a diferencia de `create`), así que se relee por el único compuesto que
      // acabamos de asegurar.
      creada = await tx.sale.findUniqueOrThrow({
        where: { workspaceId_saleNumber: { workspaceId: input.workspaceId, saleNumber } },
        select: { id: true, saleNumber: true },
      });
    }
    // `count === 0`: otra caja tomó este número un instante antes (`ON CONFLICT DO NOTHING`
    // descartó la fila). Se reintenta con el próximo número, sin que esto haya sido un error.
  }
  if (!creada) {
    throw new Error("No se pudo asignar un número de venta después de tres intentos.");
  }
  const saleId = creada.id;

  // Los renglones van aparte: `createMany` no admite `items: { create: [...] }` anidado como
  // sí admitía el `create` que reemplaza. `saleId` ya es conocido porque la fila de `Sale`
  // existe.
  await tx.saleItem.createMany({
    data: input.lines.map((line) => ({
      saleId,
      productId: line.productId,
      description: line.description,
      qty: line.qty,
      unitPriceArs: minorToDecimalString(line.unitPriceMinor),
      unitCostArs: line.unitCostMinor === null ? null : minorToDecimalString(line.unitCostMinor),
      lineTotalArs: minorToDecimalString(lineTotalMinor(line)),
      priceWasOverridden: line.priceWasOverridden,
    })),
  });

  await descontarStock(tx, input.workspaceId, creada.id, input.createdByUserId, input.lines);

  const cashMovementId = await depositarEnCaja(
    tx,
    {
      workspaceId: input.workspaceId,
      saleId: creada.id,
      saleNumber: creada.saleNumber,
      clientId,
      paymentMethod: input.paymentMethod,
      occurredAt: input.occurredAt,
    },
    totals.totalMinor,
  );
  if (cashMovementId) {
    await tx.sale.update({ where: { id: creada.id }, data: { cashMovementId } });
  }

  return { saleId: creada.id, saleNumber: creada.saleNumber };
}
