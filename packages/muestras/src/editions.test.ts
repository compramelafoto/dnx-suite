import { describe, expect, it } from "vitest";
import { MAX_OFFERS_PER_WORK, MAX_PROOFS, RESERVATION_MINUTES, canChangeEdition, copyCounts, editionLabel, editionRemaining, lateCopyDecision, marksFirstSale, nextEditionNumber, type EditionRow } from "./editions";

const now = new Date("2026-11-14T15:00:00Z");
const antes = new Date(now.getTime() - 60_000);
const despues = new Date(now.getTime() + RESERVATION_MINUTES * 60_000);
const fila = (number: number, status: EditionRow["status"], reservedUntil: Date | null = null, kind: EditionRow["kind"] = "COPY"): EditionRow =>
  ({ id: `c${kind}${number}`, number, status, reservedUntil, kind });

describe("constantes", () => {
  it("decisiones de Daniel", () => {
    expect(MAX_PROOFS).toBe(5);
    expect(MAX_OFFERS_PER_WORK).toBe(6);
    expect(RESERVATION_MINUTES).toBe(20);
  });
});

describe("próximo número", () => {
  it("con 9 emitidas de 10, el próximo es el 10; con 10, no hay", () => {
    const nueve = Array.from({ length: 9 }, (_, i) => fila(i + 1, "ISSUED"));
    expect(nextEditionNumber(nueve, 10, now)).toEqual({ create: true, number: 10 });
    expect(nextEditionNumber([...nueve, fila(10, "ISSUED")], 10, now)).toBeNull();
  });
  it("una reserva vencida se reutiliza con su número", () => {
    const rows = [fila(1, "ISSUED"), fila(2, "ISSUED"), fila(3, "ISSUED"), fila(4, "RESERVED", antes), fila(5, "ISSUED")];
    expect(nextEditionNumber(rows, 10, now)).toEqual({ reuseId: "cCOPY4", number: 4 });
  });
  it("una reserva vigente ocupa su número", () => {
    expect(nextEditionNumber([fila(1, "RESERVED", despues)], 10, now)).toEqual({ create: true, number: 2 });
  });
  it("una anulada no se reutiliza y ocupa lugar", () => {
    const rows = [fila(1, "ISSUED"), fila(2, "VOIDED")];
    expect(nextEditionNumber(rows, 10, now)).toEqual({ create: true, number: 3 });
    expect(editionRemaining(rows, 10, now)).toBe(8);
    expect(nextEditionNumber([fila(1, "VOIDED"), fila(2, "ISSUED")], 2, now)).toBeNull();
  });
  it("una liberada con el número más bajo se reutiliza primero", () => {
    const rows = [fila(1, "RELEASED"), fila(2, "ISSUED"), fila(3, "RESERVED", antes)];
    expect(nextEditionNumber(rows, 10, now)).toEqual({ reuseId: "cCOPY1", number: 1 });
  });
  it("las P/A se numeran aparte", () => {
    const rows = [fila(1, "ISSUED"), fila(2, "ISSUED"), fila(1, "ISSUED", null, "PROOF")];
    expect(nextEditionNumber(rows, 10, now)).toEqual({ create: true, number: 3 });
    expect(nextEditionNumber(rows, 2, now, "PROOF")).toEqual({ create: true, number: 2 });
    expect(nextEditionNumber([...rows, fila(2, "ISSUED", null, "PROOF")], 2, now, "PROOF")).toBeNull();
  });
  it("cuenta emitidas, anuladas, reservadas y libres", () => {
    const rows = [fila(1, "ISSUED"), fila(2, "VOIDED"), fila(3, "RESERVED", despues), fila(4, "RESERVED", antes), fila(5, "RELEASED")];
    expect(copyCounts(rows, now)).toEqual({ issued: 1, voided: 1, reserved: 1, free: 2 });
  });
  it("aceptación: ninguna combinación pasa de N ni reutiliza una emitida o anulada", () => {
    const estados = ["ISSUED", "VOIDED", "RELEASED", "RESERVED_VIGENTE", "RESERVED_VENCIDA", "NADA"] as const;
    const N = 4;
    const total = estados.length ** N;
    for (let k = 0; k < total; k++) {
      const rows: EditionRow[] = [];
      let x = k;
      for (let n = 1; n <= N; n++) {
        const e = estados[x % estados.length]!;
        x = Math.floor(x / estados.length);
        if (e === "NADA") continue;
        if (e === "RESERVED_VIGENTE") rows.push(fila(n, "RESERVED", despues));
        else if (e === "RESERVED_VENCIDA") rows.push(fila(n, "RESERVED", antes));
        else rows.push(fila(n, e));
      }
      const r = nextEditionNumber(rows, N, now);
      const ocupadas = rows.filter((f) => f.status === "ISSUED" || f.status === "VOIDED" || (f.status === "RESERVED" && f.reservedUntil! > now)).length;
      if (ocupadas >= N) {
        expect(r).toBeNull();
        continue;
      }
      expect(r).not.toBeNull();
      expect(r!.number).toBeGreaterThanOrEqual(1);
      expect(r!.number).toBeLessThanOrEqual(N);
      const misma = rows.find((f) => f.number === r!.number);
      if ("reuseId" in r!) expect(misma && (misma.status === "RELEASED" || (misma.status === "RESERVED" && misma.reservedUntil! <= now))).toBe(true);
      else expect(misma).toBeUndefined();
    }
  });
});

