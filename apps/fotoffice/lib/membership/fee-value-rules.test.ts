import { describe, expect, it } from "vitest";
import { parseFeeValue, validateDuesSettings, MAX_FEE_MINOR } from "./fee-value-rules";

const base = { validFromRaw: "2026-09-01", categoryId: null, boardMinutesRef: null };

describe("parseFeeValue", () => {
  it("acepta el importe con punto de miles y coma decimal", () => {
    const r = parseFeeValue({ ...base, amountRaw: "47.000,50" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amountMinor).toBe(4700050);
  });

  it("acepta el importe sin separadores", () => {
    const r = parseFeeValue({ ...base, amountRaw: "47000" });
    expect(r.ok && r.value.amountMinor).toBe(4700000);
  });

  it("rechaza lo que no es un número", () => {
    expect(parseFeeValue({ ...base, amountRaw: "cuarenta mil" }).ok).toBe(false);
    expect(parseFeeValue({ ...base, amountRaw: "" }).ok).toBe(false);
    expect(parseFeeValue({ ...base, amountRaw: "47000,505" }).ok).toBe(false);
  });

  it("rechaza cero y negativos", () => {
    expect(parseFeeValue({ ...base, amountRaw: "0" }).ok).toBe(false);
    expect(parseFeeValue({ ...base, amountRaw: "-100" }).ok).toBe(false);
  });

  it("rechaza un importe absurdo, que es un error de tipeo", () => {
    const r = parseFeeValue({ ...base, amountRaw: String(MAX_FEE_MINOR / 100 + 1) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/tipeo/);
  });

  it("exige la fecha desde la que rige", () => {
    expect(parseFeeValue({ ...base, amountRaw: "47000", validFromRaw: "" }).ok).toBe(false);
    expect(parseFeeValue({ ...base, amountRaw: "47000", validFromRaw: "01/09/2026" }).ok).toBe(false);
  });

  it("la fecha se interpreta en UTC, sin correrse de día", () => {
    const r = parseFeeValue({ ...base, amountRaw: "47000" });
    expect(r.ok && r.value.validFrom.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("una categoría o un acta vacías quedan en null, no en cadena vacía", () => {
    const r = parseFeeValue({ ...base, amountRaw: "47000", categoryId: "  ", boardMinutesRef: "" });
    expect(r.ok && r.value.categoryId).toBe(null);
    expect(r.ok && r.value.boardMinutesRef).toBe(null);
  });
});

describe("validateDuesSettings", () => {
  const ok = { generationDay: 1, dueDay: 10, graceDays: 5, reminderDay: 5, initialDuesCount: 3 };

  it("acepta la configuración de la SFPR", () => {
    expect(validateDuesSettings(ok).ok).toBe(true);
  });

  it("no acepta días por encima de 28", () => {
    // Un día 30 dejaría a febrero sin generación; un 31, siete meses del año.
    expect(validateDuesSettings({ ...ok, dueDay: 30 }).ok).toBe(false);
    expect(validateDuesSettings({ ...ok, generationDay: 31 }).ok).toBe(false);
  });

  it("no acepta día cero ni negativo", () => {
    expect(validateDuesSettings({ ...ok, dueDay: 0 }).ok).toBe(false);
    expect(validateDuesSettings({ ...ok, reminderDay: -1 }).ok).toBe(false);
  });

  it("la cuota no puede generarse después de vencer", () => {
    const r = validateDuesSettings({ ...ok, generationDay: 20, dueDay: 10 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/vencimiento/);
  });

  it("acepta cero cuotas de ingreso", () => {
    expect(validateDuesSettings({ ...ok, initialDuesCount: 0 }).ok).toBe(true);
  });

  it("rechaza valores fuera de rango en gracia y cuotas de ingreso", () => {
    expect(validateDuesSettings({ ...ok, graceDays: 61 }).ok).toBe(false);
    expect(validateDuesSettings({ ...ok, initialDuesCount: 13 }).ok).toBe(false);
  });
});
