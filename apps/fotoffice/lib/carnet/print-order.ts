import "server-only";
import { prisma } from "@repo/db";
import { getActiveFeeValue } from "@/lib/membership/settings";
import { minorToDecimalString } from "@/lib/membership/money";
import { decimalArsToMinor } from "@/lib/membership/money";
import { addMonthsUtc, CARNET_VALIDITY_MONTHS } from "./template";
import { nextCardSequence } from "./sequence";
import { formatCardNumber, generateCardToken, hashCardToken } from "./token";
import { sealCardToken } from "./token-vault";
import { applyCreditForMember } from "@/lib/membership/apply-credit-store";

/**
 * Pedido de la tarjeta impresa.
 *
 * Todos los socios tienen carnet digital sin pedirlo. La tarjeta la pide quien la quiere, y
 * cuesta **el valor de una cuota**. El cargo entra por el mismo circuito que las cuotas —no
 * por uno paralelo— así que se paga desde la misma pantalla y se concilia igual.
 */

/** Días para pagar la tarjeta antes de que el pedido pierda sentido. */
export const PRINT_ORDER_DUE_DAYS = 30;

export type PrintOrderResult =
  | { ok: true; cardId: string; cardNumber: string; amountMinor: number }
  | { ok: false; error: string };

const MAX_INTENTOS = 5;

