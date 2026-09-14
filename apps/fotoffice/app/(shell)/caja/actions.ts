"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { requireCashAdmin, requireCashStaff } from "@/lib/cash/access";
import {
  canCloseShift,
  canOpenShift,
  expectedAmountMinor,
  parseOpeningAmountMinor,
  shiftDifferenceMinor,
} from "@/lib/cash/shift";
import { parseMovementForm } from "@/lib/cash/movement-form";
import { buildReversal } from "@/lib/cash/reverse";
import { accountBalanceMinor } from "@/lib/cash/balance";
import { createCashTransfer, validateTransfer } from "@/lib/cash/transfer";
import { parseAccountForm } from "@/lib/cash/account-form";
import { parseCategoryForm } from "@/lib/cash/category-form";
import { seedRowsFor } from "@/lib/cash/seed";
import { sanitizeReturnTo } from "@/lib/cash/return-to";

const CAJA = "/caja";
const MOVIMIENTOS = "/caja/movimientos";
const TURNOS = "/caja/turnos";
const PASES = "/caja/pases";
const CONFIGURACION = "/caja/configuracion";

/**
 * Abrir el turno.
 *
 * La verificación de "ya hay uno abierto" se hace dos veces a propósito: acá, para dar un
 * mensaje que se entienda, y en la base con el índice único parcial, que es el que de verdad
 * impide que dos personas abriendo a la vez dejen dos turnos abiertos.
 */
export async function openShiftAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();
  const accountId = String(formData.get("accountId") ?? "").trim();

  const apertura = parseOpeningAmountMinor(String(formData.get("openingAmountArs") ?? ""));
  if (!apertura.ok) redirect(`/caja?error=${encodeURIComponent(apertura.error)}`);
  const openingMinor = apertura.value;

  const cuenta = await prisma.cashAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id },
    select: { kind: true, isVault: true },
  });
  if (!cuenta) redirect(`/caja?error=${encodeURIComponent("Esa cuenta no existe.")}`);

  const abierto = await prisma.cashShift.count({ where: { accountId, status: "ABIERTO" } });
  const permiso = canOpenShift({
    accountKind: cuenta.kind,
    isVault: cuenta.isVault,
    openShiftExists: abierto > 0,
  });
  if (!permiso.ok) redirect(`/caja?error=${encodeURIComponent(permiso.error)}`);

  try {
    await prisma.cashShift.create({
      data: {
        workspaceId: workspace.id,
        accountId,
        openingAmountArs: minorToDecimalString(openingMinor),
        openedByUserId: user.id,
        status: "ABIERTO",
      },
    });
  } catch (e) {
    // El índice único parcial: otra persona abrió en el mismo instante.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`/caja?error=${encodeURIComponent("Esa caja ya tiene un turno abierto.")}`);
    }
    throw e;
  }

  revalidatePath("/caja");
  redirect("/caja?ok=1");
}

/**
 * Cerrar el turno contando.
 *
 * Lo esperado y la diferencia se calculan una sola vez, acá, y se guardan. No se recalculan
 * al leer: el arqueo de hace dos años tiene que seguir diciendo lo mismo aunque después se
 * anule un movimiento de ese día.
 */
