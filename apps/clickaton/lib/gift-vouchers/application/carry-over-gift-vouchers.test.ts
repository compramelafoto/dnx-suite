import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { carryOverGiftVouchersUseCase } from "./carry-over-gift-vouchers";
import type { GiftVoucherStatus } from "../domain/status";

const AHORA = new Date("2026-12-27T03:00:00.000Z");
const CERRO = new Date("2026-12-26T21:00:00.000Z");
const ABIERTA = new Date("2027-03-20T21:00:00.000Z");

type Fila = {
  id: string;
  code: string;
  status: GiftVoucherStatus;
  registrationId: string;
  editionId: string;
  redeemableUntil: Date | null;
};

function setup(opts: { filas?: Fila[]; siguienteEdicion?: string | null } = {}) {
  const filas: Fila[] = opts.filas ?? [
    {
      id: "gv_1",
      code: "REGALO-AAAA-BBBB",
      status: "ACTIVE",
      registrationId: "reg_1",
      editionId: "ed_1",
      redeemableUntil: CERRO,
    },
  ];

  const liberadas: string[] = [];
  const trasladados: Array<{ voucherId: string; haciaEdicion: string | null }> = [];

  const use = carryOverGiftVouchersUseCase({
    clock: { now: () => AHORA },
    vouchers: {
      async listCarryOverCandidates() {
        return filas;
      },
      async markCarriedOver(input) {
        trasladados.push({
          voucherId: input.voucherId,
          haciaEdicion: input.carriedOverToEditionId,
        });
      },
    },
    registrations: {
      async releaseGiftRegistration(registrationId) {
        liberadas.push(registrationId);
      },
      async findNextEditionId() {
        return opts.siguienteEdicion === undefined ? "ed_2" : opts.siguienteEdicion;
      },
    },
  });

  return { use, liberadas, trasladados };
}

describe("traslado de regalos sin activar al cerrar la inscripción", () => {
  it("libera el cupo y apunta el voucher a la edición siguiente", async () => {
    const { use, liberadas, trasladados } = setup();
    const result = await use.execute({ dryRun: false, limit: 100 });

    assert.equal(result.trasladados, 1);
    assert.deepEqual(liberadas, ["reg_1"]);
    assert.deepEqual(trasladados, [{ voucherId: "gv_1", haciaEdicion: "ed_2" }]);
  });

  it("traslada igual aunque todavía no exista la edición siguiente", async () => {
    // El regalo no se puede perder por no haber cargado la próxima edición.
    const { use, trasladados, liberadas } = setup({ siguienteEdicion: null });
    const result = await use.execute({ dryRun: false, limit: 100 });

    assert.equal(result.trasladados, 1);
    assert.deepEqual(liberadas, ["reg_1"]);
    assert.deepEqual(trasladados, [{ voucherId: "gv_1", haciaEdicion: null }]);
  });

  it("no toca nada en modo simulación", async () => {
    const { use, liberadas, trasladados } = setup();
    const result = await use.execute({ dryRun: true, limit: 100 });

    assert.equal(result.trasladados, 0);
    assert.equal(result.candidatos, 1);
    assert.deepEqual(liberadas, []);
    assert.deepEqual(trasladados, []);
  });

  it("no traslada uno cuyo plazo todavía no venció", async () => {
    const { use, trasladados } = setup({
      filas: [
        {
          id: "gv_1",
          code: "REGALO-AAAA-BBBB",
          status: "ACTIVE",
          registrationId: "reg_1",
          editionId: "ed_1",
          redeemableUntil: ABIERTA,
        },
      ],
    });
    const result = await use.execute({ dryRun: false, limit: 100 });

    assert.equal(result.trasladados, 0);
    assert.deepEqual(trasladados, []);
  });

  it("no traslada uno ya canjeado, anulado o trasladado", async () => {
    const estados: GiftVoucherStatus[] = [
      "REDEEMED",
      "CANCELLED",
      "REFUNDED",
      "CARRIED_OVER",
      "PENDING_PAYMENT",
    ];
    const { use, trasladados, liberadas } = setup({
      filas: estados.map((status, i) => ({
        id: `gv_${i}`,
        code: `REGALO-AAAA-000${i}`,
        status,
        registrationId: `reg_${i}`,
        editionId: "ed_1",
        redeemableUntil: CERRO,
      })),
    });
    const result = await use.execute({ dryRun: false, limit: 100 });

    assert.equal(result.trasladados, 0);
    assert.deepEqual(trasladados, []);
    assert.deepEqual(liberadas, []);
  });

  it("sigue con los demás si uno falla", async () => {
    const liberadas: string[] = [];
    const use = carryOverGiftVouchersUseCase({
      clock: { now: () => AHORA },
      vouchers: {
        async listCarryOverCandidates() {
          return [
            {
              id: "gv_roto",
              code: "REGALO-AAAA-0001",
              status: "ACTIVE" as const,
              registrationId: "reg_roto",
              editionId: "ed_1",
              redeemableUntil: CERRO,
            },
            {
              id: "gv_sano",
              code: "REGALO-AAAA-0002",
              status: "ACTIVE" as const,
              registrationId: "reg_sano",
              editionId: "ed_1",
              redeemableUntil: CERRO,
            },
          ];
        },
        async markCarriedOver() {},
      },
      registrations: {
        async releaseGiftRegistration(registrationId) {
          if (registrationId === "reg_roto") throw new Error("la base dijo que no");
          liberadas.push(registrationId);
        },
        async findNextEditionId() {
          return "ed_2";
        },
      },
    });

    const result = await use.execute({ dryRun: false, limit: 100 });
    assert.equal(result.trasladados, 1);
    assert.equal(result.fallados, 1);
    assert.deepEqual(liberadas, ["reg_sano"]);
  });
});