describe("etiquetas", () => {
  it("los tres casos", () => {
    expect(editionLabel({ kind: "COPY", number: 1, size: 1, editionKind: "UNIQUE", proofCount: 0 })).toBe("Copia única");
    expect(editionLabel({ kind: "COPY", number: 3, size: 10, editionKind: "LIMITED", proofCount: 2 })).toBe("3/10");
    expect(editionLabel({ kind: "PROOF", number: 1, size: 10, editionKind: "LIMITED", proofCount: 2 })).toBe("P/A 1/2");
  });
});

describe("cambiar la edición", () => {
  it("antes de vender se puede subir o bajar", () => {
    expect(canChangeEdition({ firstSoldAt: null, currentSize: 10, nextSize: 12, issuedOrReserved: 0 })).toEqual({ ok: true });
  });
  it("después de vender no sube ni baja de lo ocupado", () => {
    const vendida = new Date();
    expect(canChangeEdition({ firstSoldAt: vendida, currentSize: 10, nextSize: 12, issuedOrReserved: 3 }).ok).toBe(false);
    expect(canChangeEdition({ firstSoldAt: vendida, currentSize: 10, nextSize: 2, issuedOrReserved: 3 }).ok).toBe(false);
    expect(canChangeEdition({ firstSoldAt: vendida, currentSize: 10, nextSize: 3, issuedOrReserved: 3 })).toEqual({ ok: true });
  });
});

describe("prueba y real van aparte (revisión de las tareas 1 a 5)", () => {
  const prueba = (number: number, status: EditionRow["status"], reservedUntil: Date | null = null): EditionRow =>
    ({ id: `t${number}`, number, status, reservedUntil, kind: "COPY", isTest: true });
  it("las copias de prueba no gastan números reales, ni al revés", () => {
    const filas = [prueba(1, "ISSUED"), prueba(2, "ISSUED"), fila(1, "ISSUED")];
    expect(nextEditionNumber(filas, 10, now)).toEqual({ create: true, number: 2 });
    expect(nextEditionNumber(filas, 10, now, "COPY", true)).toEqual({ create: true, number: 3 });
    expect(copyCounts(filas, now, "COPY", true)).toMatchObject({ issued: 2 });
    expect(copyCounts(filas, now)).toMatchObject({ issued: 1 });
    expect(editionRemaining(filas, 2, now, "COPY", true)).toBe(0);
    expect(editionRemaining(filas, 2, now)).toBe(1);
  });
  it("una edición agotada en prueba sigue entera en real", () => {
    const filas = [prueba(1, "ISSUED")];
    expect(nextEditionNumber(filas, 1, now, "COPY", true)).toBeNull();
    expect(nextEditionNumber(filas, 1, now)).toEqual({ create: true, number: 1 });
  });
  it("pago tardío: busca el número libre más bajo o queda sin copia, nunca recupera la fila vieja", () => {
    // La reserva vieja (número 1) se liberó y otro la tomó: el pago tardío va al 2.
    expect(lateCopyDecision([fila(1, "RESERVED", despues)], 2, now, false)).toEqual({ create: true, number: 2 });
    expect(lateCopyDecision([fila(1, "ISSUED"), fila(2, "RESERVED", despues)], 2, now, false)).toBe("PAID_NO_COPY");
  });
  it("una venta de prueba no marca la primera venta", () => {
    expect(marksFirstSale({ isTest: true, firstSoldAt: null })).toBe(false);
    expect(marksFirstSale({ isTest: false, firstSoldAt: null })).toBe(true);
    expect(marksFirstSale({ isTest: false, firstSoldAt: now })).toBe(false);
  });
});
