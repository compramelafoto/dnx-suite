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

/**
 * Las cuentas del workspace, en el orden en que se configuraron.
 *
 * Por omisión sólo las activas —es lo que necesita casi todo llamador, para no ofrecer una
 * cuenta dada de baja en un selector—. La pantalla de configuración pide `includeInactive`
 * porque ahí sí hace falta verlas, para poder reactivarlas.
 */
export async function listAccounts(
  workspaceId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<CashAccountRow[]> {
  const rows = await prisma.cashAccount.findMany({
    where: { workspaceId, ...(opts.includeInactive ? {} : { isActive: true }) },
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
  isActive: boolean;
  order: number;
};

/**
 * Las categorías, opcionalmente filtradas por lado: una categoría sirve para uno solo.
 * Por omisión sólo las activas; `includeInactive` es para la pantalla de configuración.
 */
export async function listCategories(
  workspaceId: string,
  kind?: "INGRESO" | "EGRESO",
  opts: { includeInactive?: boolean } = {},
): Promise<CashCategoryRow[]> {
  const rows = await prisma.cashCategory.findMany({
    where: {
      workspaceId,
      ...(opts.includeInactive ? {} : { isActive: true }),
      ...(kind ? { kind } : {}),
    },
    select: { id: true, name: true, kind: true, isActive: true, order: true },
    orderBy: { order: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as "INGRESO" | "EGRESO",
    isActive: r.isActive,
    order: r.order,
  }));
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

export type ShiftRow = {
  id: string;
  accountId: string;
  accountName: string;
  status: "ABIERTO" | "CERRADO";
  openedAt: Date;
  openedByUserId: number | null;
  closedAt: Date | null;
  closedByUserId: number | null;
  openingAmountMinor: number;
  /// Null mientras el turno sigue abierto: todavía no se contó.
  countedAmountMinor: number | null;
  expectedAmountMinor: number | null;
  differenceMinor: number | null;
  differenceNote: string | null;
};

/** El historial de arqueos del workspace, más reciente primero. */
export async function listShifts(workspaceId: string, opts: { take?: number } = {}): Promise<ShiftRow[]> {
  const rows = await prisma.cashShift.findMany({
    where: { workspaceId },
    select: {
      id: true,
      accountId: true,
      account: { select: { name: true } },
      status: true,
      openedAt: true,
      openedByUserId: true,
      closedAt: true,
      closedByUserId: true,
      openingAmountArs: true,
      countedAmountArs: true,
      expectedAmountArs: true,
      differenceArs: true,
      differenceNote: true,
    },
    orderBy: { openedAt: "desc" },
    take: opts.take ?? 200,
  });
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    accountName: r.account.name,
    status: r.status as "ABIERTO" | "CERRADO",
    openedAt: r.openedAt,
    openedByUserId: r.openedByUserId,
    closedAt: r.closedAt,
    closedByUserId: r.closedByUserId,
    openingAmountMinor: decimalArsToMinor(r.openingAmountArs),
    countedAmountMinor: r.countedAmountArs === null ? null : decimalArsToMinor(r.countedAmountArs),
    expectedAmountMinor: r.expectedAmountArs === null ? null : decimalArsToMinor(r.expectedAmountArs),
    differenceMinor: r.differenceArs === null ? null : decimalArsToMinor(r.differenceArs),
    differenceNote: r.differenceNote,
  }));
}

export type TransferRow = {
  id: string;
  occurredAt: Date;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amountMinor: number;
  note: string | null;
  createdByUserId: number | null;
};

/** El historial de pases entre cuentas del workspace, más reciente primero. */
export async function listTransfers(
  workspaceId: string,
  opts: { take?: number } = {},
): Promise<TransferRow[]> {
  const rows = await prisma.cashTransfer.findMany({
    where: { workspaceId },
    select: {
      id: true,
      occurredAt: true,
      amountArs: true,
      note: true,
      createdByUserId: true,
      fromAccountId: true,
      fromAccount: { select: { name: true } },
      toAccountId: true,
      toAccount: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: opts.take ?? 200,
  });
  return rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt,
    fromAccountId: r.fromAccountId,
    fromAccountName: r.fromAccount.name,
    toAccountId: r.toAccountId,
    toAccountName: r.toAccount.name,
    amountMinor: decimalArsToMinor(r.amountArs),
    note: r.note,
    createdByUserId: r.createdByUserId,
  }));
}

