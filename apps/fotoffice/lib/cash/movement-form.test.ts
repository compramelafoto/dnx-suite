import { describe, expect, it } from "vitest";
import { parseMovementForm } from "./movement-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const base = {
  kind: "INGRESO",
  amountArs: "1.500,50",
  occurredAt: "2026-09-13T10:30",
  accountId: "acc-1",
  description: "Venta de trípode",
};

describe("parseMovementForm", () => {
  it("un ingreso completo se acepta y el importe queda en centavos", () => {
    const r = parseMovementForm(form(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.amountMinor).toBe(150_050);
    expect(r.values.kind).toBe("INGRESO");
    expect(r.values.description).toBe("Venta de trípode");
  });

  it("acepta el importe escrito como lo escribe la gente", () => {
    expect(parseMovementForm(form({ ...base, amountArs: "$ 2.000" })).ok).toBe(true);
    expect(parseMovementForm(form({ ...base, amountArs: "2000" })).ok).toBe(true);
  });

  it("un importe de cero se rechaza: un asiento de cero no informa nada", () => {
    expect(parseMovementForm(form({ ...base, amountArs: "0" }))).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("un importe negativo se rechaza: el signo lo da el tipo, no el número", () => {
    expect(parseMovementForm(form({ ...base, amountArs: "-500" }))).toEqual({
      ok: false,
      error: "El importe no se entiende.",
    });
  });

  it("sin descripción se rechaza: un movimiento sin concepto no sirve a los tres meses", () => {
    expect(parseMovementForm(form({ ...base, description: "  " }))).toEqual({
      ok: false,
      error: "Escribí de qué se trata el movimiento.",
    });
  });

  it("sin cuenta se rechaza", () => {
    expect(parseMovementForm(form({ ...base, accountId: "" }))).toEqual({
      ok: false,
      error: "Elegí en qué cuenta entra o sale la plata.",
    });
  });

  it("un tipo que no es ingreso ni egreso se rechaza", () => {
    expect(parseMovementForm(form({ ...base, kind: "AJUSTE" }))).toEqual({
      ok: false,
      error: "El movimiento tiene que ser un ingreso o un egreso.",
    });
  });

  it("una fecha que no se entiende se rechaza", () => {
    expect(parseMovementForm(form({ ...base, occurredAt: "ayer" }))).toEqual({
      ok: false,
      error: "Esa fecha no se entiende.",
    });
  });

  it("sin fecha usa el momento actual en vez de rechazar", () => {
    const antes = Date.now();
    const r = parseMovementForm(form({ ...base, occurredAt: "" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.occurredAt.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("el cliente y la categoría son opcionales", () => {
    const r = parseMovementForm(form(base));
    expect(r.ok && r.values.clientId).toBeNull();
    expect(r.ok && r.values.categoryId).toBeNull();
  });

  it("un medio de pago inventado se rechaza", () => {
    expect(parseMovementForm(form({ ...base, paymentMethod: "TRUEQUE" }))).toEqual({
      ok: false,
      error: "Ese medio de pago no existe.",
    });
  });
});
