import { describe, expect, it } from "vitest";
import { canAnnounce, canCancel, canDraw, canSeal, isRaffleClosed, nextPrizeStatus, validateDates } from "./lifecycle";

const d = (s: string) => new Date(s);
const base = {
  salesFrom: d("2026-11-01T03:00:00Z"),
  salesTo: d("2026-12-01T03:00:00Z"),
  entriesCloseAt: d("2026-12-01T03:00:00Z"),
  drawsAt: d("2026-12-05T23:00:00Z"),
};

describe("las fechas", () => {
  it("válidas", () => expect(validateDates(base).ok).toBe(true));
  it("el padrón no cierra antes de que terminen las ventas", () => {
    expect(validateDates({ ...base, entriesCloseAt: d("2026-11-30T03:00:00Z") }).ok).toBe(false);
  });
  it("al menos 24 h entre el cierre y el sorteo", () => {
    expect(validateDates({ ...base, drawsAt: d("2026-12-01T20:00:00Z") }).ok).toBe(false);
  });
});

describe("anunciar", () => {
  const now = d("2026-11-22T12:00:00Z");
  it("borrador con premios y fechas futuras", () => {
    expect(canAnnounce({ ...base, status: "BORRADOR", prizeCount: 1, now }).ok).toBe(true);
  });
  it("sin premios, no", () => {
    expect(canAnnounce({ ...base, status: "BORRADOR", prizeCount: 0, now }).ok).toBe(false);
  });
  it("con el padrón ya cerrado, no", () => {
    expect(canAnnounce({ ...base, status: "BORRADOR", prizeCount: 1, now: d("2026-12-02T00:00:00Z") }).ok).toBe(false);
  });
});

describe("cerrar el padrón y sortear", () => {
  it("no antes del cierre", () => {
    expect(canSeal({ status: "ANUNCIADO", entriesCloseAt: base.entriesCloseAt, now: d("2026-11-30T00:00:00Z"), entrantCount: 5, prizeCount: 1 }).ok).toBe(false);
  });
  it("hacen falta al menos tantos participantes como premios", () => {
    expect(canSeal({ status: "ANUNCIADO", entriesCloseAt: base.entriesCloseAt, now: base.drawsAt, entrantCount: 1, prizeCount: 2 }).ok).toBe(false);
    expect(canSeal({ status: "ANUNCIADO", entriesCloseAt: base.entriesCloseAt, now: base.drawsAt, entrantCount: 2, prizeCount: 2 }).ok).toBe(true);
  });
  it("un resultado no se rehace", () => {
    expect(canDraw({ status: "SORTEADO", drawsAt: base.drawsAt, now: base.drawsAt }).ok).toBe(false);
  });
  it("con el padrón cerrado ya no se cancela", () => {
    expect(canCancel("PADRON_SELLADO").ok).toBe(false);
    expect(canCancel("ANUNCIADO").ok).toBe(true);
  });
});

describe("los premios", () => {
  it("anular exige motivo", () => {
    expect(nextPrizeStatus("GANADO", "ANULADO", "").ok).toBe(false);
    expect(nextPrizeStatus("GANADO", "ANULADO", "no respondió").ok).toBe(true);
  });
  it("entregado es final", () => {
    expect(nextPrizeStatus("ENTREGADO", "ANULADO", "x").ok).toBe(false);
  });
  it("el sorteo se cierra cuando ningún premio queda pendiente", () => {
    expect(isRaffleClosed(["ENTREGADO", "ANULADO"])).toBe(true);
    expect(isRaffleClosed(["ENTREGADO", "NOTIFICADO"])).toBe(false);
  });
});
