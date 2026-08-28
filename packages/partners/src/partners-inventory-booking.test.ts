import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESERVATION_DAYS,
  bookingFreesAt,
  isBookingOccupying,
  rangesOverlap,
  reservationExpiryFrom,
  resolveInventoryAvailability,
  defaultProposalPeriod,
  resolveInventoryCapacity,
  type InventoryBooking,
} from "./inventory-booking";

const AHORA = new Date("2026-08-27T12:00:00Z");
const d = (s: string) => new Date(s);

function ocupacion(over: Partial<InventoryBooking> = {}): InventoryBooking {
  return {
    placementKey: "INFOSPOT_HOME_MARQUEE",
    contextId: null,
    slotIndex: 0,
    status: "SOLD",
    startsAt: d("2026-08-01T00:00:00Z"),
    endsAt: d("2026-09-01T00:00:00Z"),
    reservationExpiresAt: null,
    ...over,
  };
}

const AGOSTO = { startsAt: d("2026-08-01T00:00:00Z"), endsAt: d("2026-09-01T00:00:00Z") };

describe("superposición de períodos", () => {
  it("dos períodos que se pisan, se pisan", () => {
    assert.equal(
      rangesOverlap(AGOSTO, { startsAt: d("2026-08-15T00:00:00Z"), endsAt: d("2026-10-01T00:00:00Z") }),
      true,
    );
  });

  it("el que termina cuando el otro arranca no se pisa", () => {
    assert.equal(
      rangesOverlap(AGOSTO, { startsAt: d("2026-09-01T00:00:00Z"), endsAt: d("2026-10-01T00:00:00Z") }),
      false,
    );
  });

  it("períodos separados no se pisan", () => {
    assert.equal(
      rangesOverlap(AGOSTO, { startsAt: d("2026-11-01T00:00:00Z"), endsAt: d("2026-12-01T00:00:00Z") }),
      false,
    );
  });
});

describe("qué ocupa un lugar", () => {
  it("vendido ocupa", () => {
    assert.equal(isBookingOccupying(ocupacion(), AHORA), true);
  });

  it("borrador y cancelado no ocupan", () => {
    for (const status of ["DRAFT", "CANCELLED"] as const) {
      assert.equal(isBookingOccupying(ocupacion({ status }), AHORA), false, status);
    }
  });

  it("una reserva vigente ocupa", () => {
    const b = ocupacion({ status: "RESERVED", reservationExpiresAt: d("2026-09-05T00:00:00Z") });
    assert.equal(isBookingOccupying(b, AHORA), true);
  });

  it("una reserva vencida deja de ocupar", () => {
    const b = ocupacion({ status: "RESERVED", reservationExpiresAt: d("2026-08-20T00:00:00Z") });
    assert.equal(isBookingOccupying(b, AHORA), false);
  });

  it("una reserva sin vencimiento ocupa", () => {
    const b = ocupacion({ status: "RESERVED", reservationExpiresAt: null });
    assert.equal(isBookingOccupying(b, AHORA), true);
  });

  it("la reserva se libera al vencer, aunque el período siga", () => {
    const b = ocupacion({ status: "RESERVED", reservationExpiresAt: d("2026-08-29T00:00:00Z") });
    assert.deepEqual(bookingFreesAt(b), d("2026-08-29T00:00:00Z"));
    assert.deepEqual(bookingFreesAt(ocupacion()), d("2026-09-01T00:00:00Z"));
  });

  it("la reserva dura diez días corridos", () => {
    assert.equal(RESERVATION_DAYS, 10);
    assert.deepEqual(reservationExpiryFrom(AHORA), d("2026-09-06T12:00:00Z"));
  });
});

describe("cupo del catálogo", () => {
  it("la franja de logos entra doce", () => {
    assert.equal(resolveInventoryCapacity("INFOSPOT_HOME_MARQUEE"), 12);
  });

  it("la placa de bienvenida entra una", () => {
    assert.equal(resolveInventoryCapacity("INFOSPOT_HOME_WELCOME"), 1);
  });
});

