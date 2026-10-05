import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CASH_MODULE_KEY, type MovementSource } from "./constants";
import { recordCashMovement } from "./record-movement";
import { buildReversal } from "./reverse";

/**
 * Lo que pasa en Caja después de que un módulo depositó un cobro por Mercado Pago: las
 * comisiones que se descontaron, las devoluciones parciales y la anulación completa cuando el
 * pago se devuelve o se desconoce.
 *
 * Todo cuelga del movimiento de ingreso que ya depositó el módulo, identificado por
 * `(sourceModule, sourceRef)`. Los asientos hijos usan `sourceRef` con sufijo (`#mp-fee`,
 * `#platform-fee`, `#refund-…`), así que el índice único los hace idempotentes igual que al
 * ingreso: un aviso repetido o una conciliación que vuelve a pasar no duplican nada.
 *
 * Decisión de producto (2026-10-03): el cobro se ve **bruto**, y las comisiones como egresos
 * aparte. La cuenta queda en el neto, igual que en Mercado Pago, y los reportes dicen cuánto
 * se recaudó y cuánto costó cobrarlo.
 */

type Tx = Prisma.TransactionClient | PrismaClient;
type AutoSource = Exclude<MovementSource, "manual">;

export const MP_FEE_CATEGORY = "Comisión Mercado Pago";
export const PLATFORM_FEE_CATEGORY = "Comisión plataforma";
export const REFUND_CATEGORY = "Devoluciones";

export const FEE_SUFFIX_MP = "#mp-fee";
export const FEE_SUFFIX_PLATFORM = "#platform-fee";
const REFUND_SUFFIX = "#refund-";

/** La categoría con ese nombre y tipo; la crea si el workspace no la tiene. */
export async function ensureCashCategory(
  tx: Tx,
  workspaceId: string,
  name: string,
  kind: "INGRESO" | "EGRESO",
): Promise<string> {
  const existente = await tx.cashCategory.findFirst({
    where: { workspaceId, name, kind },
    select: { id: true },
  });
  if (existente) return existente.id;
  const creada = await tx.cashCategory.create({
    data: { workspaceId, name, kind, order: 80 },
    select: { id: true },
  });
  return creada.id;
}

async function findIncome(tx: Tx, input: { workspaceId: string; sourceModule: AutoSource; sourceRef: string }) {
  return tx.cashMovement.findFirst({
    where: {
      workspaceId: input.workspaceId,
      sourceModule: input.sourceModule,
      sourceRef: input.sourceRef,
      kind: "INGRESO",
    },
    select: { id: true, accountId: true, clientId: true, description: true, occurredAt: true },
  });
}

/**
 * Asienta las comisiones de un cobro ya depositado. Si el ingreso no está en Caja (Caja
 * apagada, o el cobro es anterior a encenderla) no hace nada: una comisión sin su ingreso
 * dejaría la cuenta en negativo sin explicación.
 */
export async function recordCollectionFees(
  tx: Tx,
  input: {
    workspaceId: string;
    sourceModule: AutoSource;
    sourceRef: string;
    mpFeeMinor: number;
    platformFeeMinor: number;
  },
): Promise<{ recorded: number }> {
  if (!(await isModuleEnabledForWorkspace(input.workspaceId, CASH_MODULE_KEY))) return { recorded: 0 };
  const ingreso = await findIncome(tx, input);
  if (!ingreso) return { recorded: 0 };

  let recorded = 0;
  const filas = [
    { monto: input.mpFeeMinor, sufijo: FEE_SUFFIX_MP, categoria: MP_FEE_CATEGORY, texto: "Comisión Mercado Pago" },
    {
      monto: input.platformFeeMinor,
      sufijo: FEE_SUFFIX_PLATFORM,
      categoria: PLATFORM_FEE_CATEGORY,
      texto: "Comisión plataforma",
    },
  ];
  for (const f of filas) {
    if (f.monto <= 0) continue;
    const categoryId = await ensureCashCategory(tx, input.workspaceId, f.categoria, "EGRESO");
    const r = await recordCashMovement(tx, {
      workspaceId: input.workspaceId,
      accountId: ingreso.accountId,
      categoryId,
      clientId: ingreso.clientId,
      kind: "EGRESO",
      amountMinor: f.monto,
      occurredAt: ingreso.occurredAt,
      description: `${f.texto} — ${ingreso.description}`,
      paymentMethod: "MERCADO_PAGO",
      sourceModule: input.sourceModule,
      sourceRef: `${input.sourceRef}${f.sufijo}`,
    });
    if (r.created) recorded += 1;
  }
  return { recorded };
}

