"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { requireCashOperator } from "@/lib/cash/access";
import { expectedAmountMinor } from "@/lib/cash/shift";
import { accountBalanceMinor } from "@/lib/cash/balance";
import { createCashTransfer } from "@/lib/cash/transfer";
import { leerConteo, planearCierreConContador, resumenArqueo, sumarConteo } from "@/lib/cash/contador-billetes";
import { esTablaInexistente } from "@/lib/cash/conteos";

export type EstadoContador = { error: string | null };

class ErrorDeCierre extends Error {}

/**
 * Confirmar un conteo de billetes.
 *
 * Hace, en una sola transacción, lo que el cierre del mostrador hacía en dos pantallas:
 * 1. Si la cuenta tiene un turno abierto, lo cierra con lo contado (mismo arqueo que
 *    `closeShiftAction`: esperado y diferencia congelados).
 * 2. Si se pidió, asienta la diferencia (sobrante = ingreso, faltante = egreso) para que el
 *    libro diga lo que de verdad hay.
 * 3. Si se pidió y existe la caja fuerte, hace el pase de "contado − cambio" con
 *    `createCashTransfer`, el mismo de la pantalla de Pases.
 * Después guarda la foto del conteo (`CashCount`). Esa escritura va APARTE y tolera que la
 * tabla todavía no exista: la migración se aplica a mano, y un cierre de caja no puede
 * quedar trabado por la foto de auditoría.
 *
 * El total se vuelve a sumar acá con las cantidades: lo que la pantalla muestra no se cree.
 * Los errores vuelven como estado (no redirect) para que no se pierda lo que se contó.
 */
