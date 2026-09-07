import "server-only";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "../money";
import { historicalMethod } from "../payment-method";
import type { ResolvedPayment } from "./parse";

/**
 * Escribe los pagos históricos.
 *
 * Tres cosas que este código deliberadamente **no** hace, y que conviene tener a la vista
 * antes de tocarlo:
 *
 * 1. **No crea socios.** Los `memberId` ya vienen resueltos contra el padrón de este
 *    workspace por el parser; acá se vuelve a verificar la pertenencia antes de escribir.
 * 2. **No imputa a ninguna cuota.** Sin `MembershipAllocation` y sin tocar `balanceArs`: la
 *    deuda del socio queda exactamente como está. Estos pagos son constancia de que el cobro
 *    existió, no un movimiento de cuenta.
 * 3. **No devenga comisión de plataforma.** `platformFeeArs` en cero. La plata nunca pasó
 *    por acá; cobrarle a la institución una comisión por un cobro de 2024 sería inventar una
 *    deuda.
 */

export type PaymentImportResult = {
  imported: number;
  /** Ya estaban: se reconocieron por su clave natural y no se duplicaron. */
  skipped: number;
};

export async function importHistoricalPayments(input: {
  workspaceId: string;
  payments: ResolvedPayment[];
}): Promise<PaymentImportResult> {
  if (input.payments.length === 0) return { imported: 0, skipped: 0 };

  // Los socios se vuelven a verificar contra la base, y contra ESTE workspace. El parser ya
  // lo hizo, pero entre la previsualización y la confirmación puede haber pasado cualquier
  // cosa, y un pago escrito en el socio de otra institución no se arregla después.
  const ids = [...new Set(input.payments.map((p) => p.memberId))];
  const validos = new Set(
    (
      await prisma.member.findMany({
        where: { id: { in: ids }, workspaceId: input.workspaceId },
        select: { id: true },
      })
    ).map((m) => m.id),
  );

  // Los que ya están se descartan ANTES de intentar escribirlos. Descubrirlos chocando
  // contra la clave única funciona, pero Prisma deja un error en el log por cada choque: en
  // la carga real de la SFPR eso fueron 224 errores registrados para 224 omisiones que son
  // el comportamiento esperado. Un log lleno de errores normales enseña a ignorarlo.
  const yaEstan = new Set(
    (
      await prisma.membershipPayment.findMany({
        where: {
          workspaceId: input.workspaceId,
          providerPaymentRef: { in: input.payments.map((p) => p.dedupKey) },
        },
        select: { providerPaymentRef: true },
      })
    ).map((p) => p.providerPaymentRef),
  );

  let imported = 0;
  let skipped = 0;

  for (const pago of input.payments) {
    if (!validos.has(pago.memberId) || yaEstan.has(pago.dedupKey)) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.membershipPayment.create({
        data: {
          workspaceId: input.workspaceId,
          memberId: pago.memberId,
          amountArs: minorToDecimalString(pago.amountMinor),
          // Ver el punto 3 del comentario de arriba.
          platformFeeArs: "0",
          netAmountArs: minorToDecimalString(pago.amountMinor),
          status: "ACREDITADO",
          method: historicalMethod(pago.method),
          // `providerPaymentRef` es único en la base: usarlo como clave natural del pago es
          // lo que hace que reimportar el mismo archivo no duplique nada.
          providerPaymentRef: pago.dedupKey,
          providerOrderRef: pago.referenceLabel,
          paidAt: pago.paidAt,
        },
      });
      imported += 1;
    } catch (e) {
      // Red de seguridad para la carrera: otra importación pudo escribirlo entre la consulta
      // de arriba y esta línea. No es un error de la operación —es lo que la clave única
      // viene a evitar— así que se cuenta y sigue.
      if (isUniqueViolation(e)) {
        skipped += 1;
        continue;
      }
      throw e;
    }
  }

  return { imported, skipped };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}
