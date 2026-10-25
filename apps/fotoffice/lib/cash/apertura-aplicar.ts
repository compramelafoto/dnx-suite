import "server-only";
import type { PrismaClient } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { openingBalancesByAccount } from "@/lib/cash/repository";
import { OPENING_BALANCE_MODULE, openingBalanceDescription } from "@/lib/cash/opening-balance";
import { canAddOpeningBalance } from "@/lib/cash/opening-balance-rules";
import { buildReversal } from "@/lib/cash/reverse";
import type { AperturaExistente, CuentaExistente, PasoApertura } from "./apertura";

/** El motivo que queda escrito en la anulación cuando el comando reemplaza un saldo inicial. */
export const MOTIVO_REEMPLAZO = "Saldo inicial reemplazado desde el archivo de apertura.";

/**
 * Lo que el plan necesita saber de la base: las cuentas y el saldo inicial vigente de cada una (el
 * mismo que ve Caja → Configuración). Sólo lee.
 */
export async function leerEstadoApertura(db: PrismaClient, workspaceId: string): Promise<{ cuentas: CuentaExistente[]; aperturas: AperturaExistente[] }> {
  const [cuentas, vigentes] = await Promise.all([
    db.cashAccount.findMany({ where: { workspaceId }, select: { id: true, name: true, kind: true, isVault: true, isActive: true } }),
    openingBalancesByAccount(workspaceId, db),
  ]);
  return {
    cuentas,
    aperturas: [...vigentes].map(([accountId, v]) => ({ accountId, movementId: v.movementId, centavos: v.amountMinor })),
  };
}

/**
 * Aplica el plan en una transacción: crea las cuentas que faltan y carga los saldos iniciales igual
 * que la pantalla de Configuración (sin turno, sin categoría, `sourceModule = "saldo-inicial"`).
 * Reemplazar = anular el vigente con su contramovimiento (`buildReversal`, que conserva el origen
 * para que los informes también lo salteen) y cargar el nuevo. Nunca se edita un importe.
 */
export async function aplicarApertura(
  db: PrismaClient,
  entrada: { workspaceId: string; pasos: readonly PasoApertura[]; ocurrido: Date; userId: number | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const creadas = new Map<string, { id: string; kind: string }>();
    const ultima = await tx.cashAccount.findFirst({ where: { workspaceId: entrada.workspaceId }, orderBy: { order: "desc" }, select: { order: true } });
    let orden = (ultima?.order ?? 0) + 10;

    async function cuentaDe(nombre: string, cuentaId: string | null): Promise<{ id: string; kind: string }> {
      if (cuentaId === null) {
        const nueva = creadas.get(nombre);
        if (!nueva) throw new Error(`No se encontró la cuenta ${nombre}.`);
        return nueva;
      }
      const c = await tx.cashAccount.findFirst({ where: { id: cuentaId, workspaceId: entrada.workspaceId }, select: { id: true, kind: true } });
      if (!c) throw new Error(`No se encontró la cuenta ${nombre}.`);
      return c;
    }

    async function cargarSaldo(cuenta: { id: string; kind: string }, centavos: number): Promise<void> {
      await tx.cashMovement.create({
        data: {
          workspaceId: entrada.workspaceId,
          accountId: cuenta.id,
          shiftId: null,
          kind: "INGRESO",
          amountArs: minorToDecimalString(centavos),
          occurredAt: entrada.ocurrido,
          categoryId: null,
          paymentMethod: cuenta.kind === "EFECTIVO" ? "EFECTIVO" : "OTRO",
          description: openingBalanceDescription(null),
          sourceModule: OPENING_BALANCE_MODULE,
          sourceRef: null,
          createdByUserId: entrada.userId,
        },
      });
    }

    for (const p of entrada.pasos) {
      if (p.tipo === "crear-cuenta") {
        const c = await tx.cashAccount.create({
          data: { workspaceId: entrada.workspaceId, name: p.cuenta, kind: p.kind, isVault: p.isVault, isDefault: false, order: orden },
          select: { id: true, kind: true },
        });
        orden += 10;
        creadas.set(p.cuenta, c);
      } else if (p.tipo === "registrar-saldo") {
        const cuenta = await cuentaDe(p.cuenta, p.cuentaId);
        // La misma regla que la pantalla, releída dentro de la transacción: si alguien lo cargó a mano
        // mientras tanto, no queda duplicado.
        const vigentes = await openingBalancesByAccount(entrada.workspaceId, tx);
        const regla = canAddOpeningBalance(vigentes.get(cuenta.id));
        if (!regla.ok) throw new Error(`${p.cuenta}: ${regla.error}`);
        await cargarSaldo(cuenta, p.centavos);
      } else if (p.tipo === "reemplazar-saldo") {
        const cuenta = await cuentaDe(p.cuenta, p.cuentaId);
        const original = await tx.cashMovement.findFirst({
          where: { id: p.movimientoId, workspaceId: entrada.workspaceId, accountId: cuenta.id, sourceModule: OPENING_BALANCE_MODULE },
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
            sourceModule: true,
            reversedBy: { select: { id: true } },
          },
        });
        if (!original) throw new Error(`${p.cuenta}: el saldo inicial a reemplazar ya no está.`);
        const anulacion = buildReversal(
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
            sourceModule: original.sourceModule,
          },
          MOTIVO_REEMPLAZO,
        );
        if (!anulacion.ok) throw new Error(`${p.cuenta}: ${anulacion.error}`);
        const v = anulacion.values;
        // Sin turno, como la anulación desde Movimientos: el saldo inicial nunca entró a un arqueo.
        await tx.cashMovement.create({
          data: {
            workspaceId: entrada.workspaceId,
            accountId: v.accountId,
            shiftId: null,
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
            createdByUserId: entrada.userId,
          },
        });
        if (p.aCentavos > 0) await cargarSaldo(cuenta, p.aCentavos);
      }
    }
  });
}
