import "server-only";
import { Prisma, type PrismaClient } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import type { MovementSource } from "./constants";

/**
 * Depositar en Caja un cobro que originó otro módulo.
 *
 * Es idempotente por construcción: `(sourceModule, sourceRef)` es único en la base, así que
 * un webhook de Mercado Pago que llega dos veces —que es lo normal— deposita una sola vez.
 * El segundo intento choca con P2002 y devuelve el movimiento que ya estaba.
 *
 * Recibe la transacción de quien llama: el cobro y su asiento tienen que nacer juntos o no
 * nacer. Un pago registrado sin su movimiento de caja deja el libro mintiendo.
 *
 * Si el módulo de Caja no está habilitado para ese workspace, esto no debe llamarse. Lo
 * verifica quien llama, no esta función: acá no hay a quién redirigir.
 *
 * Resuelve solo el turno abierto de la cuenta de destino. Ver el comentario de adentro: es
 * lo que evita que una cuota cobrada en efectivo quede fuera del arqueo.
 */
export type RecordMovementInput = {
  workspaceId: string;
  accountId: string;
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  occurredAt: Date;
  description: string;
  sourceModule: Exclude<MovementSource, "manual">;
  sourceRef: string;
  categoryId?: string | null;
  clientId?: string | null;
  paymentMethod?: string;
  shiftId?: string | null;
  createdByUserId?: number | null;
};

export async function recordCashMovement(
  tx: Prisma.TransactionClient | PrismaClient,
  input: RecordMovementInput,
): Promise<{ id: string; created: boolean }> {
  // Guarda de positividad: esta función es la costura por la que van a entrar Cuotas,
  // Reservas, Ventas y Órdenes de trabajo (Tarea 12 en adelante), y no hay `CHECK > 0` en la
  // base que la respalde (`amountArs` es un `Decimal` cualquiera). Si algún llamador futuro
  // manda un cero o un negativo, tiene que enterarse ahí mismo —lanzando, no devolviendo un
  // valor cualquiera—, porque está adentro de una transacción y un movimiento en cero o
  // negativo ensucia el libro en silencio: nadie audita un asiento que "no rompió nada".
  if (input.amountMinor <= 0) {
    throw new Error(
      `recordCashMovement: el importe tiene que ser mayor que cero (recibido: ${input.amountMinor}).`,
    );
  }

  // El turno abierto de esa cuenta, cuando quien llama no lo pasó.
  //
  // Va acá adentro y no en cada llamador a propósito. Una cuota cobrada en efectivo que se
  // deposita SIN turno no entra en el arqueo, y entonces la caja da sobrante todos los días
  // que alguien pague en mano. Es un error silencioso —nadie investiga un sobrante— y
  // pedirle a cada módulo que se acuerde de buscar el turno garantiza que alguno se olvide.
  //
  // Las cuentas digitales no llevan turno, así que la consulta no devuelve nada y el
  // movimiento queda suelto, que es lo correcto para un cobro por Mercado Pago.
  let shiftId = input.shiftId ?? null;
  if (shiftId === null) {
    // `workspaceId` va en el `where` aunque `accountId` ya ata unívocamente a un solo
    // workspace por FK (no es explotable sin él): la Restricción Global no admite
    // excepciones sin explicación, y una consulta que se salta esa regla es la que el
    // próximo módulo copia y pega sin volver a pensarlo.
    const abierto = await tx.cashShift.findFirst({
      where: { workspaceId: input.workspaceId, accountId: input.accountId, status: "ABIERTO" },
      select: { id: true },
    });
    shiftId = abierto?.id ?? null;
  }

  try {
    const creado = await tx.cashMovement.create({
      data: {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        shiftId,
        kind: input.kind,
        amountArs: minorToDecimalString(input.amountMinor),
        occurredAt: input.occurredAt,
        categoryId: input.categoryId ?? null,
        paymentMethod: input.paymentMethod ?? "EFECTIVO",
        clientId: input.clientId ?? null,
        description: input.description,
        sourceModule: input.sourceModule,
        sourceRef: input.sourceRef,
        createdByUserId: input.createdByUserId ?? null,
      },
      select: { id: true },
    });
    return { id: creado.id, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const yaEstaba = await tx.cashMovement.findFirst({
        where: { sourceModule: input.sourceModule, sourceRef: input.sourceRef },
        select: { id: true },
      });
      if (yaEstaba) return { id: yaEstaba.id, created: false };
    }
    throw e;
  }
}