export type ReportMovementRow = {
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  /** Es una pata de un pase entre cuentas. Se lo pasa tal cual a `lib/cash/balance.ts`. */
  isTransfer: boolean;
  categoryId: string | null;
  categoryName: string | null;
  clientId: string | null;
  clientName: string | null;
};

export type ReportFilters = { from: Date; to: Date; accountId?: string };

/**
 * Los movimientos crudos que alimentan el reporte del período: `lib/cash/balance.ts` hace
 * las cuentas, esto sólo los trae con la forma que esas funciones necesitan.
 *
 * Sin `take`, a propósito: `listMovements` corta en 200 porque es para una tabla que se mira
 * en pantalla, pero un total del mes que se queda a mitad de camino no suma menos plata, dice
 * una cifra falsa. Un reporte de período no puede permitirse eso.
 */
export async function movementsForReport(
  workspaceId: string,
  filtros: ReportFilters,
): Promise<ReportMovementRow[]> {
  const rows = await prisma.cashMovement.findMany({
    where: {
      workspaceId,
      occurredAt: { gte: filtros.from, lte: filtros.to },
      ...(filtros.accountId ? { accountId: filtros.accountId } : {}),
    },
    select: {
      kind: true,
      amountArs: true,
      transferId: true,
      categoryId: true,
      category: { select: { name: true } },
      clientId: true,
      client: { select: { kind: true, firstName: true, lastName: true, businessName: true } },
    },
  });
  return rows.map((r) => ({
    kind: r.kind as "INGRESO" | "EGRESO",
    amountMinor: decimalArsToMinor(r.amountArs),
    isTransfer: r.transferId !== null,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    clientId: r.clientId,
    clientName: r.client ? clientDisplayName(r.client) : null,
  }));
}

export type AccountBalanceMovementRow = { accountId: string; kind: "INGRESO" | "EGRESO"; amountMinor: number };

/**
 * Los movimientos crudos para el saldo de cada cuenta: todo el historial, sin filtro de
 * fecha —un saldo es una foto de hoy, no de un período— y sólo las tres columnas que
 * `balancesByAccountMinor` (`lib/cash/balance.ts`) necesita para sumar. Antes esta consulta
 * vivía suelta en `/caja/reportes`; ahora también la usa el panorama de `/caja`, así que
 * quedó acá para no repetirla ni desincronizarla.
 */
export async function movementsForBalance(workspaceId: string): Promise<AccountBalanceMovementRow[]> {
  const rows = await prisma.cashMovement.findMany({
    where: { workspaceId },
    select: { accountId: true, kind: true, amountArs: true },
  });
  return rows.map((r) => ({
    accountId: r.accountId,
    kind: r.kind as "INGRESO" | "EGRESO",
    amountMinor: decimalArsToMinor(r.amountArs),
  }));
}

/**
 * Nombre para mostrar de cada usuario, a partir de su id.
 *
 * Quién abrió y quién cerró un turno —o quién hizo un pase— se guarda como un id suelto
 * (`lib/cash` no tiene relación con `User` en el esquema), así que las pantallas de
 * historial arman este mapa una vez y lo consultan por id en vez de resolver de a uno.
 */
export async function userDisplayNames(ids: readonly (number | null)[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids.filter((id): id is number => id !== null))];
  if (unicos.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: unicos } },
    select: { id: true, name: true, email: true },
  });
  return new Map(rows.map((r) => [r.id, r.name?.trim() || r.email]));
}
