import "server-only";
import type { PrismaClient } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { SOURCE_APERTURA, type AperturaExistente, type CuentaExistente, type PasoApertura } from "./apertura";

/** Lo que el plan necesita saber de la base: cuentas y aperturas ya registradas. Sólo lee. */
export async function leerEstadoApertura(db: PrismaClient, workspaceId: string): Promise<{ cuentas: CuentaExistente[]; aperturas: AperturaExistente[] }> {
  const [cuentas, movs] = await Promise.all([
    db.cashAccount.findMany({ where: { workspaceId }, select: { id: true, name: true, kind: true, isVault: true, isActive: true } }),
    db.cashMovement.findMany({ where: { workspaceId, sourceModule: SOURCE_APERTURA }, select: { id: true, accountId: true, amountArs: true } }),
  ]);
  return { cuentas, aperturas: movs.map((m) => ({ accountId: m.accountId, movementId: m.id, centavos: decimalArsToMinor(m.amountArs) })) };
}

/**
 * Aplica el plan en una transacción: crea las cuentas que faltan, registra o corrige los saldos.
 * Sin turno (no es un cobro del mostrador) y sin categoría (no es un ingreso del negocio).
 */
export async function aplicarApertura(
  db: PrismaClient,
  entrada: { workspaceId: string; pasos: readonly PasoApertura[]; ocurrido: Date; userId: number | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const creadas = new Map<string, string>();
    const ultima = await tx.cashAccount.findFirst({ where: { workspaceId: entrada.workspaceId }, orderBy: { order: "desc" }, select: { order: true } });
    let orden = (ultima?.order ?? 0) + 10;
    for (const p of entrada.pasos) {
      if (p.tipo === "crear-cuenta") {
        const c = await tx.cashAccount.create({
          data: { workspaceId: entrada.workspaceId, name: p.cuenta, kind: p.kind, isVault: p.isVault, isDefault: false, order: orden },
          select: { id: true },
        });
        orden += 10;
        creadas.set(p.cuenta, c.id);
      } else if (p.tipo === "registrar-saldo") {
        const accountId = p.cuentaId ?? creadas.get(p.cuenta);
        if (!accountId) throw new Error(`No se encontró la cuenta ${p.cuenta}.`);
        await tx.cashMovement.create({
          data: {
            workspaceId: entrada.workspaceId,
            accountId,
            shiftId: null,
            kind: "INGRESO",
            amountArs: minorToDecimalString(p.centavos),
            occurredAt: entrada.ocurrido,
            categoryId: null,
            paymentMethod: "OTRO",
            description: "Saldo de apertura",
            sourceModule: SOURCE_APERTURA,
            sourceRef: accountId,
            createdByUserId: entrada.userId,
          },
        });
      } else if (p.tipo === "corregir-saldo") {
        // Corregir la apertura antes de operar: es un dato de arranque, no un movimiento del negocio.
        await tx.cashMovement.update({
          where: { id: p.movimientoId, workspaceId: entrada.workspaceId, sourceModule: SOURCE_APERTURA },
          data: { amountArs: minorToDecimalString(p.aCentavos), occurredAt: entrada.ocurrido },
        });
      }
    }
  });
}