export async function requestPrintedCard(input: {
  workspaceId: string;
  memberId: string;
  now?: Date;
  /**
   * Cargo ya existente al que enganchar la tarjeta, en vez de crear uno.
   *
   * Lo usa quien pagó la credencial junto con su inscripción: el cargo nació con el alta y la
   * tarjeta se emite recién cuando llega la foto. Sin esto se le cobraría dos veces.
   */
  existingChargeId?: string;
}): Promise<PrintOrderResult> {
  const ahora = input.now ?? new Date();

  const socio = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true, status: true, categoryId: true, avatarUrl: true },
  });
  if (!socio) return { ok: false, error: "No encontramos tu ficha de socio." };
  if (socio.status !== "ACTIVE") {
    return { ok: false, error: "Tu condición de socio no está activa." };
  }
  if (!socio.avatarUrl) {
    // La foto es variable obligatoria del carnet: sin ella la emisión fallaría más adelante,
    // y es mejor decirlo antes de cobrarle que después.
    return {
      ok: false,
      error: "Falta tu foto. Subila desde tu perfil antes de pedir la tarjeta impresa.",
    };
  }

  const enCurso = await prisma.memberCard.findFirst({
    where: {
      memberId: input.memberId,
      format: "PRINTED",
      revokedAt: null,
      fulfillmentState: { notIn: ["ENTREGADO", "ANULADO"] },
      // Una vencida no está "en camino": es un trámite que quedó a mitad y no puede bloquear
      // a nadie para siempre. Mismo criterio que decide si se ofrece pedirla.
      validUntil: { gt: ahora },
    },
    select: { id: true },
  });
  if (enCurso) {
    return { ok: false, error: "Ya tenés una tarjeta impresa en camino." };
  }

  const valor = await getActiveFeeValue(input.workspaceId, socio.categoryId, ahora);
  if (!valor) {
    return {
      ok: false,
      error: "La institución todavía no definió el valor de la cuota. Escribile a la Secretaría.",
    };
  }
  const amountMinor = decimalArsToMinor(valor.amountArs);
  if (amountMinor <= 0) {
    return { ok: false, error: "El valor de la cuota no es válido. Escribile a la Secretaría." };
  }

  const period = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, "0")}`;
  const dueDate = new Date(ahora.getTime() + PRINT_ORDER_DUE_DAYS * 24 * 60 * 60 * 1000);
  const validUntil = addMonthsUtc(ahora, CARNET_VALIDITY_MONTHS);

  let ultimoError: unknown = null;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const token = generateCardToken();
    try {
      const emitidos = await prisma.memberCard.findMany({
        where: { workspaceId: input.workspaceId },
        select: { cardNumber: true },
      });
      const cardNumber = formatCardNumber(
        ahora.getUTCFullYear(),
        nextCardSequence(
          emitidos.map((c) => c.cardNumber),
          ahora.getUTCFullYear(),
        ),
      );
      const sellado = sealCardToken(token);

      // El cargo, la tarjeta y su primer evento se crean JUNTOS. Una tarjeta sin cargo sería
      // una que nadie va a pagar; un cargo sin tarjeta, plata cobrada sin nada que entregar.
      const cardId = await prisma.$transaction(async (tx) => {
        const cargo = input.existingChargeId
          ? { id: input.existingChargeId }
          : await tx.membershipCharge.create({
              data: {
                workspaceId: input.workspaceId,
                memberId: input.memberId,
                concept: "OTRO",
                period,
                amountArs: minorToDecimalString(amountMinor),
                balanceArs: minorToDecimalString(amountMinor),
                dueDate,
                feeValueId: valor.id,
              },
              select: { id: true },
            });

        const card = await tx.memberCard.create({
          data: {
            workspaceId: input.workspaceId,
            memberId: input.memberId,
            cardNumber,
            tokenHash: hashCardToken(token),
            tokenCiphertext: sellado.ciphertext,
            tokenNonce: sellado.nonce,
            tokenAuthTag: sellado.authTag,
            format: "PRINTED",
            issuedAt: ahora,
            validUntil,
            printOrderChargeId: cargo.id,
            fulfillmentState: "PENDIENTE_PAGO",
            fulfillmentUpdatedAt: ahora,
          },
          select: { id: true },
        });

        await tx.memberCardEvent.create({
          data: {
            cardId: card.id,
            fromState: null,
            toState: "PENDIENTE_PAGO",
            actorLabel: "El socio pidió la tarjeta",
            note: null,
          },
        });

        return card.id;
      });

      // Sólo cuando el cargo lo creamos acá: si vino por `existingChargeId` ya existía antes
      // de este pedido y no es esta operación la que lo introduce.
      //
      // Va después de la transacción -no adentro- porque `applyCreditForMember` abre la suya
      // propia y Prisma no anida transacciones; además necesita el cargo ya comiteado para
      // poder verlo. Si un socio con saldo a favor pide la tarjeta y esto no corriera, el
      // portal le mostraría "Pagar todo" por un cargo que su crédito ya cubre, contradiciendo
      // el cartel que le dice que no hace falta que haga nada.
      //
      // Se ignora cualquier error: la tarjeta ya se emitió y el cargo ya existe, y ninguno de
      // los dos se puede deshacer acá. Perder esta imputación es recuperable en el próximo
      // cierre mensual; perder la tarjeta recién emitida, no.
      if (!input.existingChargeId) {
        try {
          await applyCreditForMember(input.memberId);
        } catch {
          // Ignorado a propósito: ver el comentario de arriba.
        }
      }

      return { ok: true, cardId, cardNumber, amountMinor };
    } catch (error) {
      ultimoError = error;
      // P2002: otro pedido tomó ese número de carnet, o el socio ya tiene un cargo `OTRO`
      // para este período. Lo segundo no se arregla reintentando.
      const codigo = (error as { code?: string })?.code;
      if (codigo !== "P2002") throw error;
      const meta = (error as { meta?: { target?: string[] } })?.meta?.target ?? [];
      if (meta.includes("period") || meta.includes("concept")) {
        return {
          ok: false,
          error: "Ya pediste una tarjeta este mes. Si necesitás otra, escribile a la Secretaría.",
        };
      }
    }
  }

  throw ultimoError ?? new Error("No se pudo registrar el pedido de la tarjeta.");
}

/**
 * Pasa a la cola de impresión las tarjetas cuyo cargo quedó saldado.
 *
 * Se llama después de acreditar un pago. Va acá y no en el webhook porque es una regla del
 * carnet, no del cobro: el día que se pague por otro medio —efectivo en la sede— tiene que
 * pasar lo mismo.
 */
export async function releasePaidPrintOrders(memberId: string): Promise<number> {
  const pendientes = await prisma.memberCard.findMany({
    where: {
      memberId,
      format: "PRINTED",
      fulfillmentState: "PENDIENTE_PAGO",
      printOrderChargeId: { not: null },
    },
    select: { id: true, printOrderChargeId: true },
  });
  if (pendientes.length === 0) return 0;

  const cargos = await prisma.membershipCharge.findMany({
    where: { id: { in: pendientes.map((p) => p.printOrderChargeId as string) } },
    select: { id: true, balanceArs: true },
  });
  const saldado = new Set(
    cargos.filter((c) => decimalArsToMinor(c.balanceArs) <= 0).map((c) => c.id),
  );

  let liberadas = 0;
  for (const card of pendientes) {
    if (!card.printOrderChargeId || !saldado.has(card.printOrderChargeId)) continue;
    await prisma.$transaction(async (tx) => {
      await tx.memberCard.update({
        where: { id: card.id },
        data: { fulfillmentState: "EN_COLA", fulfillmentUpdatedAt: new Date() },
      });
      await tx.memberCardEvent.create({
        data: {
          cardId: card.id,
          fromState: "PENDIENTE_PAGO",
          toState: "EN_COLA",
          // Sin actor humano: lo movió la acreditación del pago.
          actorLabel: "Pago acreditado",
        },
      });
    });
    liberadas += 1;
  }
  return liberadas;
}