export async function closeShiftAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const countedMinor = parseArsToMinor(String(formData.get("countedAmountArs") ?? ""));
  const note = String(formData.get("differenceNote") ?? "").trim() || null;

  if (countedMinor === null) {
    redirect(`/caja?error=${encodeURIComponent("Escribí cuánto contaste.")}`);
  }

  const turno = await prisma.cashShift.findFirst({
    where: { id: shiftId, workspaceId: workspace.id },
    select: { status: true, openingAmountArs: true },
  });
  if (!turno) redirect(`/caja?error=${encodeURIComponent("Ese turno no existe.")}`);

  const movimientos = await prisma.cashMovement.findMany({
    where: { shiftId },
    select: { kind: true, amountArs: true },
  });

  const expectedMinor = expectedAmountMinor({
    openingMinor: decimalArsToMinor(turno.openingAmountArs),
    movements: movimientos.map((m) => ({
      kind: m.kind as "INGRESO" | "EGRESO",
      amountMinor: decimalArsToMinor(m.amountArs),
    })),
  });
  const differenceMinor = shiftDifferenceMinor(expectedMinor, countedMinor);

  const permiso = canCloseShift({ status: turno.status, differenceMinor, note });
  if (!permiso.ok) redirect(`/caja?error=${encodeURIComponent(permiso.error)}`);

  await prisma.cashShift.update({
    where: { id: shiftId },
    data: {
      status: "CERRADO",
      closedAt: new Date(),
      closedByUserId: user.id,
      countedAmountArs: minorToDecimalString(countedMinor),
      expectedAmountArs: minorToDecimalString(expectedMinor),
      differenceArs: minorToDecimalString(differenceMinor),
      differenceNote: note,
    },
  });

  revalidatePath("/caja");
  // El `shiftId` viaja en la URL a propósito: la propuesta de pase en `/caja/turnos` tiene
  // que atarse a ESTE turno, no adivinarlo por "el arqueo cerrado más reciente" — con dos
  // cajas cerrando casi al mismo tiempo, lo más reciente por fecha podría ser el de otra
  // cuenta, y se ofrecería pasar el importe equivocado.
  redirect(`/caja/turnos?ok=1&shiftId=${encodeURIComponent(shiftId)}`);
}

/**
 * Cargar un movimiento manual.
 *
 * El turno no lo elige quien carga: se busca solo, el que esté abierto para la cuenta
 * elegida. Una cuenta digital o sin turno abierto simplemente no le asigna ninguno, y el
 * movimiento queda igual de válido — es una cuenta que no se arquea.
 *
 * `returnTo` es opcional a propósito, con `/caja` como destino por omisión: el panorama y
 * `/caja/movimientos` mandan el suyo propio para no perder de vista el asiento recién
 * cargado saltando a otra pantalla. Mismo tratamiento que `transferAction`: ver el porqué en
 * `lib/cash/return-to.ts`.
 */
