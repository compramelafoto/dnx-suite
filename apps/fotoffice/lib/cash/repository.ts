import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { clientDisplayName } from "@/lib/clients/display";

/**
 * Las consultas de Caja.
 *
 * Todas llevan `workspaceId` en el `where` —el aislamiento entre instituciones no es
 * opcional— y todas devuelven los importes ya convertidos a centavos: quien llama nunca ve
 * un `Decimal` de Prisma, que es justo lo que `lib/membership/money.ts` existe para evitar.
 */

export type CashAccountRow = {
  id: string;
  name: string;
  kind: string;
  isVault: boolean;
  isDefault: boolean;
  isActive: boolean;
  fixedFloatMinor: number | null;
  order: number;
};

/** Las cuentas del workspace, activas primero y en el orden en que se configuraron. */
export async function listAccounts(workspaceId: string): Promise<CashAccountRow[]> {
  const rows = await prisma.cashAccount.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      kind: true,
      isVault: true,
      isDefault: true,
      isActive: true,
      fixedFloatArs: true,
      order: true,
    },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    isVault: r.isVault,
    isDefault: r.isDefault,
    isActive: r.isActive,
    fixedFloatMinor: r.fixedFloatArs === null ? null : decimalArsToMinor(r.fixedFloatArs),
    order: r.order,
  }));
}

export type CashCategoryRow = {
  id: string;
  name: string;
  kind: "INGRESO" | "EGRESO";
  order: number;
};

/** Las categorías activas, opcionalmente filtradas por lado: una categoría sirve para uno solo. */
export async function listCategories(
  workspaceId: string,
  kind?: "INGRESO" | "EGRESO",
): Promise<CashCategoryRow[]> {
  const rows = await prisma.cashCategory.findMany({
    where: { workspaceId, isActive: true, ...(kind ? { kind } : {}) },
    select: { id: true, name: true, kind: true, order: true },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind as "INGRESO" | "EGRESO", order: r.order }));
}

export type OpenShiftRow = {
  id: string;
  accountId: string;
  openedAt: Date;
  openedByUserId: number | null;
  openingAmountMinor: number;
};

/**
 * El turno abierto de esa cuenta, si hay uno.
 *
 * Null es la respuesta correcta y frecuente: una cuenta digital o la caja fuerte no llevan
 * turno, y una cuenta de mostrador puede estar simplemente sin abrir todavía.
 */
export async function openShiftFor(workspaceId: string, accountId: string): Promise<OpenShiftRow | null> {
  const row = await prisma.cashShift.findFirst({
    where: { workspaceId, accountId, status: "ABIERTO" },
    select: {
      id: true,
      accountId: true,
      openedAt: true,
      openedByUserId: true,
      openingAmountArs: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.accountId,
    openedAt: row.openedAt,
    openedByUserId: row.openedByUserId,
    openingAmountMinor: decimalArsToMinor(row.openingAmountArs),
  };
}

const movementSelect = {
  id: true,
  kind: true,
  amountArs: true,
  occurredAt: true,
  accountId: true,
  account: { select: { name: true } },
  shiftId: true,
  categoryId: true,
  category: { select: { name: true } },
  paymentMethod: true,
  clientId: true,
  client: { select: { kind: true, firstName: true, lastName: true, businessName: true } },
  description: true,
  receiptRef: true,
  sourceModule: true,
  sourceRef: true,
  reversesMovementId: true,
  reverseReason: true,
  // Sólo para saber si YA lo anularon: `reversesMovementId` es único, así que a lo sumo hay uno.
  reversedBy: { select: { id: true } },
  transferId: true,
} satisfies Prisma.CashMovementSelect;

type MovementQueryRow = Prisma.CashMovementGetPayload<{ select: typeof movementSelect }>;

export type MovementRow = {
  id: string;
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  occurredAt: Date;
  accountId: string;
  accountName: string;
  shiftId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethod: string;
  clientId: string | null;
  clientName: string | null;
  description: string;
  receiptRef: string | null;
  sourceModule: string;
  sourceRef: string | null;
  reversesMovementId: string | null;
  reverseReason: string | null;
  /** Ya tiene un contramovimiento que lo anula. Se usa para no ofrecer anular dos veces. */
  isReversed: boolean;
  /** Es una pata de un pase entre cuentas: no es ingreso ni egreso del negocio. */
  transferId: string | null;
};

function toMovementRow(r: MovementQueryRow): MovementRow {
  return {
    id: r.id,
    kind: r.kind as "INGRESO" | "EGRESO",
    amountMinor: decimalArsToMinor(r.amountArs),
    occurredAt: r.occurredAt,
    accountId: r.accountId,
    accountName: r.account.name,
    shiftId: r.shiftId,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    paymentMethod: r.paymentMethod,
    clientId: r.clientId,
    clientName: r.client ? clientDisplayName(r.client) : null,
    description: r.description,
    receiptRef: r.receiptRef,
    sourceModule: r.sourceModule,
    sourceRef: r.sourceRef,
    reversesMovementId: r.reversesMovementId,
    reverseReason: r.reverseReason,
    isReversed: r.reversedBy !== null,
    transferId: r.transferId,
  };
}

export type MovementFilters = {
  accountId?: string;
  categoryId?: string;
  clientId?: string;
  kind?: "INGRESO" | "EGRESO";
  sourceModule?: string;
  from?: Date;
  to?: Date;
  take?: number;
};

/** El libro, más reciente primero. Sin filtros trae los últimos 200 movimientos del workspace. */
export async function listMovements(
  workspaceId: string,
  filtros: MovementFilters = {},
): Promise<MovementRow[]> {
  const rows = await prisma.cashMovement.findMany({
    where: {
      workspaceId,
      ...(filtros.accountId ? { accountId: filtros.accountId } : {}),
      ...(filtros.categoryId ? { categoryId: filtros.categoryId } : {}),
      ...(filtros.clientId ? { clientId: filtros.clientId } : {}),
      ...(filtros.kind ? { kind: filtros.kind } : {}),
      ...(filtros.sourceModule ? { sourceModule: filtros.sourceModule } : {}),
      ...(filtros.from || filtros.to
        ? {
            occurredAt: {
              ...(filtros.from ? { gte: filtros.from } : {}),
              ...(filtros.to ? { lte: filtros.to } : {}),
            },
          }
        : {}),
    },
    select: movementSelect,
    orderBy: { occurredAt: "desc" },
    take: filtros.take ?? 200,
  });
  return rows.map(toMovementRow);
}

/** Los movimientos de un turno puntual, para el detalle de un arqueo. Orden cronológico. */
export async function movementsOfShift(workspaceId: string, shiftId: string): Promise<MovementRow[]> {
  const rows = await prisma.cashMovement.findMany({
    where: { workspaceId, shiftId },
    select: movementSelect,
    orderBy: { occurredAt: "asc" },
  });
  return rows.map(toMovementRow);
}