export async function cerrarConContadorAction(_prev: EstadoContador, formData: FormData): Promise<EstadoContador> {
  const { workspace, user } = await requireCashOperator();
  const accountId = String(formData.get("accountId") ?? "").trim();
  const conteo = leerConteo(String(formData.get("cantidades") ?? "{}"));
  const total = sumarConteo(conteo);
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const registrarAjuste = formData.get("registrarAjuste") === "on";
  const pasarACajaFuerte = formData.get("pasarACajaFuerte") === "on";

  const cuenta = await prisma.cashAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id, isActive: true },
    select: { id: true, kind: true, isVault: true },
  });
  if (!cuenta || cuenta.kind !== "EFECTIVO") {
    return { error: "Sólo se cuentan billetes en una caja de efectivo." };
  }

  // En la caja fuerte no se deja "cambio": todo lo contado se queda donde está.
  const cambioCrudo = String(formData.get("cambio") ?? "").trim();
  const cambioLeido = cambioCrudo === "" ? 0 : parseArsToMinor(cambioCrudo);
  if (cambioLeido === null) return { error: "El cambio que queda en el mostrador no se entiende." };
  const cambioMinor = cuenta.isVault ? total.totalMinor : cambioLeido;

  const [turno, movimientosCuenta, cajaFuerte] = await Promise.all([
    prisma.cashShift.findFirst({
      where: { workspaceId: workspace.id, accountId, status: "ABIERTO" },
      select: { id: true, openingAmountArs: true },
    }),
    prisma.cashMovement.findMany({
      where: { workspaceId: workspace.id, accountId },
      select: { kind: true, amountArs: true, shiftId: true },
    }),
    cuenta.isVault
      ? Promise.resolve(null)
      : prisma.cashAccount.findFirst({
          where: { workspaceId: workspace.id, isVault: true, isActive: true, kind: "EFECTIVO", id: { not: accountId } },
          orderBy: { order: "asc" },
          select: { id: true, name: true },
        }),
  ]);

  const movimientos = movimientosCuenta.map((m) => ({
    kind: m.kind as "INGRESO" | "EGRESO",
    amountMinor: decimalArsToMinor(m.amountArs),
    shiftId: m.shiftId,
  }));
  const saldoCuentaMinor = accountBalanceMinor(movimientos);
  const esperadoMinor = turno
    ? expectedAmountMinor({
        openingMinor: decimalArsToMinor(turno.openingAmountArs),
        movements: movimientos.filter((m) => m.shiftId === turno.id),
      })
    : saldoCuentaMinor;

  const plan = planearCierreConContador({
    contadoMinor: total.totalMinor,
    esperadoMinor,
    cambioMinor,
    nota,
    registrarAjuste,
    pasarACajaFuerte,
    hayCajaFuerte: cajaFuerte !== null,
    saldoCuentaMinor,
  });
  if (!plan.ok) return { error: plan.error };

  const resumen = resumenArqueo({ contadoMinor: total.totalMinor, esperadoMinor, cambioMinor });
  const diferenciaMinor = resumen.diferenciaMinor ?? 0;
  const ahora = new Date();

  let resultado: { transferId: string | null; ajusteId: string | null };
  try {
    resultado = await prisma.$transaction(async (tx) => {
      if (turno) {
        // `updateMany` con el estado en el `where`: si dos personas confirman a la vez, o se
        // aprieta dos veces, el segundo no vuelve a cerrar ni a pasar plata.
        const cerrado = await tx.cashShift.updateMany({
          where: { id: turno.id, workspaceId: workspace.id, status: "ABIERTO" },
          data: {
            status: "CERRADO",
            closedAt: ahora,
            closedByUserId: user.id,
            countedAmountArs: minorToDecimalString(total.totalMinor),
            expectedAmountArs: minorToDecimalString(esperadoMinor),
            differenceArs: minorToDecimalString(diferenciaMinor),
            differenceNote: nota,
          },
        });
        if (cerrado.count === 0) throw new ErrorDeCierre("Ese turno ya se cerró. Recargá la pantalla.");
      }

      let ajusteId: string | null = null;
      if (plan.ajuste) {
        const etiqueta = plan.ajuste.kind === "INGRESO" ? "Sobrante de arqueo" : "Faltante de arqueo";
        const mov = await tx.cashMovement.create({
          data: {
            workspaceId: workspace.id,
            accountId,
            shiftId: turno?.id ?? null,
            kind: plan.ajuste.kind,
            amountArs: minorToDecimalString(plan.ajuste.amountMinor),
            occurredAt: ahora,
            categoryId: null,
            paymentMethod: "EFECTIVO",
            description: nota ? `${etiqueta}: ${nota}` : etiqueta,
            sourceModule: "manual",
            createdByUserId: user.id,
          },
          select: { id: true },
        });
        ajusteId = mov.id;
      }

      let transferId: string | null = null;
      if (plan.paseMinor !== null && cajaFuerte) {
        const pase = await createCashTransfer(tx, {
          workspaceId: workspace.id,
          fromAccountId: accountId,
          toAccountId: cajaFuerte.id,
          amountMinor: plan.paseMinor,
          occurredAt: ahora,
          note: turno ? "Pase de cierre de turno (contador de billetes)" : "Pase de arqueo (contador de billetes)",
          fromShiftId: turno?.id ?? null,
          createdByUserId: user.id,
        });
        transferId = pase.transferId;
      }

      return { transferId, ajusteId };
    });
  } catch (e) {
    if (e instanceof ErrorDeCierre) return { error: e.message };
    throw e;
  }

  let conteoId: string | null = null;
  let aviso: string | null = null;
  try {
    const foto = await prisma.cashCount.create({
      data: {
        workspaceId: workspace.id,
        accountId,
        shiftId: turno?.id ?? null,
        denominations: total.lineas,
        countedAmountArs: minorToDecimalString(total.totalMinor),
        expectedAmountArs: minorToDecimalString(esperadoMinor),
        differenceArs: minorToDecimalString(diferenciaMinor),
        floatAmountArs: minorToDecimalString(cuenta.isVault ? total.totalMinor : cambioMinor),
        toVaultAmountArs: minorToDecimalString(cuenta.isVault ? 0 : resumen.aCajaFuerteMinor),
        note: nota,
        transferId: resultado.transferId,
        adjustmentMovementId: resultado.ajusteId,
        createdByUserId: user.id,
      },
      select: { id: true },
    });
    conteoId = foto.id;
  } catch (e) {
    if (!esTablaInexistente(e)) throw e;
    aviso = "El cierre quedó hecho, pero el detalle por billete no se guardó todavía (falta aplicar la migración del contador).";
  }

  revalidatePath("/caja");
  revalidatePath("/caja/turnos");
  revalidatePath("/caja/pases");
  revalidatePath("/caja/movimientos");

  const params = new URLSearchParams({
    hecho: turno ? "turno" : "arqueo",
    contado: String(total.totalMinor),
    pase: String(plan.paseMinor ?? 0),
    dif: String(diferenciaMinor),
  });
  if (conteoId) params.set("conteo", conteoId);
  if (aviso) params.set("aviso", aviso);
  redirect(`/caja/arqueo/${encodeURIComponent(accountId)}?${params.toString()}`);
}
