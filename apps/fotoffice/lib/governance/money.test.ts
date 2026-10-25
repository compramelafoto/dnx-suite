import { describe, expect, it } from "vitest";
import {
  deviationPercent,
  freeBalanceMinor,
  isQuoteExpired,
  neededFor,
  parseQuoteForm,
  parseReservationForm,
  projectNumbers,
} from "./money";

describe("necesario", () => {
  it("elegida, mayor de las recibidas o estimado, por etapa", () => {
    const n = neededFor(
      [
        { id: "a", estimatedCostMinor: null, quotes: [{ amountMinor: 300_00, status: "CHOSEN" }, { amountMinor: 200_00, status: "RECEIVED" }] },
        { id: "b", estimatedCostMinor: 50_00, quotes: [{ amountMinor: 100_00, status: "RECEIVED" }, { amountMinor: 150_00, status: "RECEIVED" }] },
        { id: "c", estimatedCostMinor: 70_00, quotes: [{ amountMinor: 999_00, status: "DISCARDED" }] },
        { id: "d", estimatedCostMinor: null, quotes: [] },
      ],
      null,
    );
    expect(n.totalMinor).toBe(300_00 + 150_00 + 70_00);
    expect(n.minMinor).toBe(300_00 + 100_00 + 70_00);
    expect(n.detail).toEqual({ chosen: 1, ranged: 1, estimated: 1, empty: 1 });
    expect(n.fromManual).toBe(false);
  });

  it("sin nada en las etapas usa el costo aproximado del proyecto", () => {
    const n = neededFor([{ id: "a", estimatedCostMinor: null, quotes: [] }], 150_000_00);
    expect(n).toMatchObject({ totalMinor: 150_000_00, fromManual: true });
  });
});

describe("los cuatro números", () => {
  it("reservas e ingresos asignan; egresos gastan; los anulados no cuentan", () => {
    const r = projectNumbers({
      neededMinor: 1000_00,
      reservationsMinor: [500_00, -100_00],
      movements: [
        { kind: "INGRESO", amountMinor: 200_00, reversed: false },
        { kind: "EGRESO", amountMinor: 300_00, reversed: false },
        { kind: "EGRESO", amountMinor: 900_00, reversed: true },
      ],
      openingAssignedMinor: 100_00,
      openingSpentMinor: 50_00,
    });
    expect(r).toEqual({
      neededMinor: 1000_00,
      assignedMinor: 700_00,
      spentMinor: 350_00,
      remainingMinor: 350_00,
      missingMinor: 300_00,
      overspent: false,
    });
  });

  it("avisa cuando se gastó de más", () => {
    const r = projectNumbers({
      neededMinor: 0,
      reservationsMinor: [100_00],
      movements: [{ kind: "EGRESO", amountMinor: 150_00, reversed: false }],
      openingAssignedMinor: 0,
      openingSpentMinor: 0,
    });
    expect(r.overspent).toBe(true);
    expect(r.remainingMinor).toBe(-50_00);
  });

  it("saldo libre: sólo descuenta lo restante positivo", () => {
    expect(freeBalanceMinor(1000_00, [300_00, -50_00, 100_00])).toBe(600_00);
  });

  it("desvío entre cotizado y pagado", () => {
    expect(deviationPercent(300_000_00, 340_000_00)).toBe(13);
    expect(deviationPercent(0, 10)).toBeNull();
  });
});

describe("formularios de dinero", () => {
  it("cotización", () => {
    const r = parseQuoteForm({ stageId: "s", supplier: "Imprenta Sur", amount: "300.000", quotedAt: "2026-10-01", validUntil: "2026-10-31" });
    expect(r.ok && r.values.amountMinor).toBe(300_000_00);
    expect(parseQuoteForm({ stageId: "s", supplier: "", amount: "1" }).ok).toBe(false);
    expect(parseQuoteForm({ stageId: "s", supplier: "X", amount: "0" }).ok).toBe(false);
  });

  it("reserva y liberación", () => {
    const fd = new FormData();
    fd.set("amount", "50.000");
    fd.set("reason", "Aprobado en reunión");
    const r = parseReservationForm(fd);
    expect(r.ok && r.values.amountMinor).toBe(50_000_00);
    fd.set("release", "1");
    const l = parseReservationForm(fd);
    expect(l.ok && l.values.amountMinor).toBe(-50_000_00);
  });

  it("cotización vencida", () => {
    const ahora = new Date("2026-10-10T12:00:00Z");
    expect(isQuoteExpired(new Date("2026-10-01T15:00:00Z"), ahora)).toBe(true);
    expect(isQuoteExpired(null, ahora)).toBe(false);
  });
});
