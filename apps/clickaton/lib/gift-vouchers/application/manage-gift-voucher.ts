import { generateGiftVoucherCode, normalizeGiftVoucherCode } from "../domain/code";
import type { GiftVoucherRepository } from "../domain/repository";

/**
 * Acciones de administración sobre un regalo: anularlo (liberando el cupo) y
 * reemitir su código cuando el link se filtró.
 *
 * Un regalo ya activado no se toca: la inscripción pasó a ser de otra persona.
 */
export type GiftManageFailureReason =
  | "NOT_FOUND"
  | "ALREADY_REDEEMED"
  | "NOT_ACTIVE";

export type GiftManageResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; reason: GiftManageFailureReason; message: string };

const MESSAGES: Record<GiftManageFailureReason, string> = {
  NOT_FOUND: "No encontramos ese regalo.",
  ALREADY_REDEEMED:
    "Este regalo ya fue activado: la inscripción es de quien lo recibió. Si hay que darla de baja, cancelá la inscripción.",
  NOT_ACTIVE: "Este regalo no está activo.",
};

function fail(reason: GiftManageFailureReason): GiftManageResult<never> {
  return { ok: false, reason, message: MESSAGES[reason] };
}

export type ManageGiftVoucherDeps = {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  registrations: {
    /** Cancela la inscripción del regalo y libera su cupo. */
    releaseGiftRegistration(registrationId: string): Promise<void>;
  };
  generateCode?: () => string;
};

export function manageGiftVoucherUseCase(deps: ManageGiftVoucherDeps) {
  const generateCode = deps.generateCode ?? generateGiftVoucherCode;

  async function find(rawCode: string) {
    const code = normalizeGiftVoucherCode(rawCode);
    if (!code) return null;
    return deps.vouchers.findByCode(code);
  }

  return {
    /** Anula el regalo y devuelve el cupo a la venta. */
    async cancel(input: {
      code: string;
      refunded: boolean;
    }): Promise<GiftManageResult> {
      const voucher = await find(input.code);
      if (!voucher) return fail("NOT_FOUND");
      if (voucher.status === "REDEEMED") return fail("ALREADY_REDEEMED");

      // Primero la inscripción: si el cupo no se libera, el voucher sigue
      // anulable, pero al revés quedaría un cupo tomado por nadie.
      await deps.registrations.releaseGiftRegistration(voucher.registrationId);
      await deps.vouchers.markCancelled({
        voucherId: voucher.id,
        cancelledAt: deps.clock.now(),
        refunded: input.refunded,
      });
      return { ok: true };
    },

    /** Código nuevo: el anterior deja de resolver. */
    async reissue(input: { code: string }): Promise<GiftManageResult<{ newCode: string }>> {
      const voucher = await find(input.code);
      if (!voucher) return fail("NOT_FOUND");
      if (voucher.status !== "ACTIVE") return fail("NOT_ACTIVE");

      const updated = await deps.vouchers.reissueCode({
        voucherId: voucher.id,
        newCode: generateCode(),
      });
      return { ok: true, newCode: updated.code };
    },
  };
}

export type ManageGiftVoucherUseCase = ReturnType<typeof manageGiftVoucherUseCase>;
