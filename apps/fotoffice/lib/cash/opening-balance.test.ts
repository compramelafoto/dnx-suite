import { describe, expect, it } from "vitest";
import { isOpeningBalanceModule, openingBalanceDescription, parseOpeningBalanceForm } from "./opening-balance";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const ahora = new Date("2026-10-21T15:00:00Z");
const base = { accountId: "a1", amountArs: "193.900", occurredAt: "2026-10-19", note: "" };

describe("parseOpeningBalanceForm", () => {
  it("acepta importe con formato argentino y fecha pasada", () => {
    const r = parseOpeningBalanceForm(form(base), ahora);
    expect(r).toEqual({
      ok: true,
      values: { accountId: "a1", amountMinor: 19_390_000, occurredAt: expect.any(Date), note: null },
    });
  });

  it("la fecha se toma a las 00:00 hora argentina", () => {
    const r = parseOpeningBalanceForm(form({ ...base, amountArs: "100" }), ahora);
    expect(r.ok && r.values.occurredAt.toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });

  it("hoy se acepta", () => {
    expect(parseOpeningBalanceForm(form({ ...base, occurredAt: "2026-10-21" }), ahora).ok).toBe(true);
  });

  it("guarda la nota recortada", () => {
    const r = parseOpeningBalanceForm(form({ ...base, note: "  lo que había antes  " }), ahora);
    expect(r.ok && r.values.note).toBe("lo que había antes");
  });

  it("rechaza importe cero o ilegible", () => {
    expect(parseOpeningBalanceForm(form({ ...base, amountArs: "0" }), ahora).ok).toBe(false);
    expect(parseOpeningBalanceForm(form({ ...base, amountArs: "abc" }), ahora).ok).toBe(false);
  });

  it("rechaza fecha futura", () => {
    expect(parseOpeningBalanceForm(form({ ...base, occurredAt: "2026-10-22" }), ahora)).toEqual({
      ok: false,
      error: "La fecha del saldo inicial no puede ser futura.",
    });
  });

  it("rechaza fecha ilegible o vacía", () => {
    expect(parseOpeningBalanceForm(form({ ...base, occurredAt: "19/10" }), ahora).ok).toBe(false);
    expect(parseOpeningBalanceForm(form({ ...base, occurredAt: "" }), ahora).ok).toBe(false);
  });

  it("rechaza sin cuenta", () => {
    expect(parseOpeningBalanceForm(form({ ...base, accountId: "" }), ahora).ok).toBe(false);
  });
});

describe("isOpeningBalanceModule", () => {
  it("reconoce sólo saldo-inicial", () => {
    expect(isOpeningBalanceModule("saldo-inicial")).toBe(true);
    expect(isOpeningBalanceModule("manual")).toBe(false);
    expect(isOpeningBalanceModule(null)).toBe(false);
    expect(isOpeningBalanceModule(undefined)).toBe(false);
  });
});

describe("openingBalanceDescription", () => {
  it("sin nota es «Saldo inicial»; con nota, la suma", () => {
    expect(openingBalanceDescription(null)).toBe("Saldo inicial");
    expect(openingBalanceDescription("lo que había antes del sistema")).toBe("Saldo inicial: lo que había antes del sistema");
  });
});