describe("disponibilidad", () => {
  const base = {
    placementKey: "INFOSPOT_HOME_MARQUEE" as const,
    contextId: null,
    range: AGOSTO,
    now: AHORA,
  };

  it("sin ocupaciones, todo libre y el primer lugar es el cero", () => {
    const a = resolveInventoryAvailability({ ...base, bookings: [] });
    assert.equal(a.capacity, 12);
    assert.equal(a.taken, 0);
    assert.equal(a.free, 12);
    assert.equal(a.slotIndex, 0);
    assert.equal(a.nextFreeAt, null);
  });

  it("devuelve el lugar libre más bajo", () => {
    const bookings = [ocupacion({ slotIndex: 0 }), ocupacion({ slotIndex: 2 })];
    const a = resolveInventoryAvailability({ ...base, bookings });
    assert.equal(a.taken, 2);
    assert.equal(a.slotIndex, 1);
  });

  it("sin lugar devuelve null y dice cuándo se libera el primero", () => {
    const bookings = Array.from({ length: 12 }, (_, i) =>
      ocupacion({ slotIndex: i, endsAt: d(`2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`) }),
    );
    const a = resolveInventoryAvailability({ ...base, bookings });
    assert.equal(a.free, 0);
    assert.equal(a.slotIndex, null);
    assert.deepEqual(a.nextFreeAt, d("2026-09-01T00:00:00Z"));
  });

  it("una reserva vencida libera el lugar de inmediato", () => {
    const bookings = [
      ocupacion({ slotIndex: 0, status: "RESERVED", reservationExpiresAt: d("2026-08-20T00:00:00Z") }),
    ];
    const a = resolveInventoryAvailability({ ...base, bookings });
    assert.equal(a.slotIndex, 0);
    assert.equal(a.taken, 0);
  });

  it("una ocupación de otro período no molesta", () => {
    const bookings = [
      ocupacion({ slotIndex: 0, startsAt: d("2026-11-01T00:00:00Z"), endsAt: d("2026-12-01T00:00:00Z") }),
    ];
    assert.equal(resolveInventoryAvailability({ ...base, bookings }).slotIndex, 0);
  });

  it("una ocupación de otro espacio no molesta", () => {
    const bookings = [ocupacion({ slotIndex: 0, placementKey: "CLF_LOGO_MARQUEE" })];
    assert.equal(resolveInventoryAvailability({ ...base, bookings }).slotIndex, 0);
  });

  it("lo global y lo de contexto no se bloquean entre sí", () => {
    const deConcurso = ocupacion({
      slotIndex: 0,
      placementKey: "FOTORANK_CONTEST_WELCOME",
      contextId: "concurso-1",
    });
    const global = resolveInventoryAvailability({
      ...base,
      placementKey: "FOTORANK_CONTEST_WELCOME",
      bookings: [deConcurso],
    });
    assert.equal(global.slotIndex, 0);

    const mismoConcurso = resolveInventoryAvailability({
      ...base,
      placementKey: "FOTORANK_CONTEST_WELCOME",
      contextId: "concurso-1",
      bookings: [deConcurso],
    });
    assert.equal(mismoConcurso.slotIndex, null);
  });

  it("otro concurso tiene su propio cupo", () => {
    const deOtro = ocupacion({
      slotIndex: 0,
      placementKey: "FOTORANK_CONTEST_WELCOME",
      contextId: "concurso-2",
    });
    const a = resolveInventoryAvailability({
      ...base,
      placementKey: "FOTORANK_CONTEST_WELCOME",
      contextId: "concurso-1",
      bookings: [deOtro],
    });
    assert.equal(a.slotIndex, 0);
  });

  it("el cupo comercial se puede sobrescribir para la rotación", () => {
    const a = resolveInventoryAvailability({
      ...base,
      placementKey: "INFOSPOT_HOME_TOP",
      bookings: [ocupacion({ slotIndex: 0, placementKey: "INFOSPOT_HOME_TOP" })],
      capacity: 3,
    });
    assert.equal(a.capacity, 3);
    assert.equal(a.slotIndex, 1);
  });
});

describe("período de una propuesta", () => {
  it("por defecto es un mes desde la fecha dada", () => {
    const p = defaultProposalPeriod(d("2026-03-10T00:00:00Z"));
    assert.deepEqual(p.startsAt, d("2026-03-10T00:00:00Z"));
    assert.deepEqual(p.endsAt, d("2026-04-10T00:00:00Z"));
  });

  it("se puede pedir más de un mes", () => {
    const p = defaultProposalPeriod(d("2026-03-10T00:00:00Z"), 3);
    assert.deepEqual(p.endsAt, d("2026-06-10T00:00:00Z"));
  });

  it("el 31 de enero cae al último día de febrero, no se desborda a marzo", () => {
    const p = defaultProposalPeriod(d("2026-01-31T00:00:00Z"));
    assert.deepEqual(p.endsAt, d("2026-02-28T00:00:00Z"));
  });

  it("respeta los años bisiestos", () => {
    const p = defaultProposalPeriod(d("2028-01-31T00:00:00Z"));
    assert.deepEqual(p.endsAt, d("2028-02-29T00:00:00Z"));
  });

  it("cruza el fin de año", () => {
    const p = defaultProposalPeriod(d("2026-12-15T00:00:00Z"));
    assert.deepEqual(p.endsAt, d("2027-01-15T00:00:00Z"));
  });

  it("conserva la hora del día", () => {
    const p = defaultProposalPeriod(d("2026-03-10T15:30:00Z"));
    assert.deepEqual(p.endsAt, d("2026-04-10T15:30:00Z"));
  });
});
