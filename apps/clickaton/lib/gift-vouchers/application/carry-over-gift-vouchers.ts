import { canCarryOverGiftVoucher, type GiftVoucherStatus } from "../domain/status";

/**
 * Cerró la inscripción de la edición y hay regalos pagados que nadie activó.
 *
 * El cupo se libera —no puede quedar tomado por alguien que no existe— pero
 * el regalo NO se pierde: queda apuntando a la edición siguiente. Es la única
 * forma de que "el voucher no vence" y "el cupo se reserva" convivan sin
 * llenar la maratón de lugares fantasma.
 */
export type CarryOverCandidate = {
  id: string;
  code: string;
  status: GiftVoucherStatus;
  registrationId: string;
  editionId: string;
  redeemableUntil: Date | null;
};

export type CarryOverResult = {
  candidatos: number;
  trasladados: number;
  fallados: number;
  codigos: string[];
};

export type CarryOverGiftVouchersDeps = {
  clock: { now(): Date };
  vouchers: {
    listCarryOverCandidates(limit: number): Promise<CarryOverCandidate[]>;
    markCarriedOver(input: {
      voucherId: string;
      carriedOverAt: Date;
      carriedOverToEditionId: string | null;
    }): Promise<void>;
  };
  registrations: {
    releaseGiftRegistration(registrationId: string): Promise<void>;
    /** Próxima edición con inscripción abierta o por abrir; null si no hay. */
    findNextEditionId(afterEditionId: string): Promise<string | null>;
  };
};

export function carryOverGiftVouchersUseCase(deps: CarryOverGiftVouchersDeps) {
  return {
    async execute(input: {
      dryRun: boolean;
      limit: number;
    }): Promise<CarryOverResult> {
      const now = deps.clock.now();
      const filas = await deps.vouchers.listCarryOverCandidates(input.limit);

      const elegibles = filas.filter((fila) =>
        canCarryOverGiftVoucher({
          status: fila.status,
          redeemableUntil: fila.redeemableUntil,
          now,
        }),
      );

      if (input.dryRun) {
        return {
          candidatos: elegibles.length,
          trasladados: 0,
          fallados: 0,
          codigos: elegibles.map((f) => f.code),
        };
      }

      let trasladados = 0;
      let fallados = 0;
      const codigos: string[] = [];

      for (const fila of elegibles) {
        try {
          // Primero el cupo: si falla, el regalo sigue activo y se reintenta
          // en la próxima corrida. Al revés quedaría un cupo tomado por nadie.
          await deps.registrations.releaseGiftRegistration(fila.registrationId);

          // Que todavía no exista la edición siguiente no puede hacer que el
          // regalo se pierda: se traslada igual y después se le asigna.
          const siguiente = await deps.registrations.findNextEditionId(fila.editionId);

          await deps.vouchers.markCarriedOver({
            voucherId: fila.id,
            carriedOverAt: now,
            carriedOverToEditionId: siguiente,
          });

          trasladados += 1;
          codigos.push(fila.code);
        } catch (error) {
          // Un regalo que falla no puede frenar a los demás.
          fallados += 1;
          console.error(
            `[clickaton] no se pudo trasladar el regalo ${fila.code}:`,
            error,
          );
        }
      }

      return { candidatos: elegibles.length, trasladados, fallados, codigos };
    },
  };
}

export type CarryOverGiftVouchersUseCase = ReturnType<
  typeof carryOverGiftVouchersUseCase
>;
