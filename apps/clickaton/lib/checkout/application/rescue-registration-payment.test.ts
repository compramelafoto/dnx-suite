import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRescueRegistrationPaymentUseCase,
  type RescueDeps,
} from "./rescue-registration-payment";

/**
 * UNIT — red de seguridad de cobro.
 *
 * Caso real que motiva estas pruebas (Liliana Mrejen, 2026-09-21):
 * pago aprobado en Mercado Pago 25 s después de inscribirse, webhook rechazado
 * por firma, reserva vencida a los 20 min e inscripción cancelada. Nadie volvió
 * a preguntarle al proveedor nunca más.
 */

type Registro = {
  id: string;
  editionId: string;
  venueId: string | null;
  userId: number | null;
  status: string;
  paymentStatus: string;
  paymentOrderId: string | null;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  money: { totalAmount: number; currency: string };
};

function armarEscenario(opciones: {
  registro?: Partial<Registro>;
  orden?: { id: string; status: string; amountMinor: number; currency: string } | null;
  cupo?: { capacity: number | null; confirmed: number };
}) {
  const registro: Registro = {
    id: "reg_1",
    editionId: "ed_1",
    venueId: "venue_1",
    userId: 7,
    status: "CANCELLED",
    paymentStatus: "EXPIRED",
    paymentOrderId: "dnx_ord_1",
    holdExpiresAt: new Date(Date.now() - 60_000),
    confirmedAt: null,
    money: { totalAmount: 1_500_000, currency: "ARS" },
    ...opciones.registro,
  };

  const llamadas = {
    refreshOrder: [] as string[],
    confirmPaid: [] as string[],
    markPaymentStatus: [] as { paymentStatus: string; reason: string }[],
    efectos: [] as string[],
  };

  const orden =
    opciones.orden === undefined
      ? { id: "dnx_ord_1", status: "APPROVED", amountMinor: 1_500_000, currency: "ARS" }
      : opciones.orden;

  const deps = {
    payments: {
      async refreshOrder(orderId: string) {
        llamadas.refreshOrder.push(orderId);
        return orden;
      },
    },
    registrationPort: {
      async getRegistration() {
        return registro;
      },
      async getEditionPrefix() {
        return "CK";
      },
      async getCapacitySnapshot() {
        return opciones.cupo ?? { capacity: null, confirmed: 3 };
      },
      async confirmPaid(input: { registrationId: string }) {
        llamadas.confirmPaid.push(input.registrationId);
        registro.status = "CONFIRMED";
        registro.paymentStatus = "APPROVED";
        registro.confirmedAt = new Date();
        return registro;
      },
      async markPaymentStatus(input: { paymentStatus: string; reason: string }) {
        llamadas.markPaymentStatus.push({
          paymentStatus: input.paymentStatus,
          reason: input.reason,
        });
        registro.paymentStatus = input.paymentStatus;
        return registro;
      },
    },
    runPaidEffects() {
      llamadas.efectos.push(registro.id);
    },
  } as unknown as RescueDeps;

  return { deps, llamadas, registro };
}

describe("rescate de pagos: le pregunta al proveedor antes de concluir nada", () => {
  it("SIEMPRE consulta al proveedor, aunque la fila local diga que no hay nada", async () => {
    const { deps, llamadas } = armarEscenario({});
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    await rescate.execute({ registrationId: "reg_1" });

    assert.deepEqual(
      llamadas.refreshOrder,
      ["dnx_ord_1"],
      "el cron tiene que preguntarle a Mercado Pago, no comparar filas locales entre sí",
    );
  });

  it("rescata una inscripción cancelada cuyo pago sí está aprobado", async () => {
    const { deps, llamadas, registro } = armarEscenario({});
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "RESCUED");
    assert.deepEqual(llamadas.confirmPaid, ["reg_1"]);
    assert.equal(registro.status, "CONFIRMED");
    assert.equal(registro.paymentStatus, "APPROVED");
  });

  it("dispara los efectos de pago (credencial, FotoRank, tarjeta, correo)", async () => {
    const { deps, llamadas } = armarEscenario({});
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    await rescate.execute({ registrationId: "reg_1" });

    assert.deepEqual(
      llamadas.efectos,
      ["reg_1"],
      "confirmar sin efectos deja a la persona sin QR y sin correo",
    );
  });

  it("no toca nada si el proveedor dice que no hay pago aprobado", async () => {
    const { deps, llamadas, registro } = armarEscenario({
      orden: { id: "dnx_ord_1", status: "PENDING", amountMinor: 1_500_000, currency: "ARS" },
    });
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "NOT_PAID");
    assert.deepEqual(llamadas.confirmPaid, []);
    assert.equal(registro.status, "CANCELLED");
  });

  it("no confirma si el monto cobrado no coincide: lo manda a revisión manual", async () => {
    const { deps, llamadas } = armarEscenario({
      orden: { id: "dnx_ord_1", status: "APPROVED", amountMinor: 500_000, currency: "ARS" },
    });
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "AMOUNT_MISMATCH");
    assert.deepEqual(llamadas.confirmPaid, []);
    assert.equal(llamadas.markPaymentStatus[0]?.paymentStatus, "MANUAL_REVIEW");
  });

  it("con cupo lleno no sobrevende: deja revisión manual", async () => {
    const { deps, llamadas } = armarEscenario({ cupo: { capacity: 30, confirmed: 30 } });
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "NO_CAPACITY");
    assert.deepEqual(llamadas.confirmPaid, []);
    assert.equal(llamadas.markPaymentStatus[0]?.paymentStatus, "MANUAL_REVIEW");
  });

  it("con cupo disponible sí confirma aunque la reserva haya vencido", async () => {
    const { deps, llamadas } = armarEscenario({ cupo: { capacity: 30, confirmed: 29 } });
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "RESCUED");
    assert.deepEqual(llamadas.confirmPaid, ["reg_1"]);
  });

  it("es idempotente: una inscripción ya confirmada no se vuelve a confirmar", async () => {
    const { deps, llamadas } = armarEscenario({
      registro: { status: "CONFIRMED", paymentStatus: "APPROVED", confirmedAt: new Date() },
    });
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "ALREADY_CONFIRMED");
    assert.deepEqual(llamadas.confirmPaid, []);
    assert.deepEqual(llamadas.efectos, []);
  });

  it("sin orden de pago no le pregunta nada al proveedor", async () => {
    const { deps, llamadas } = armarEscenario({
      registro: { paymentOrderId: null },
    });
    const rescate = createRescueRegistrationPaymentUseCase(deps);

    const res = await rescate.execute({ registrationId: "reg_1" });

    assert.equal(res.outcome, "NO_ORDER");
    assert.deepEqual(llamadas.refreshOrder, []);
  });
});