/**
 * Lleva a Caja una devolución parcial: asienta como egreso lo devuelto que todavía no estaba
 * asentado. Cada asiento lleva en la referencia el total devuelto hasta ese momento, así que
 * una segunda devolución parcial suma sólo la diferencia y repetir el aviso no duplica.
 */
export async function recordPartialRefund(
  tx: Tx,
  input: {
    workspaceId: string;
    sourceModule: AutoSource;
    sourceRef: string;
    refundedMinor: number;
    occurredAt: Date;
  },
): Promise<{ recorded: boolean }> {
  if (input.refundedMinor <= 0) return { recorded: false };
  if (!(await isModuleEnabledForWorkspace(input.workspaceId, CASH_MODULE_KEY))) return { recorded: false };
  const ingreso = await findIncome(tx, input);
  if (!ingreso) return { recorded: false };

  const previas = await tx.cashMovement.findMany({
    where: {
      workspaceId: input.workspaceId,
      sourceModule: input.sourceModule,
      sourceRef: { startsWith: `${input.sourceRef}${REFUND_SUFFIX}` },
    },
    select: { amountArs: true },
  });
  const yaAsentado = previas.reduce((s, p) => s + decimalArsToMinor(p.amountArs), 0);
  const falta = input.refundedMinor - yaAsentado;
  if (falta <= 0) return { recorded: false };

  const categoryId = await ensureCashCategory(tx, input.workspaceId, REFUND_CATEGORY, "EGRESO");
  const r = await recordCashMovement(tx, {
    workspaceId: input.workspaceId,
    accountId: ingreso.accountId,
    categoryId,
    clientId: ingreso.clientId,
    kind: "EGRESO",
    amountMinor: falta,
    occurredAt: input.occurredAt,
    description: `Devolución parcial — ${ingreso.description}`,
    paymentMethod: "MERCADO_PAGO",
    sourceModule: input.sourceModule,
    sourceRef: `${input.sourceRef}${REFUND_SUFFIX}${input.refundedMinor}`,
  });
  return { recorded: r.created };
}

/**
 * Anula en Caja un cobro entero —el ingreso y todo lo que cuelga de él— porque el pago se
 * devolvió o se desconoció. Escribe contramovimientos con el mismo mecanismo que la anulación
 * manual; los que ya estaban anulados se saltean, así que es seguro repetirlo.
 */
export async function reverseCollection(
  tx: Tx,
  input: {
    workspaceId: string;
    sourceModule: AutoSource;
    sourceRef: string;
    reason: string;
    occurredAt: Date;
  },
): Promise<{ reversed: number }> {
  if (!(await isModuleEnabledForWorkspace(input.workspaceId, CASH_MODULE_KEY))) return { reversed: 0 };

  const movimientos = await tx.cashMovement.findMany({
    where: {
      workspaceId: input.workspaceId,
      sourceModule: input.sourceModule,
      OR: [{ sourceRef: input.sourceRef }, { sourceRef: { startsWith: `${input.sourceRef}#` } }],
    },
    select: {
      id: true,
      kind: true,
      amountArs: true,
      accountId: true,
      categoryId: true,
      paymentMethod: true,
      clientId: true,
      description: true,
      transferId: true,
      reversedBy: { select: { id: true } },
    },
  });

  let reversed = 0;
  for (const m of movimientos) {
    const r = buildReversal(
      {
        id: m.id,
        kind: m.kind as "INGRESO" | "EGRESO",
        amountMinor: decimalArsToMinor(m.amountArs),
        accountId: m.accountId,
        categoryId: m.categoryId,
        paymentMethod: m.paymentMethod,
        clientId: m.clientId,
        description: m.description,
        alreadyReversed: m.reversedBy !== null,
        transferId: m.transferId,
      },
      input.reason,
    );
    if (!r.ok) continue;
    const v = r.values;
    await tx.cashMovement.create({
      data: {
        workspaceId: input.workspaceId,
        accountId: v.accountId,
        kind: v.kind,
        amountArs: minorToDecimalString(v.amountMinor),
        occurredAt: input.occurredAt,
        categoryId: v.categoryId,
        paymentMethod: v.paymentMethod,
        clientId: v.clientId,
        description: v.description,
        sourceModule: v.sourceModule,
        sourceRef: v.sourceRef,
        reversesMovementId: v.reversesMovementId,
        reverseReason: v.reverseReason,
      },
    });
    reversed += 1;
  }
  return { reversed };
}