export async function createMovementAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();

  const volver = sanitizeReturnTo(String(formData.get("returnTo") ?? ""), CAJA);

  const parsed = parseMovementForm(formData);
  if (!parsed.ok) redirect(`${volver}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  const cuenta = await prisma.cashAccount.count({
    where: { id: v.accountId, workspaceId: workspace.id },
  });
  if (cuenta === 0) redirect(`${volver}?error=${encodeURIComponent("Esa cuenta no existe.")}`);

  if (v.categoryId) {
    // La categoría es de un solo lado: se verifica también que sea del mismo `kind` que el
    // movimiento, no sólo del workspace.
    const categoria = await prisma.cashCategory.count({
      where: { id: v.categoryId, workspaceId: workspace.id, kind: v.kind },
    });
    if (categoria === 0) {
      redirect(`${volver}?error=${encodeURIComponent("Esa categoría no existe para ese tipo de movimiento.")}`);
    }
  }

  if (v.clientId) {
    const cliente = await prisma.client.count({ where: { id: v.clientId, workspaceId: workspace.id } });
    if (cliente === 0) redirect(`${volver}?error=${encodeURIComponent("Ese cliente no existe.")}`);
  }

  const turno = await prisma.cashShift.findFirst({
    where: { workspaceId: workspace.id, accountId: v.accountId, status: "ABIERTO" },
    select: { id: true },
  });

  await prisma.cashMovement.create({
    data: {
      workspaceId: workspace.id,
      accountId: v.accountId,
      shiftId: turno?.id ?? null,
      kind: v.kind,
      amountArs: minorToDecimalString(v.amountMinor),
      occurredAt: v.occurredAt,
      categoryId: v.categoryId,
      paymentMethod: v.paymentMethod,
      clientId: v.clientId,
      description: v.description,
      receiptRef: v.receiptRef,
      sourceModule: "manual",
      createdByUserId: user.id,
    },
  });

  revalidatePath(CAJA);
  revalidatePath(MOVIMIENTOS);
  redirect(`${volver}?ok=1`);
}

/**
 * Anular un movimiento.
 *
 * No se borra ni se edita —tampoco los manuales—: se escribe el contramovimiento que arma
 * `buildReversal` y los dos quedan a la vista. El original se lee con `select` explícito
 * porque el libro completo no viaja: sólo lo que la anulación necesita.
 */
export async function reverseMovementAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();
  const movementId = String(formData.get("movementId") ?? "").trim();
  const reason = String(formData.get("reverseReason") ?? "");

  const original = await prisma.cashMovement.findFirst({
    where: { id: movementId, workspaceId: workspace.id },
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
  if (!original) redirect(`${MOVIMIENTOS}?error=${encodeURIComponent("Ese movimiento no existe.")}`);

  const resultado = buildReversal(
    {
      id: original.id,
      kind: original.kind as "INGRESO" | "EGRESO",
      amountMinor: decimalArsToMinor(original.amountArs),
      accountId: original.accountId,
      categoryId: original.categoryId,
      paymentMethod: original.paymentMethod,
      clientId: original.clientId,
      description: original.description,
      alreadyReversed: original.reversedBy !== null,
      transferId: original.transferId,
    },
    reason,
  );
  if (!resultado.ok) redirect(`${MOVIMIENTOS}?error=${encodeURIComponent(resultado.error)}`);
  const v = resultado.values;

  await prisma.$transaction(async (tx) => {
    // Si la anulación pasa con el turno todavía abierto, el contramovimiento entra en su
    // arqueo igual que cualquier otro: no hay motivo para que quede afuera.
    const turno = await tx.cashShift.findFirst({
      where: { workspaceId: workspace.id, accountId: v.accountId, status: "ABIERTO" },
      select: { id: true },
    });
    await tx.cashMovement.create({
      data: {
        workspaceId: workspace.id,
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
        createdByUserId: user.id,
      },
    });
  });

  revalidatePath(CAJA);
  revalidatePath(MOVIMIENTOS);
  redirect(`${MOVIMIENTOS}?ok=1`);
}

/**
 * Pasar plata de una cuenta a otra.
 *
 * Se usa desde dos lugares: el pase que la pantalla de Arqueos propone al cerrar el turno, y
 * el pase suelto que se carga desde Pases. `returnTo` decide adónde volver sin duplicar esta
 * acción.
 */
export async function transferAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();
  const fromAccountId = String(formData.get("fromAccountId") ?? "").trim();
  const toAccountId = String(formData.get("toAccountId") ?? "").trim();
  const amountMinor = parseArsToMinor(String(formData.get("amountArs") ?? ""));
  const note = String(formData.get("note") ?? "").trim() || null;
  const fromShiftId = String(formData.get("fromShiftId") ?? "").trim() || null;
  // `returnTo` viaja en un campo oculto del propio formulario, pero no se usa tal cual para
  // no dejar una redirección abierta: `sanitizeReturnTo` exige que sea una ruta interna y si
  // no, cae a `/caja/pases`. Ver el porqué completo en `lib/cash/return-to.ts`.
  const volver = sanitizeReturnTo(String(formData.get("returnTo") ?? ""), PASES);

  if (amountMinor === null) redirect(`${volver}?error=${encodeURIComponent("El importe no se entiende.")}`);

  const cuentas = await prisma.cashAccount.findMany({
    where: { workspaceId: workspace.id, id: { in: [fromAccountId, toAccountId] } },
    select: { id: true },
  });
  if (cuentas.length !== 2) {
    redirect(`${volver}?error=${encodeURIComponent("Alguna de las dos cuentas no existe.")}`);
  }

  if (fromShiftId) {
    const propio = await prisma.cashShift.count({ where: { id: fromShiftId, workspaceId: workspace.id } });
    if (propio === 0) redirect(`${volver}?error=${encodeURIComponent("Ese turno no existe.")}`);
  }

  const movimientosOrigen = await prisma.cashMovement.findMany({
    where: { workspaceId: workspace.id, accountId: fromAccountId },
    select: { kind: true, amountArs: true },
  });
  const fromBalanceMinor = accountBalanceMinor(
    movimientosOrigen.map((m) => ({
      kind: m.kind as "INGRESO" | "EGRESO",
      amountMinor: decimalArsToMinor(m.amountArs),
    })),
  );

  const permiso = validateTransfer({ fromAccountId, toAccountId, amountMinor, fromBalanceMinor });
  if (!permiso.ok) redirect(`${volver}?error=${encodeURIComponent(permiso.error)}`);

  await prisma.$transaction(async (tx) => {
    await createCashTransfer(tx, {
      workspaceId: workspace.id,
      fromAccountId,
      toAccountId,
      amountMinor,
      occurredAt: new Date(),
      note,
      fromShiftId,
      createdByUserId: user.id,
    });
  });

  revalidatePath(CAJA);
  revalidatePath(TURNOS);
  revalidatePath(PASES);
  redirect(`${volver}?ok=1`);
}

/**
 * Alta y edición de una cuenta de caja.
 *
 * `isVault` y el fondo fijo no pasan por `parseAccountForm`: son propios de esta pantalla,
 * no de la validación pura que ya prueba la Tarea 6, y sólo tienen sentido en una cuenta de
 * efectivo — en una digital quedan siempre en blanco.
 */
export async function saveAccountAction(formData: FormData): Promise<void> {
  const { workspace } = await requireCashAdmin();
  const accountId = String(formData.get("accountId") ?? "").trim() || null;

  const parsed = parseAccountForm(formData);
  if (!parsed.ok) redirect(`${CONFIGURACION}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  const isVault = v.kind === "EFECTIVO" && formData.get("isVault") === "on";
  const fixedFloatMinor =
    v.kind === "EFECTIVO" ? parseArsToMinor(String(formData.get("fixedFloatArs") ?? "")) : null;
  const fixedFloatArs = fixedFloatMinor === null ? null : minorToDecimalString(fixedFloatMinor);

  const datos = { ...v, isVault, fixedFloatArs };

  if (accountId) {
    const propia = await prisma.cashAccount.count({
      where: { id: accountId, workspaceId: workspace.id },
    });
    if (propia === 0) redirect(`${CONFIGURACION}?error=${encodeURIComponent("Esa cuenta no existe.")}`);
    await prisma.cashAccount.update({ where: { id: accountId }, data: datos });
  } else {
    try {
      await prisma.cashAccount.create({ data: { ...datos, workspaceId: workspace.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        redirect(`${CONFIGURACION}?error=${encodeURIComponent("Ya existe una cuenta con ese nombre.")}`);
      }
      throw e;
    }
  }

  revalidatePath(CONFIGURACION);
  redirect(`${CONFIGURACION}?ok=1`);
}

/** Alta y edición de una categoría. */
export async function saveCategoryAction(formData: FormData): Promise<void> {
  const { workspace } = await requireCashAdmin();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  const parsed = parseCategoryForm(formData);
  if (!parsed.ok) redirect(`${CONFIGURACION}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (categoryId) {
    const propia = await prisma.cashCategory.count({
      where: { id: categoryId, workspaceId: workspace.id },
    });
    if (propia === 0) redirect(`${CONFIGURACION}?error=${encodeURIComponent("Esa categoría no existe.")}`);
    await prisma.cashCategory.update({ where: { id: categoryId }, data: v });
  } else {
    try {
      await prisma.cashCategory.create({ data: { ...v, workspaceId: workspace.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        redirect(
          `${CONFIGURACION}?error=${encodeURIComponent("Ya existe una categoría con ese nombre para ese lado.")}`,
        );
      }
      throw e;
    }
  }

  revalidatePath(CONFIGURACION);
  redirect(`${CONFIGURACION}?ok=1`);
}

/**
 * Sembrar cuentas y categorías la primera vez.
 *
 * `skipDuplicates` hace que apretar el botón dos veces no rompa nada ni duplique filas: es
 * más barato que un estado "ya sembrado" que después hay que mantener.
 */
export async function enableCashForWorkspaceAction(): Promise<void> {
  const { workspace } = await requireCashAdmin();
  const { accounts, categories } = seedRowsFor(workspace.id);
  await prisma.$transaction([
    prisma.cashAccount.createMany({ data: accounts, skipDuplicates: true }),
    prisma.cashCategory.createMany({ data: categories, skipDuplicates: true }),
  ]);
  revalidatePath(CONFIGURACION);
  redirect(`${CONFIGURACION}?ok=1`);
}
